export class ExpenseItem {
  constructor(
    public readonly id: string,
    public readonly expenseId: string,
    public readonly productId: string,
    public readonly amount: number,
    public readonly subtotal: number,
    public readonly total: number,
    public readonly unitOfMeasure: string | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}

  static fromPrisma(data: any): ExpenseItem {
    return new ExpenseItem(
      data.id,
      data.expenseId,
      data.productId,
      Number(data.amount),
      Number(data.subtotal),
      Number(data.total),
      data.unitOfMeasure,
      data.createdAt,
      data.updatedAt
    );
  }
}

