import { PaymentMethod } from '@prisma/client';

export class PaymentDifferentiation {
  constructor(
    public readonly id: string,
    public readonly orderId: string,
    public readonly firstPaymentAmount: number,
    public readonly firstPaymentMethod: PaymentMethod,
    public readonly secondPaymentAmount: number,
    public readonly secondPaymentMethod: PaymentMethod,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}
}

