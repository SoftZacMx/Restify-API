export class OrderItem {
  constructor(
    public readonly id: string,
    public readonly quantity: number,
    public readonly price: number,
    public readonly orderId: string,
    public readonly productId: string | null,
    public readonly menuItemId: string | null,
    public readonly note: string | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}
}


