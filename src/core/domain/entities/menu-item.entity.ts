export class MenuItem {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly price: number,
    public readonly status: boolean,
    public readonly categoryId: string,
    public readonly userId: string,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}
}

