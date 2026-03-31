import { container } from 'tsyringe';
import { ExpenseRepository } from '../../database/repositories/expense.repository';
import { IExpenseRepository } from '../../../domain/interfaces/expense-repository.interface';
import { EmployeeSalaryPaymentRepository } from '../../database/repositories/employee-salary-payment.repository';
import { IEmployeeSalaryPaymentRepository } from '../../../domain/interfaces/employee-salary-payment-repository.interface';
import { prismaClient } from './prisma.module';

container.register<IExpenseRepository>('IExpenseRepository', {
  useFactory: () => new ExpenseRepository(prismaClient),
});

container.register<IEmployeeSalaryPaymentRepository>('IEmployeeSalaryPaymentRepository', {
  useFactory: () => new EmployeeSalaryPaymentRepository(prismaClient),
});
