export class Table {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly userId: string,
    public readonly status: boolean,
    public readonly availabilityStatus: boolean,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}
}
