export class Company {
  constructor(
    public readonly id: string,
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
    /** JSON crudo desde BDD; usar mergeTicketPrintConfig al exponer por API */
    public readonly ticketConfig: unknown | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}
}
