import { PrismaClient } from '@prisma/client';
import { injectable } from 'tsyringe';
import {
  IEmployeeSalaryPaymentRepository,
  EmployeeSalaryPaymentFilters,
} from '../../../domain/interfaces/employee-salary-payment-repository.interface';
import { EmployeeSalaryPayment } from '../../../domain/entities/employee-salary-payment.entity';

@injectable()
export class EmployeeSalaryPaymentRepository
  implements IEmployeeSalaryPaymentRepository
{
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<EmployeeSalaryPayment | null> {
    const payment = await this.prisma.employeeSalaryPayment.findUnique({
      where: { id },
    });

    if (!payment) {
      return null;
    }

    return EmployeeSalaryPayment.fromPrisma(payment);
  }

  async findAll(
    filters?: EmployeeSalaryPaymentFilters,
    pagination?: { skip?: number; take?: number }
  ): Promise<EmployeeSalaryPayment[]> {
    const where: any = {};

    if (filters?.userId) {
      where.userId = filters.userId;
    }

    if (filters?.paymentMethod) {
      where.paymentMethod = filters.paymentMethod;
    }

    if (filters?.dateFrom || filters?.dateTo) {
      where.date = {};
      if (filters.dateFrom) {
        where.date.gte = filters.dateFrom;
      }
      if (filters.dateTo) {
        where.date.lte = filters.dateTo;
      }
    }

    const payments = await this.prisma.employeeSalaryPayment.findMany({
      where,
      orderBy: {
        date: 'desc',
      },
      skip: pagination?.skip,
      take: pagination?.take,
    });

    return payments.map((payment) => EmployeeSalaryPayment.fromPrisma(payment));
  }

  async count(filters?: EmployeeSalaryPaymentFilters): Promise<number> {
    const where: any = {};

    if (filters?.userId) {
      where.userId = filters.userId;
    }

    if (filters?.paymentMethod) {
      where.paymentMethod = filters.paymentMethod;
    }

    if (filters?.dateFrom || filters?.dateTo) {
      where.date = {};
      if (filters.dateFrom) {
        where.date.gte = filters.dateFrom;
      }
      if (filters.dateTo) {
        where.date.lte = filters.dateTo;
      }
    }

    return await this.prisma.employeeSalaryPayment.count({ where });
  }

  async create(data: {
    userId: string;
    amount: number;
    paymentMethod: number;
    date: Date;
  }): Promise<EmployeeSalaryPayment> {
    const payment = await this.prisma.employeeSalaryPayment.create({
      data: {
        userId: data.userId,
        amount: data.amount,
        paymentMethod: data.paymentMethod,
        date: data.date,
      },
    });

    return EmployeeSalaryPayment.fromPrisma(payment);
  }

  async update(
    id: string,
    data: {
      amount?: number;
      paymentMethod?: number;
      date?: Date;
    }
  ): Promise<EmployeeSalaryPayment> {
    const updateData: any = {};

    if (data.amount !== undefined) {
      updateData.amount = data.amount;
    }

    if (data.paymentMethod !== undefined) {
      updateData.paymentMethod = data.paymentMethod;
    }

    if (data.date !== undefined) {
      updateData.date = data.date;
    }

    const payment = await this.prisma.employeeSalaryPayment.update({
      where: { id },
      data: updateData,
    });

    return EmployeeSalaryPayment.fromPrisma(payment);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.employeeSalaryPayment.delete({
      where: { id },
    });
  }
}

