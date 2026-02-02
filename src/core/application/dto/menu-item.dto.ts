import { z } from 'zod';

// Create Menu Item Schema
export const createMenuItemSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200, 'Name is too long'),
  price: z.number().positive('Price must be positive').multipleOf(0.01, 'Price must have at most 2 decimal places'),
  status: z.boolean().optional(),
  isExtra: z.boolean().optional().default(false), // true = extra/complemento, false = platillo principal
  categoryId: z.string().uuid('Invalid category ID format').optional().nullable(),
  userId: z.string().uuid('Invalid user ID format'),
});

// Update Menu Item Schema
export const updateMenuItemSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200, 'Name is too long').optional(),
  price: z.number().positive('Price must be positive').multipleOf(0.01, 'Price must have at most 2 decimal places').optional(),
  status: z.boolean().optional(),
  isExtra: z.boolean().optional(), // true = extra/complemento, false = platillo principal
  categoryId: z.string().uuid('Invalid category ID format').optional(),
  userId: z.string().uuid('Invalid user ID format').optional(),
});

// Get Menu Item Schema (path parameter)
export const getMenuItemSchema = z.object({
  menu_item_id: z.string().uuid('Invalid menu item ID format'),
});

// List Menu Items Schema (query parameters)
export const listMenuItemsSchema = z.object({
  status: z.string().transform((val) => {
    if (val === 'true') return true;
    if (val === 'false') return false;
    return undefined;
  }).optional(),
  isExtra: z.string().transform((val) => {
    if (val === 'true') return true;
    if (val === 'false') return false;
    return undefined;
  }).optional(),
  categoryId: z.string().uuid('Invalid category ID format').optional(),
  userId: z.string().uuid('Invalid user ID format').optional(),
  search: z.string().optional(),
});

// Delete Menu Item Schema (path parameter)
export const deleteMenuItemSchema = z.object({
  menu_item_id: z.string().uuid('Invalid menu item ID format'),
});

// Type exports
export type CreateMenuItemInput = z.infer<typeof createMenuItemSchema>;
export type UpdateMenuItemInput = z.infer<typeof updateMenuItemSchema>;
export type GetMenuItemInput = z.infer<typeof getMenuItemSchema>;
export type ListMenuItemsInput = z.infer<typeof listMenuItemsSchema>;
export type DeleteMenuItemInput = z.infer<typeof deleteMenuItemSchema>;

