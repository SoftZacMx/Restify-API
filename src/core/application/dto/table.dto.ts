import { z } from 'zod';

const tableNameSchema = z
  .string()
  .trim()
  .min(1, 'El nombre de la mesa es requerido')
  .max(64, 'El nombre no puede exceder 64 caracteres');

// Create Table Schema
export const createTableSchema = z.object({
  name: tableNameSchema,
  status: z.boolean().default(true),
  availabilityStatus: z.boolean().default(true),
  userId: z.string().uuid('Invalid user ID format'),
});

// Update Table Schema (all fields optional except those that shouldn't change)
export const updateTableSchema = z.object({
  name: tableNameSchema.optional(),
  status: z.boolean().optional(),
  availabilityStatus: z.boolean().optional(),
});

// Get Table Schema (path parameter)
export const getTableSchema = z.object({
  table_id: z.string().uuid('Invalid table ID format'),
});

// List Tables Schema (query parameters)
export const listTablesSchema = z.object({
  status: z.string().transform((val) => {
    if (val === 'true') return true;
    if (val === 'false') return false;
    return undefined;
  }).optional(),
  availabilityStatus: z.string().transform((val) => {
    if (val === 'true') return true;
    if (val === 'false') return false;
    return undefined;
  }).optional(),
  userId: z.string().uuid('Invalid user ID format').optional(),
  name: z.string().trim().min(1).optional(),
});

// Delete Table Schema (path parameter)
export const deleteTableSchema = z.object({
  table_id: z.string().uuid('Invalid table ID format'),
});

// Type exports
export type CreateTableInput = z.infer<typeof createTableSchema>;
export type UpdateTableInput = z.infer<typeof updateTableSchema>;
export type GetTableInput = z.infer<typeof getTableSchema>;
export type ListTablesInput = z.infer<typeof listTablesSchema>;
export type DeleteTableInput = z.infer<typeof deleteTableSchema>;
