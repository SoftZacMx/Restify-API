import { EmployeeSalaryPayment } from '../entities/employee-salary-payment.entity';

export interface EmployeeSalaryPaymentFilters {
  userId?: string;
  paymentMethod?: number;
  dateFrom?: Date;
  dateTo?: Date;
}

export interface IEmployeeSalaryPaymentRepository {
  findById(id: string): Promise<EmployeeSalaryPayment | null>;
  findAll(
    filters?: EmployeeSalaryPaymentFilters,
    pagination?: { skip?: number; take?: number }
  ): Promise<EmployeeSalaryPayment[]>;
  count(filters?: EmployeeSalaryPaymentFilters): Promise<number>;
  create(data: {
    userId: string;
    amount: number;
    paymentMethod: number;
    date: Date;
  }): Promise<EmployeeSalaryPayment>;
  update(
    id: string,
    data: {
      amount?: number;
      paymentMethod?: number;
      date?: Date;
    }
  ): Promise<EmployeeSalaryPayment>;
  delete(id: string): Promise<void>;
}

