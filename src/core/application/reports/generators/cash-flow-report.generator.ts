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

    // Income by method: use Payment rows when present (split = several lines; single = one line).
    // Fallback to order.paymentMethod only if there are no payment rows (legacy).
    const paidOrderIds = orders.filter((o) => o.status).map((o) => o.id);
    const splitPaymentLines: Payment[] =
      paidOrderIds.length > 0
        ? await this.paymentRepository.findAll({
            orderIds: paidOrderIds,
            status: PaymentStatus.SUCCEEDED,
          })
        : [];
    const paymentsByOrderId = new Map<string, Payment[]>();
    for (const p of splitPaymentLines) {
      if (!p.orderId) continue;
      const list = paymentsByOrderId.get(p.orderId) ?? [];
      list.push(p);
      paymentsByOrderId.set(p.orderId, list);
    }

    // Split sin filas en `payments` (datos viejos o inconsistencia): usar PaymentDifferentiation
    const paymentDiffByOrderId = new Map<string, PaymentDifferentiation>();
    const ordersNeedingDiff = orders.filter(
      (o) =>
        o.status &&
        o.paymentDiffer &&
        (paymentsByOrderId.get(o.id)?.length ?? 0) === 0
    );
    await Promise.all(
      ordersNeedingDiff.map(async (o) => {
        const diff = await this.paymentDifferentiationRepository.findByOrderId(o.id);
        if (diff) paymentDiffByOrderId.set(o.id, diff);
      })
    );

    // Fetch orders with tips separately
    const ordersWithTips = orders.filter((order) => order.tip > 0);

    return {
      orders,
      businessServices,
      merchandise,
      employeeSalaries,
      ordersWithTips,
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
      paymentsByOrderId,
      paymentDiffByOrderId,
    } = rawData;
    const paymentLinesByOrder: Map<string, Payment[]> =
      paymentsByOrderId instanceof Map ? paymentsByOrderId : new Map<string, Payment[]>();
    const diffByOrder: Map<string, PaymentDifferentiation> =
      paymentDiffByOrderId instanceof Map ? paymentDiffByOrderId : new Map<string, PaymentDifferentiation>();

    // Calculate total incomes
    let totalIncomes = 0;
    const incomesByPaymentMethod = {
      cash: 0,
      transfer: 0,
      card: 0,
    };

    orders.forEach((order: any) => {
      totalIncomes += order.total;
      const paymentLines = paymentLinesByOrder.get(order.id) ?? [];
      if (paymentLines.length > 0) {
        for (const p of paymentLines) {
          addIncomeToPaymentBuckets(incomesByPaymentMethod, p.paymentMethod, p.amount);
        }
      } else {
        const diff = diffByOrder.get(order.id);
        if (diff) {
          addIncomeToPaymentBuckets(incomesByPaymentMethod, diff.firstPaymentMethod, diff.firstPaymentAmount);
          addIncomeToPaymentBuckets(incomesByPaymentMethod, diff.secondPaymentMethod, diff.secondPaymentAmount);
        } else if (order.paymentMethod != null) {
          addIncomeToPaymentBuckets(incomesByPaymentMethod, order.paymentMethod, order.total);
        }
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

