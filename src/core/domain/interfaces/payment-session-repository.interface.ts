import { PaymentSession } from '../entities/payment-session.entity';

export interface IPaymentSessionRepository {
  findById(id: string): Promise<PaymentSession | null>;
  findByPaymentId(paymentId: string): Promise<PaymentSession | null>;
  create(data: {
    paymentId: string;
    clientSecret: string;
    connectionId?: string | null;
    expiresAt: Date;
  }): Promise<PaymentSession>;
  update(id: string, data: {
    connectionId?: string | null;
  }): Promise<PaymentSession>;
  delete(id: string): Promise<void>;
  deleteByPaymentId(paymentId: string): Promise<void>;
}

