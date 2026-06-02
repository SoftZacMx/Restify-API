import { z } from 'zod';
import { StockMovementType, UnitOfMeasure } from '@prisma/client';

const unitOfMeasureEnum = z.nativeEnum(UnitOfMeasure);
const stockMovementTypeEnum = z.nativeEnum(StockMovementType);
const wasteReasonEnum = z.enum(['EXPIRED', 'BROKEN', 'THEFT', 'OTHER']);

const dateLike = z.union([z.string(), z.date()]).transform((v) => new Date(v));

// ── Stock summary listing
export const listStockQuerySchema = z.object({
  search: z.string().optional(),
  lowStock: z
    .union([z.string(), z.boolean()])
    .optional()
    .transform((v) => (typeof v === 'string' ? v === 'true' : v)),
});

// ── Movements listing (general or per product)
export const listMovementsQuerySchema = z.object({
  productId: z.string().uuid().optional(),
  type: stockMovementTypeEnum.optional(),
  reason: z.string().optional(),
  from: dateLike.optional(),
  to: dateLike.optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export const productIdParamsSchema = z.object({
  product_id: z.string().uuid('Invalid product ID format'),
});

// ── Waste
export const recordWasteSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().positive('quantity must be > 0'),
  reason: wasteReasonEnum,
  notes: z.string().max(500).optional().nullable(),
});

// ── Adjustment
export const recordAdjustmentSchema = z.object({
  productId: z.string().uuid(),
  newStock: z.number().min(0, 'newStock must be >= 0'),
  reason: z.string().min(1, 'reason is required').max(120),
  notes: z.string().max(500).optional().nullable(),
});

// ── Stock config (PATCH /api/products/:id/stock-config)
export const updateStockConfigSchema = z.object({
  trackStock: z.boolean().optional(),
  unitOfMeasure: unitOfMeasureEnum.optional().nullable(),
  minStockAlert: z.number().min(0).optional().nullable(),
});

export type ListStockQuery = z.infer<typeof listStockQuerySchema>;
export type ListMovementsQuery = z.infer<typeof listMovementsQuerySchema>;
export type RecordWasteInput = z.infer<typeof recordWasteSchema>;
export type RecordAdjustmentInput = z.infer<typeof recordAdjustmentSchema>;
export type UpdateStockConfigInput = z.infer<typeof updateStockConfigSchema>;
