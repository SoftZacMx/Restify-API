import { inject, injectable } from 'tsyringe';
import { BaseReportGenerator } from '../base-report.generator';
import { ReportType, BaseReportFilters, BaseReportResult } from '../../../domain/interfaces/report-generator.interface';
import { IOrderRepository } from '../../../domain/interfaces/order-repository.interface';
import { IExpenseRepository } from '../../../domain/interfaces/expense-repository.interface';
import { IEmployeeSalaryPaymentRepository } from '../../../domain/interfaces/employee-salary-payment-repository.interface';
import { ExpenseType } from '@prisma/client';

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
    private readonly employeeSalaryPaymentRepository: IEmployeeSalaryPaymentRepository
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

    // Fetch orders with tips separately
    const ordersWithTips = orders.filter((order) => order.tip > 0);

    return {
      orders,
      businessServices,
      merchandise,
      employeeSalaries,
      ordersWithTips,
    };
  }

  protected transformData(rawData: any, filters: BaseReportFilters): CashFlowReportData {
    const { orders, businessServices, merchandise, employeeSalaries, ordersWithTips } = rawData;

    // Calculate total incomes
    let totalIncomes = 0;
    const incomesByPaymentMethod = {
      cash: 0,
      transfer: 0,
      card: 0,
    };

    orders.forEach((order: any) => {
      totalIncomes += order.total;
      if (order.paymentMethod === 1) incomesByPaymentMethod.cash += order.total;
      else if (order.paymentMethod === 2) incomesByPaymentMethod.transfer += order.total;
      else if (order.paymentMethod === 3) incomesByPaymentMethod.card += order.total;
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

