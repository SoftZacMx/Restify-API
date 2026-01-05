export class EmployeeSalaryPayment {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly amount: number,
    public readonly paymentMethod: number, // 1: Cash, 2: Transfer, 3: Card
    public readonly date: Date,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}

  static fromPrisma(data: any): EmployeeSalaryPayment {
    return new EmployeeSalaryPayment(
      data.id,
      data.userId,
      Number(data.amount),
      data.paymentMethod,
      data.date,
      data.createdAt,
      data.updatedAt
    );
  }
}

