import { z } from 'zod';

// Create Product Schema
export const createProductSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200, 'Name is too long'),
  description: z.string().max(1000, 'Description is too long').optional().nullable(),
  status: z.boolean().default(true),
  userId: z.string().uuid('Invalid user ID format'),
});

// Update Product Schema (all fields optional except those that shouldn't change)
export const updateProductSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200, 'Name is too long').optional(),
  description: z.string().max(1000, 'Description is too long').optional().nullable(),
  status: z.boolean().optional(),
});

// Get Product Schema (path parameter)
export const getProductSchema = z.object({
  product_id: z.string().uuid('Invalid product ID format'),
});

// List Products Schema (query parameters)
export const listProductsSchema = z.object({
  status: z.string().transform((val) => {
    if (val === 'true') return true;
    if (val === 'false') return false;
    return undefined;
  }).optional(),
  userId: z.string().uuid('Invalid user ID format').optional(),
  search: z.string().optional(), // Search by name
});

// Delete Product Schema (path parameter)
export const deleteProductSchema = z.object({
  product_id: z.string().uuid('Invalid product ID format'),
});

// Type exports
export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type GetProductInput = z.infer<typeof getProductSchema>;
export type ListProductsInput = z.infer<typeof listProductsSchema>;
export type DeleteProductInput = z.infer<typeof deleteProductSchema>;

