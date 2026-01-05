export class PaymentSession {
  constructor(
    public readonly id: string,
    public readonly paymentId: string,
    public readonly clientSecret: string,
    public readonly connectionId: string | null,
    public readonly expiresAt: Date,
    public readonly createdAt: Date
  ) {}
}

