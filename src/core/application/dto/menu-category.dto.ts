import { z } from 'zod';

// Create Menu Category Schema
export const createMenuCategorySchema = z.object({
  name: z.string().min(1, 'Name is required').max(200, 'Name is too long'),
  status: z.boolean().optional(),
});

// Update Menu Category Schema
export const updateMenuCategorySchema = z.object({
  name: z.string().min(1, 'Name is required').max(200, 'Name is too long').optional(),
  status: z.boolean().optional(),
});

// Get Menu Category Schema (path parameter)
export const getMenuCategorySchema = z.object({
  category_id: z.string().uuid('Invalid category ID format'),
});

// List Menu Categories Schema (query parameters)
export const listMenuCategoriesSchema = z.object({
  status: z.string().transform((val) => {
    if (val === 'true') return true;
    if (val === 'false') return false;
    return undefined;
  }).optional(),
  search: z.string().optional(),
});

// Delete Menu Category Schema (path parameter)
export const deleteMenuCategorySchema = z.object({
  category_id: z.string().uuid('Invalid category ID format'),
});

// Type exports
export type CreateMenuCategoryInput = z.infer<typeof createMenuCategorySchema>;
export type UpdateMenuCategoryInput = z.infer<typeof updateMenuCategorySchema>;
export type GetMenuCategoryInput = z.infer<typeof getMenuCategorySchema>;
export type ListMenuCategoriesInput = z.infer<typeof listMenuCategoriesSchema>;
export type DeleteMenuCategoryInput = z.infer<typeof deleteMenuCategorySchema>;

