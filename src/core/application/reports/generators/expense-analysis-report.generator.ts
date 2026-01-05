import { inject, injectable } from 'tsyringe';
import { BaseReportGenerator } from '../base-report.generator';
import { ReportType, BaseReportFilters, BaseReportResult } from '../../../domain/interfaces/report-generator.interface';
import { IExpenseRepository } from '../../../domain/interfaces/expense-repository.interface';
import { IEmployeeSalaryPaymentRepository } from '../../../domain/interfaces/employee-salary-payment-repository.interface';
import { ExpenseType } from '@prisma/client';

export interface ExpenseAnalysisReportData {
  expensesByCategory: {
    businessServices: {
      items: Array<{
        id: string;
        date: Date;
        total: number;
        description: string | null;
      }>;
      total: number;
      percentage: number;
    };
    utilities: {
      items: Array<{
        id: string;
        date: Date;
        total: number;
        description: string | null;
      }>;
      total: number;
      percentage: number;
    };
    rent: {
      items: Array<{
        id: string;
        date: Date;
        total: number;
        description: string | null;
      }>;
      total: number;
      percentage: number;
    };
    merchandise: {
      items: Array<{
        id: string;
        date: Date;
        total: number;
        description: string | null;
      }>;
      total: number;
      percentage: number;
    };
    other: {
      items: Array<{
        id: string;
        date: Date;
        total: number;
        description: string | null;
      }>;
      total: number;
      percentage: number;
    };
  };
  employeeSalaries: {
    items: Array<{
      id: string;
      date: Date;
      amount: number;
    }>;
    total: number;
    percentage: number;
  };
  summary: {
    totalExpenses: number;
    totalByPaymentMethod: {
      cash: number;
      transfer: number;
      card: number;
    };
    largestExpenseCategory: string;
    averageExpense: number;
  };
}

@injectable()
export class ExpenseAnalysisReportGenerator extends BaseReportGenerator {
  constructor(
    @inject('IExpenseRepository') private readonly expenseRepository: IExpenseRepository,
    @inject('IEmployeeSalaryPaymentRepository')
    private readonly employeeSalaryPaymentRepository: IEmployeeSalaryPaymentRepository
  ) {
    super();
  }

  getType(): ReportType {
    return ReportType.EXPENSE_ANALYSIS;
  }

  protected async fetchData(filters: BaseReportFilters): Promise<any> {
    // Fetch all expenses and employee salaries in parallel
    const [allExpenses, employeeSalaries] = await Promise.all([
      this.expenseRepository.findAll({
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
      }),
      this.employeeSalaryPaymentRepository.findAll({
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
      }),
    ]);

    return {
      allExpenses,
      employeeSalaries,
    };
  }

  protected transformData(rawData: any, filters: BaseReportFilters): ExpenseAnalysisReportData {
    const { allExpenses, employeeSalaries } = rawData;

    // Group expenses by type
    const expensesByType = {
      SERVICE_BUSINESS: [] as any[],
      UTILITY: [] as any[],
      RENT: [] as any[],
      MERCHANDISE: [] as any[],
      OTHER: [] as any[],
    };

    allExpenses.forEach((expense: any) => {
      expensesByType[expense.type as keyof typeof expensesByType].push({
        id: expense.id,
        date: expense.date,
        total: expense.total,
        description: expense.description,
        paymentMethod: expense.paymentMethod,
      });
    });

    // Calculate totals by category
    const calculateTotal = (items: any[]) => items.reduce((sum, item) => sum + item.total, 0);

    const businessServicesTotal = calculateTotal(expensesByType.SERVICE_BUSINESS);
    const utilitiesTotal = calculateTotal(expensesByType.UTILITY);
    const rentTotal = calculateTotal(expensesByType.RENT);
    const merchandiseTotal = calculateTotal(expensesByType.MERCHANDISE);
    const otherTotal = calculateTotal(expensesByType.OTHER);
    const employeeSalariesTotal = employeeSalaries.reduce((sum: number, payment: any) => sum + payment.amount, 0);

    const totalExpenses = businessServicesTotal + utilitiesTotal + rentTotal + merchandiseTotal + otherTotal + employeeSalariesTotal;

    // Calculate percentages
    const calculatePercentage = (total: number) => (totalExpenses > 0 ? (total / totalExpenses) * 100 : 0);

    // Calculate expenses by payment method
    const expensesByPaymentMethod = {
      cash: 0,
      transfer: 0,
      card: 0,
    };

    allExpenses.forEach((expense: any) => {
      if (expense.paymentMethod === 1) expensesByPaymentMethod.cash += expense.total;
      else if (expense.paymentMethod === 2) expensesByPaymentMethod.transfer += expense.total;
      else if (expense.paymentMethod === 3) expensesByPaymentMethod.card += expense.total;
    });

    employeeSalaries.forEach((payment: any) => {
      if (payment.paymentMethod === 1) expensesByPaymentMethod.cash += payment.amount;
      else if (payment.paymentMethod === 2) expensesByPaymentMethod.transfer += payment.amount;
      else if (payment.paymentMethod === 3) expensesByPaymentMethod.card += payment.amount;
    });

    // Find largest expense category
    const categoryTotals = {
      businessServices: businessServicesTotal,
      utilities: utilitiesTotal,
      rent: rentTotal,
      merchandise: merchandiseTotal,
      other: otherTotal,
      employeeSalaries: employeeSalariesTotal,
    };

    const largestCategory = Object.entries(categoryTotals).reduce((a, b) =>
      categoryTotals[a[0] as keyof typeof categoryTotals] > categoryTotals[b[0] as keyof typeof categoryTotals] ? a : b
    )[0];

    // Calculate average expense
    const totalExpenseCount = allExpenses.length + employeeSalaries.length;
    const averageExpense = totalExpenseCount > 0 ? totalExpenses / totalExpenseCount : 0;

    return {
      expensesByCategory: {
        businessServices: {
          items: expensesByType.SERVICE_BUSINESS,
          total: businessServicesTotal,
          percentage: calculatePercentage(businessServicesTotal),
        },
        utilities: {
          items: expensesByType.UTILITY,
          total: utilitiesTotal,
          percentage: calculatePercentage(utilitiesTotal),
        },
        rent: {
          items: expensesByType.RENT,
          total: rentTotal,
          percentage: calculatePercentage(rentTotal),
        },
        merchandise: {
          items: expensesByType.MERCHANDISE,
          total: merchandiseTotal,
          percentage: calculatePercentage(merchandiseTotal),
        },
        other: {
          items: expensesByType.OTHER,
          total: otherTotal,
          percentage: calculatePercentage(otherTotal),
        },
      },
      employeeSalaries: {
        items: employeeSalaries.map((payment: any) => ({
          id: payment.id,
          date: payment.date,
          amount: payment.amount,
        })),
        total: employeeSalariesTotal,
        percentage: calculatePercentage(employeeSalariesTotal),
      },
      summary: {
        totalExpenses,
        totalByPaymentMethod: expensesByPaymentMethod,
        largestExpenseCategory: largestCategory,
        averageExpense,
      },
    };
  }
}

