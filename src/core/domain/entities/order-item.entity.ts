export class OrderItem {
  constructor(
    public readonly id: string,
    public readonly quantity: number,
    public readonly price: number,
    public readonly orderId: string,
    public readonly productId: string,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}
}


