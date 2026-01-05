export class MenuCategory {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly status: boolean,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}
}

