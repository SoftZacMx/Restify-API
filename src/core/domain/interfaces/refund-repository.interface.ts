import { Refund } from '../entities/refund.entity';
import { RefundStatus } from '@prisma/client';

export interface RefundFilters {
  paymentId?: string;
  status?: RefundStatus;
  dateFrom?: Date;
  dateTo?: Date;
}

export interface IRefundRepository {
  findById(id: string): Promise<Refund | null>;
  findByPaymentId(paymentId: string): Promise<Refund[]>;
  findAll(filters?: RefundFilters): Promise<Refund[]>;
  create(data: {
    paymentId: string;
    amount: number;
    reason?: string | null;
    gatewayRefundId?: string | null;
    status: RefundStatus;
  }): Promise<Refund>;
  update(id: string, data: {
    status?: RefundStatus;
    gatewayRefundId?: string | null;
    reason?: string | null;
  }): Promise<Refund>;
  delete(id: string): Promise<void>;
}

