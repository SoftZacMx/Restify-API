import { z } from 'zod';

const timeField = z
  .string()
  .regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Formato inválido. Use HH:mm (ej. 08:00)')
  .optional()
  .nullable();

export const createBranchSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido').max(200),
  state: z.string().min(1, 'El estado es requerido').max(100),
  city: z.string().min(1, 'La ciudad es requerida').max(100),
  street: z.string().min(1, 'La calle es requerida').max(200),
  exteriorNumber: z.string().min(1, 'El número exterior es requerido').max(20),
  phone: z.string().min(1, 'El teléfono es requerido').max(30),
  rfc: z.string().max(20).optional().nullable(),
  logoUrl: z.string().url('Logo debe ser una URL válida').max(500).optional().nullable(),
  startOperations: timeField,
  endOperations: timeField,
  timezone: z.string().min(1).max(64).default('America/Mexico_City'),
  currency: z.string().min(1).max(8).optional(),
  ticketConfig: z.record(z.unknown()).optional().nullable(),
  paymentConfig: z.string().max(10000).optional().nullable(),
});

export const updateBranchSchema = createBranchSchema.partial();

export const listBranchesQuerySchema = z
  .object({
    includeDisabled: z.enum(['true', 'false']).optional(),
  })
  .transform((query) => ({
    includeDisabled: query.includeDisabled === 'true',
  }));

export const branchIdParamSchema = z.object({
  branch_id: z.string().uuid('ID de sucursal inválido'),
});

export const publicBranchSlugParamSchema = z.object({
  slug: z
    .string()
    .min(1, 'Slug requerido')
    .max(60, 'Slug demasiado largo')
    .regex(/^[a-z0-9-]+$/, 'Slug inválido'),
});

export type CreateBranchInput = z.infer<typeof createBranchSchema>;
export type UpdateBranchInput = z.infer<typeof updateBranchSchema>;
export type ListBranchesQuery = z.infer<typeof listBranchesQuerySchema>;
export type BranchIdParam = z.infer<typeof branchIdParamSchema>;
