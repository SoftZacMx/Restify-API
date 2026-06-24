export type BranchStatus = 'active' | 'disabled';

export class Branch {
  constructor(
    public readonly id: string,
    public readonly organizationId: string,
    public readonly name: string,
    public readonly state: string,
    public readonly city: string,
    public readonly street: string,
    public readonly exteriorNumber: string,
    public readonly phone: string,
    public readonly rfc: string | null,
    public readonly logoUrl: string | null,
    public readonly startOperations: string | null,
    public readonly endOperations: string | null,
    public readonly ticketConfig: unknown | null,
    public readonly paymentConfig: string | null,
    public readonly timezone: string,
    public readonly currency: string,
    public readonly status: BranchStatus,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
    public readonly deletedAt: Date | null,
    public readonly slug: string | null = null
  ) {}

  isActive(): boolean {
    return this.status === 'active';
  }
}
