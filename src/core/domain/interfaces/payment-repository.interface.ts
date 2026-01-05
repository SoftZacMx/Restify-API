import { Payment } from '../entities/payment.entity';
import { PaymentStatus, PaymentMethod } from '@prisma/client';

export interface PaymentFilters {
  orderId?: string;
  userId?: string;
  status?: PaymentStatus;
  paymentMethod?: PaymentMethod;
  dateFrom?: Date;
  dateTo?: Date;
}

export interface IPaymentRepository {
  findById(id: string): Promise<Payment | null>;
  findByGatewayTransactionId(gatewayTransactionId: string): Promise<Payment | null>;
  findAll(filters?: PaymentFilters): Promise<Payment[]>;
  create(data: {
    orderId?: string | null;
    userId: string;
    amount: number;
    currency?: string;
    status: PaymentStatus;
    paymentMethod: PaymentMethod;
    gateway?: string | null;
    gatewayTransactionId?: string | null;
    metadata?: any | null;
  }): Promise<Payment>;
  update(id: string, data: {
    status?: PaymentStatus;
    gatewayTransactionId?: string | null;
    metadata?: any | null;
  }): Promise<Payment>;
  delete(id: string): Promise<void>;
}

