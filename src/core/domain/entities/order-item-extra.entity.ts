export class OrderItemExtra {
  constructor(
    public readonly id: string,
    public readonly orderId: string,
    public readonly orderItemId: string,
    public readonly extraId: string,
    public readonly quantity: number,
    public readonly price: number,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}
}
