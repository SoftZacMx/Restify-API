export class Order {
  constructor(
    public readonly id: string,
    public readonly date: Date,
    public readonly status: boolean,
    public readonly paymentMethod: number | null,
    public readonly total: number,
    public readonly subtotal: number,
    public readonly iva: number,
    public readonly delivered: boolean,
    public readonly tableId: string | null,
    public readonly tip: number,
    public readonly origin: string,
    public readonly client: string | null,
    public readonly paymentDiffer: boolean,
    public readonly note: string | null,
    public readonly userId: string | null,
    public readonly customerName: string | null,
    public readonly customerPhone: string | null,
    public readonly latitude: number | null,
    public readonly longitude: number | null,
    public readonly deliveryAddress: string | null,
    public readonly scheduledAt: Date | null,
    public readonly trackingToken: string | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}
}

