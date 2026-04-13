import { PaymentStatus, PaymentMethod, PaymentGateway } from '@prisma/client';

export class Payment {
  constructor(
    public readonly id: string,
    public readonly orderId: string | null,
    public readonly userId: string | null,
    public readonly amount: number,
    public readonly currency: string,
    public readonly status: PaymentStatus,
    public readonly paymentMethod: PaymentMethod,
    public readonly gateway: PaymentGateway | null,
    public readonly gatewayTransactionId: string | null,
    public readonly metadata: any | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}
}

