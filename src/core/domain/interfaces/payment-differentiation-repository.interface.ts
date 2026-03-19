import { PaymentDifferentiation } from '../entities/payment-differentiation.entity';
import { PaymentMethod } from '@prisma/client';

export interface IPaymentDifferentiationRepository {
  findById(id: string): Promise<PaymentDifferentiation | null>;
  findByOrderId(orderId: string): Promise<PaymentDifferentiation | null>;
  /** Carga todas las diferenciaciones para un conjunto de órdenes (p. ej. reportes). */
  findByOrderIds(orderIds: string[]): Promise<PaymentDifferentiation[]>;
  create(data: {
    orderId: string;
    firstPaymentAmount: number;
    firstPaymentMethod: PaymentMethod;
    secondPaymentAmount: number;
    secondPaymentMethod: PaymentMethod;
  }): Promise<PaymentDifferentiation>;
  update(id: string, data: {
    firstPaymentAmount?: number;
    firstPaymentMethod?: PaymentMethod;
    secondPaymentAmount?: number;
    secondPaymentMethod?: PaymentMethod;
  }): Promise<PaymentDifferentiation>;
  delete(id: string): Promise<void>;
  deleteByOrderId(orderId: string): Promise<void>;
}

