export class OrderMenuItem {
  constructor(
    public readonly id: string,
    public readonly orderId: string,
    public readonly menuItemId: string,
    public readonly amount: number,
    public readonly unitPrice: number,
    public readonly note: string | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}
}


