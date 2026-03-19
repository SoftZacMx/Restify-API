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
  buckets: { cash: number; transfer: number; card: number },
  method: PaymentMethod | number,
  amount: number
): void {
  if (typeof method === 'number') {
    if (method === 1) buckets.cash += amount;
    else if (method === 2) buckets.transfer += amount;
    else if (method === 3) buckets.card += amount;
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
    default:
      break;
  }
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
    };
  };
  expenses: {
    businessServices: {
      items: Array<{
        id: string;
        date: Date;
        total: number;
        type: string;
        description: string | null;
      }>;
      total: number;
    };
    merchandise: {
      items: Array<{
        id: string;
        date: Date;
        total: number;
        description: string | null;
      }>;
      total: number;
    };
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
    // Fetch all data in parallel
    const [orders, businessServices, merchandise, employeeSalaries] = await Promise.all([
      // Fetch orders (only completed/delivered orders count as income)
      this.orderRepository.findAll({
        status: true, // Only paid orders
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
      }),

      // Fetch business service expenses
      this.expenseRepository.findAll({
        type: ExpenseType.SERVICE_BUSINESS,
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
      }),

      // Fetch merchandise expenses
      this.expenseRepository.findAll({
        type: ExpenseType.MERCHANDISE,
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
      }),

      // Fetch employee salary payments
      this.employeeSalaryPaymentRepository.findAll({
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
      }),
    ]);

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
      businessServices,
      merchandise,
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
      businessServices,
      merchandise,
      employeeSalaries,
      ordersWithTips,
      paidOrderIds: rawPaidOrderIds,
      succeededPayments,
      paymentsByOrderId,
      paymentDiffByOrderId,
    } = rawData;
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

    // Calculate expenses
    let totalBusinessServices = 0;
    businessServices.forEach((expense: any) => {
      totalBusinessServices += expense.total;
    });

    let totalMerchandise = 0;
    merchandise.forEach((expense: any) => {
      totalMerchandise += expense.total;
    });

    let totalEmployeeSalaries = 0;
    employeeSalaries.forEach((payment: any) => {
      totalEmployeeSalaries += payment.amount;
    });

    let totalTips = 0;
    ordersWithTips.forEach((order: any) => {
      totalTips += order.tip;
    });

    const totalExpenses = totalBusinessServices + totalMerchandise + totalEmployeeSalaries + totalTips;

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
        businessServices: {
          items: businessServices.map((expense: any) => ({
            id: expense.id,
            date: expense.date,
            total: expense.total,
            type: expense.type,
            description: expense.description,
          })),
          total: totalBusinessServices,
        },
        merchandise: {
          items: merchandise.map((expense: any) => ({
            id: expense.id,
            date: expense.date,
            total: expense.total,
            description: expense.description,
          })),
          total: totalMerchandise,
        },
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

