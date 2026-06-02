import type { UnitOfMeasure } from '@prisma/client';

export class Product {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly description: string | null,
    public readonly registrationDate: Date,
    public readonly status: boolean,
    public readonly userId: string,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
    // Stock config (Fase 6.3) — defaults seguros para productos pre-migración / sin tracking
    public readonly trackStock: boolean = false,
    public readonly unitOfMeasure: UnitOfMeasure | null = null,
    public readonly minStockAlert: number | null = null
  ) {}
}

