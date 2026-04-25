import { ExpenseType } from '@prisma/client';

export class Expense {
  constructor(
    public readonly id: string,
    public readonly title: string,
    public readonly type: ExpenseType,
    public readonly date: Date,
    public readonly total: number,
    public readonly subtotal: number,
    public readonly iva: number,
    public readonly description: string | null,
    public readonly paymentMethod: number, // 1: Cash, 2: Transfer, 3: Card, 4: QR Mercado Pago
    public readonly userId: string | null,
    public readonly paymentId: string | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}

  static fromPrisma(data: any): Expense {
    return new Expense(
      data.id,
      data.title,
      data.type,
      data.date,
      Number(data.total),
      Number(data.subtotal),
      Number(data.iva),
      data.description,
      data.paymentMethod,
      data.userId,
      data.paymentId,
      data.createdAt,
      data.updatedAt
    );
  }

  isMerchandise(): boolean {
    return this.type === ExpenseType.MERCHANDISE;
  }
}

