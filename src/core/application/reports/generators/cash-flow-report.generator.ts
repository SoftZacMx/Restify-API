import { inject, injectable } from 'tsyringe';
import { BaseReportGenerator } from '../base-report.generator';
import { ReportType, BaseReportFilters, BaseReportResult } from '../../../domain/interfaces/report-generator.interface';
import { IOrderRepository } from '../../../domain/interfaces/order-repository.interface';
import { IExpenseRepository } from '../../../domain/interfaces/expense-repository.interface';
import { IEmployeeSalaryPaymentRepository } from '../../../domain/interfaces/employee-salary-payment-repository.interface';
import { IPaymentRepository } from '../../../domain/interfaces/payment-repository.interface';
import { IPaymentDifferentiationRepository } from '../../../domain/interfaces/payment-differentiation-repository.interface';
import { Payment } from '../../../domain/entities/payment.entity';
import { PaymentDifferentiation } from '../../../domain/entities/payment-differentiation.entity';
import { ExpenseType, PaymentMethod, PaymentStatus } from '@prisma/client';

function addIncomeToPaymentBuckets(
  buckets: { cash: number; transfer: number; card: number; qrMercadoPago: number },
  method: PaymentMethod | number,
  amount: number
): void {
  if (typeof method === 'number') {
    if (method === 1) buckets.cash += amount;
    else if (method === 2) buckets.transfer += amount;
    else if (method === 3) buckets.card += amount;
    else if (method === 4) buckets.qrMercadoPago += amount;
    return;
  }
  switch (method) {
    case PaymentMethod.CASH:
      buckets.cash += amount;
      break;
    case PaymentMethod.TRANSFER:
      buckets.transfer += amount;
      break;
    case PaymentMethod.CARD_PHYSICAL:
    case PaymentMethod.CARD_STRIPE:
      buckets.card += amount;
      break;
    case PaymentMethod.QR_MERCADO_PAGO:
      buckets.qrMercadoPago += amount;
      break;
    default:
      break;
  }
}

interface ExpenseBucketItem {
  id: string;
  date: Date;
  total: number;
  type: string;
  description: string | null;
}

interface ExpenseBucket {
  items: ExpenseBucketItem[];
  total: number;
}

export interface CashFlowReportData {
  incomes: {
    orders: Array<{
      id: string;
      date: Date;
      total: number;
      paymentMethod: number | null;
    }>;
    totalIncomes: number;
    byPaymentMethod: {
      cash: number;
      transfer: number;
      card: number;
      qrMercadoPago: number;
    };
  };
  expenses: {
    /** Servicios del negocio (ExpenseType.SERVICE_BUSINESS) */
    businessServices: ExpenseBucket;
    /** Servicios públicos (ExpenseType.UTILITY) */
    utility: ExpenseBucket;
    /** Renta (ExpenseType.RENT) */
    rent: ExpenseBucket;
    /** Compras de mercancía (ExpenseType.MERCHANDISE) */
    merchandise: ExpenseBucket;
    /** Pagos de salario registrados como Expense (ExpenseType.SALARY) */
    salary: ExpenseBucket;
    /** Otros gastos (ExpenseType.OTHER) */
    other: ExpenseBucket;
    /** Comisiones cobradas por Mercado Pago (ExpenseType.MERCADO_PAGO_FEE) */
    mercadoPagoFee: ExpenseBucket;
    /** Pagos de salario desde la tabla employee_salary_payments (fuente independiente). */
    employeeSalaries: {
      items: Array<{
        id: string;
        date: Date;
        amount: number;
      }>;
      total: number;
    };
    tips: {
      orders: Array<{
        id: string;
        date: Date;
        tip: number;
      }>;
      total: number;
    };
    totalExpenses: number;
  };
  cashFlow: {
    balance: number;
    status: 'POSITIVE' | 'NEGATIVE' | 'BREAK_EVEN';
  };
}

@injectable()
export class CashFlowReportGenerator extends BaseReportGenerator {
  constructor(
    @inject('IOrderRepository') private readonly orderRepository: IOrderRepository,
    @inject('IExpenseRepository') private readonly expenseRepository: IExpenseRepository,
    @inject('IEmployeeSalaryPaymentRepository')
    private readonly employeeSalaryPaymentRepository: IEmployeeSalaryPaymentRepository,
    @inject('IPaymentRepository') private readonly paymentRepository: IPaymentRepository,
    @inject('IPaymentDifferentiationRepository')
    private readonly paymentDifferentiationRepository: IPaymentDifferentiationRepository
  ) {
    super();
  }

  getType(): ReportType {
    return ReportType.CASH_FLOW;
  }

  protected async fetchData(filters: BaseReportFilters): Promise<any> {
    // Fetch all data in parallel.
    // Para gastos: una sola query sin filtro por tipo. La agrupación por tipo
    // se hace en transformData. Antes se filtraba por SERVICE_BUSINESS y MERCHANDISE
    // exclusivamente, omitiendo UTILITY, RENT, SALARY, OTHER y MERCADO_PAGO_FEE
    // del cálculo de totalExpenses.
    const [orders, allExpenses, employeeSalaries] = await Promise.all([
      // Fetch orders (only completed/delivered orders count as income)
      this.orderRepository.findAll({
        status: true, // Only paid orders
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
      }),

      // Fetch every expense in the period (all types)
      this.expenseRepository.findAll({
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
      }),

      // Fetch employee salary payments
      this.employeeSalaryPaymentRepository.findAll({
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
      }),
    ]);

    // Group expenses by type
    const expensesByType: Record<ExpenseType, any[]> = {
      [ExpenseType.SERVICE_BUSINESS]: [],
      [ExpenseType.UTILITY]: [],
      [ExpenseType.RENT]: [],
      [ExpenseType.MERCHANDISE]: [],
      [ExpenseType.SALARY]: [],
      [ExpenseType.OTHER]: [],
      [ExpenseType.MERCADO_PAGO_FEE]: [],
    };
    for (const expense of allExpenses) {
      const bucket = expensesByType[expense.type as ExpenseType];
      if (bucket) bucket.push(expense);
    }

    // 1) Todos los pagos SUCCEEDED de las órdenes del período.
    // 2) Todas las PaymentDifferentiation de esas órdenes.
    // En transform: sumar por método desde payments; sumar por método desde diferenciaciones.
    // Si una orden tiene diferenciación, no se duplican sus filas en `payments` (el desglose va por diff).
    const paidOrderIds = orders.filter((o) => o.status).map((o) => o.id);
    const succeededPayments: Payment[] =
      paidOrderIds.length > 0
        ? await this.paymentRepository.findAll({
            orderIds: paidOrderIds,
            status: PaymentStatus.SUCCEEDED,
          })
        : [];
    const paymentsByOrderId = new Map<string, Payment[]>();
    for (const p of succeededPayments) {
      if (!p.orderId) continue;
      const list = paymentsByOrderId.get(p.orderId) ?? [];
      list.push(p);
      paymentsByOrderId.set(p.orderId, list);
    }

    const paymentDiffByOrderId = new Map<string, PaymentDifferentiation>();
    if (paidOrderIds.length > 0) {
      const diffs = await this.paymentDifferentiationRepository.findByOrderIds(paidOrderIds);
      for (const d of diffs) {
        paymentDiffByOrderId.set(d.orderId, d);
      }
    }

    // Fetch orders with tips separately
    const ordersWithTips = orders.filter((order) => order.tip > 0);

    return {
      orders,
      expensesByType,
      employeeSalaries,
      ordersWithTips,
      paidOrderIds,
      succeededPayments,
      paymentsByOrderId,
      paymentDiffByOrderId,
    };
  }

  protected transformData(rawData: any, filters: BaseReportFilters): CashFlowReportData {
    const {
      orders,
      expensesByType,
      employeeSalaries,
      ordersWithTips,
      paidOrderIds: rawPaidOrderIds,
      succeededPayments,
      paymentsByOrderId,
      paymentDiffByOrderId,
    } = rawData;
    const expensesByTypeMap: Record<ExpenseType, any[]> = expensesByType ?? {
      [ExpenseType.SERVICE_BUSINESS]: [],
      [ExpenseType.UTILITY]: [],
      [ExpenseType.RENT]: [],
      [ExpenseType.MERCHANDISE]: [],
      [ExpenseType.SALARY]: [],
      [ExpenseType.OTHER]: [],
      [ExpenseType.MERCADO_PAGO_FEE]: [],
    };
    const buildBucket = (type: ExpenseType) => {
      const items = expensesByTypeMap[type] ?? [];
      let total = 0;
      const mapped = items.map((expense: any) => {
        total += expense.total;
        return {
          id: expense.id,
          date: expense.date,
          total: expense.total,
          type: expense.type,
          description: expense.description,
        };
      });
      return { items: mapped, total };
    };
    const paymentLinesByOrder: Map<string, Payment[]> =
      paymentsByOrderId instanceof Map ? paymentsByOrderId : new Map<string, Payment[]>();
    const diffByOrder: Map<string, PaymentDifferentiation> =
      paymentDiffByOrderId instanceof Map ? paymentDiffByOrderId : new Map<string, PaymentDifferentiation>();

    const paidOrderIdSet = new Set<string>(rawPaidOrderIds ?? []);
    const diffOrderIds = new Set<string>(diffByOrder.keys());
    const paymentsList: Payment[] = Array.isArray(succeededPayments) ? succeededPayments : [];

    // Calculate total incomes
    let totalIncomes = 0;
    const incomesByPaymentMethod = {
      cash: 0,
      transfer: 0,
      card: 0,
      qrMercadoPago: 0,
    };

    orders.forEach((order: any) => {
      totalIncomes += order.total;
    });

    // A) payments: todos los SUCCEEDED; si la orden tiene PaymentDifferentiation, esas filas no se suman aquí.
    for (const p of paymentsList) {
      if (!p.orderId || !paidOrderIdSet.has(p.orderId)) continue;
      if (diffOrderIds.has(p.orderId)) continue;
      addIncomeToPaymentBuckets(incomesByPaymentMethod, p.paymentMethod, p.amount);
    }

    // B) PaymentDifferentiation: todos los primeros y segundos pagos por método.
    for (const d of diffByOrder.values()) {
      addIncomeToPaymentBuckets(incomesByPaymentMethod, d.firstPaymentMethod, d.firstPaymentAmount);
      addIncomeToPaymentBuckets(incomesByPaymentMethod, d.secondPaymentMethod, d.secondPaymentAmount);
    }

    // C) Legacy: orden pagada sin filas en `payments` ni diferenciación → un solo método en la orden.
    orders.forEach((order: any) => {
      if (!order.status) return;
      const lines = paymentLinesByOrder.get(order.id) ?? [];
      if (diffOrderIds.has(order.id)) return;
      if (lines.length > 0) return;
      if (order.paymentMethod != null) {
        addIncomeToPaymentBuckets(incomesByPaymentMethod, order.paymentMethod, order.total);
      }
    });

    // Calculate expenses: buckets per ExpenseType + employeeSalaries (tabla aparte) + tips (de las órdenes)
    const businessServices = buildBucket(ExpenseType.SERVICE_BUSINESS);
    const utility = buildBucket(ExpenseType.UTILITY);
    const rent = buildBucket(ExpenseType.RENT);
    const merchandise = buildBucket(ExpenseType.MERCHANDISE);
    const salary = buildBucket(ExpenseType.SALARY);
    const other = buildBucket(ExpenseType.OTHER);
    const mercadoPagoFee = buildBucket(ExpenseType.MERCADO_PAGO_FEE);

    let totalEmployeeSalaries = 0;
    employeeSalaries.forEach((payment: any) => {
      totalEmployeeSalaries += payment.amount;
    });

    let totalTips = 0;
    ordersWithTips.forEach((order: any) => {
      totalTips += order.tip;
    });

    const totalExpenses =
      businessServices.total +
      utility.total +
      rent.total +
      merchandise.total +
      salary.total +
      other.total +
      mercadoPagoFee.total +
      totalEmployeeSalaries +
      totalTips;

    // Calculate cash flow
    const balance = totalIncomes - totalExpenses;
    const status: 'POSITIVE' | 'NEGATIVE' | 'BREAK_EVEN' =
      balance > 0 ? 'POSITIVE' : balance < 0 ? 'NEGATIVE' : 'BREAK_EVEN';

    return {
      incomes: {
        orders: orders.map((order: any) => ({
          id: order.id,
          date: order.date,
          total: order.total,
          paymentMethod: order.paymentMethod,
        })),
        totalIncomes,
        byPaymentMethod: incomesByPaymentMethod,
      },
      expenses: {
        businessServices,
        utility,
        rent,
        merchandise,
        salary,
        other,
        mercadoPagoFee,
        employeeSalaries: {
          items: employeeSalaries.map((payment: any) => ({
            id: payment.id,
            date: payment.date,
            amount: payment.amount,
          })),
          total: totalEmployeeSalaries,
        },
        tips: {
          orders: ordersWithTips.map((order: any) => ({
            id: order.id,
            date: order.date,
            tip: order.tip,
          })),
          total: totalTips,
        },
        totalExpenses,
      },
      cashFlow: {
        balance,
        status,
      },
    };
  }
}

