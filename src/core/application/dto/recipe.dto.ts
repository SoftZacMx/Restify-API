import { z } from 'zod';
import { UnitOfMeasure } from '@prisma/client';

const unitOfMeasureEnum = z.nativeEnum(UnitOfMeasure);

const ingredientSchema = z.object({
  productId: z.string().uuid('Invalid product ID format'),
  quantity: z.number().positive('quantity must be > 0'),
  /**
   * Unidad explícita del ingrediente. Si null/omitida se interpreta en la unidad del producto.
   * El backend valida compatibilidad con la unidad del producto (KG↔G, L↔ML).
   */
  unit: unitOfMeasureEnum.optional().nullable(),
});

export const menuItemIdParamsSchema = z.object({
  menu_item_id: z.string().uuid('Invalid menu item ID format'),
});

export const recipeItemParamsSchema = z.object({
  menu_item_id: z.string().uuid('Invalid menu item ID format'),
  product_id: z.string().uuid('Invalid product ID format'),
});

// PUT /api/menu-items/:id/recipe — reemplaza la receta completa
export const replaceRecipeSchema = z.object({
  ingredients: z
    .array(ingredientSchema)
    .min(1, 'recipe must have at least one ingredient'),
});

// POST /api/menu-items/:id/recipe/items — agregar un ingrediente
export const addRecipeItemSchema = ingredientSchema;

// PATCH /api/menu-items/:id/recipe/items/:productId — cambia quantity y opcionalmente unit
export const updateRecipeItemSchema = z.object({
  quantity: z.number().positive('quantity must be > 0'),
  unit: unitOfMeasureEnum.optional().nullable(),
});

export type ReplaceRecipeInput = z.infer<typeof replaceRecipeSchema>;
export type AddRecipeItemInput = z.infer<typeof addRecipeItemSchema>;
export type UpdateRecipeItemInput = z.infer<typeof updateRecipeItemSchema>;
