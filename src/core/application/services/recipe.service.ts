import { inject, injectable } from 'tsyringe';
import { MenuItemIngredient, Prisma, PrismaClient, UnitOfMeasure } from '@prisma/client';
import { PrismaService } from '../../infrastructure/config/prisma.config';
import { AppError } from '../../../shared/errors';
import { unitsCompatible } from '../../../shared/utils/unit-conversion.util';

export interface RecipeIngredientInput {
  productId: string;
  quantity: Prisma.Decimal | number | string;
  /** Unidad explícita del ingrediente. Si null/undefined, se interpreta en la unidad del producto. */
  unit?: UnitOfMeasure | null;
}

export interface RecipeIngredientView {
  productId: string;
  productName: string;
  quantity: Prisma.Decimal;
  /** Unidad de medida del ingrediente (si null, hereda la del producto). */
  unit: UnitOfMeasure | null;
  /** Unidad base del producto (referencia). */
  productUnitOfMeasure: UnitOfMeasure | null;
}

/**
 * Operaciones sobre la receta (`menu_item_ingredients`) de un MenuItem.
 *
 * Reglas de negocio:
 * - Mutua exclusión: un MenuItem no puede tener receta Y `productId` set al mismo tiempo
 *   (ítem directo). Se valida en cada operación que agregue ingredientes.
 * - Unicidad: un mismo product_id no puede aparecer dos veces en la misma receta
 *   (constraint `@@unique([menuItemId, productId])` en DB).
 */
@injectable()
export class RecipeService {
  private readonly prisma: PrismaClient;

  constructor(@inject(PrismaService) prismaService: PrismaService) {
    this.prisma = prismaService.getClient();
  }

  async getRecipe(menuItemId: string): Promise<RecipeIngredientView[]> {
    const menuItem = await this.prisma.menuItem.findUnique({ where: { id: menuItemId } });
    if (!menuItem) {
      throw new AppError('MENU_ITEM_NOT_FOUND', `MenuItem ${menuItemId} not found`);
    }

    const rows = await this.prisma.menuItemIngredient.findMany({
      where: { menuItemId },
      include: { product: true },
      orderBy: { createdAt: 'asc' },
    });

    return rows.map((r) => ({
      productId: r.productId,
      productName: r.product.name,
      quantity: r.quantity,
      unit: r.unit,
      productUnitOfMeasure: r.product.unitOfMeasure,
    }));
  }

  /**
   * Reemplaza la receta completa. Borra todos los ingredientes existentes y crea los nuevos.
   * Útil para edición masiva en UI.
   */
  async replaceRecipe(menuItemId: string, ingredients: RecipeIngredientInput[]): Promise<MenuItemIngredient[]> {
    if (ingredients.length === 0) {
      throw new AppError('VALIDATION_ERROR', 'recipe must have at least one ingredient (use DELETE to remove)');
    }

    await this.assertMenuItemExistsAndCanHaveRecipe(menuItemId);
    const productMap = await this.assertProductsExistAndGetUnits(
      ingredients.map((i) => i.productId)
    );
    this.assertNoDuplicateProducts(ingredients);
    this.assertUnitsCompatible(ingredients, productMap);

    return this.prisma.$transaction(async (tx) => {
      await tx.menuItemIngredient.deleteMany({ where: { menuItemId } });
      const created: MenuItemIngredient[] = [];
      for (const ing of ingredients) {
        const row = await tx.menuItemIngredient.create({
          data: {
            menuItemId,
            productId: ing.productId,
            quantity: new Prisma.Decimal(ing.quantity),
            unit: ing.unit ?? null,
          },
        });
        created.push(row);
      }
      return created;
    });
  }

  async addIngredient(
    menuItemId: string,
    productId: string,
    quantity: Prisma.Decimal | number,
    unit: UnitOfMeasure | null = null
  ): Promise<MenuItemIngredient> {
    await this.assertMenuItemExistsAndCanHaveRecipe(menuItemId);
    const productMap = await this.assertProductsExistAndGetUnits([productId]);
    this.assertUnitsCompatible([{ productId, quantity, unit }], productMap);

    const existing = await this.prisma.menuItemIngredient.findUnique({
      where: { menuItemId_productId: { menuItemId, productId } },
    });
    if (existing) {
      throw new AppError('INGREDIENT_ALREADY_EXISTS', `Product ${productId} is already in this recipe`);
    }

    return this.prisma.menuItemIngredient.create({
      data: { menuItemId, productId, quantity: new Prisma.Decimal(quantity), unit },
    });
  }

  async updateIngredientQuantity(
    menuItemId: string,
    productId: string,
    quantity: Prisma.Decimal | number,
    unit?: UnitOfMeasure | null
  ): Promise<MenuItemIngredient> {
    const existing = await this.prisma.menuItemIngredient.findUnique({
      where: { menuItemId_productId: { menuItemId, productId } },
    });
    if (!existing) {
      throw new AppError('INGREDIENT_NOT_FOUND', `Product ${productId} is not in this recipe`);
    }

    if (unit !== undefined) {
      const productMap = await this.assertProductsExistAndGetUnits([productId]);
      this.assertUnitsCompatible([{ productId, quantity, unit }], productMap);
    }

    return this.prisma.menuItemIngredient.update({
      where: { menuItemId_productId: { menuItemId, productId } },
      data: {
        quantity: new Prisma.Decimal(quantity),
        ...(unit !== undefined && { unit }),
      },
    });
  }

  async removeIngredient(menuItemId: string, productId: string): Promise<void> {
    const existing = await this.prisma.menuItemIngredient.findUnique({
      where: { menuItemId_productId: { menuItemId, productId } },
    });
    if (!existing) {
      throw new AppError('INGREDIENT_NOT_FOUND', `Product ${productId} is not in this recipe`);
    }

    await this.prisma.menuItemIngredient.delete({
      where: { menuItemId_productId: { menuItemId, productId } },
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Helpers
  // ──────────────────────────────────────────────────────────────────────────

  private async assertMenuItemExistsAndCanHaveRecipe(menuItemId: string): Promise<void> {
    const menuItem = await this.prisma.menuItem.findUnique({ where: { id: menuItemId } });
    if (!menuItem) {
      throw new AppError('MENU_ITEM_NOT_FOUND', `MenuItem ${menuItemId} not found`);
    }
    if (menuItem.productId) {
      throw new AppError(
        'RECIPE_NOT_ALLOWED_ON_DIRECT_ITEM',
        'MenuItem is configured as direct (linked product). Remove productId before adding a recipe.'
      );
    }
  }

  private async assertProductsExistAndGetUnits(
    productIds: string[]
  ): Promise<Map<string, UnitOfMeasure | null>> {
    const unique = [...new Set(productIds)];
    const found = await this.prisma.product.findMany({
      where: { id: { in: unique } },
      select: { id: true, unitOfMeasure: true },
    });
    if (found.length !== unique.length) {
      const missing = unique.filter((id) => !found.some((p) => p.id === id));
      throw new AppError('PRODUCT_NOT_FOUND', `Products not found: ${missing.join(', ')}`);
    }
    return new Map(found.map((p) => [p.id, p.unitOfMeasure]));
  }

  private assertNoDuplicateProducts(ingredients: RecipeIngredientInput[]): void {
    const seen = new Set<string>();
    for (const ing of ingredients) {
      if (seen.has(ing.productId)) {
        throw new AppError('DUPLICATE_INGREDIENT', `Product ${ing.productId} appears more than once in the recipe`);
      }
      seen.add(ing.productId);
    }
  }

  /**
   * Si el ingrediente declara una `unit`, debe ser compatible con la del producto
   * (KG↔G y L↔ML son compatibles; PCS y OTHER solo idénticas).
   */
  private assertUnitsCompatible(
    ingredients: RecipeIngredientInput[],
    productUnits: Map<string, UnitOfMeasure | null>
  ): void {
    for (const ing of ingredients) {
      if (!ing.unit) continue;
      const productUnit = productUnits.get(ing.productId) ?? null;
      if (!productUnit) continue;
      if (!unitsCompatible(ing.unit, productUnit)) {
        throw new AppError(
          'INCOMPATIBLE_UNIT',
          `La unidad ${ing.unit} no es compatible con la unidad del producto (${productUnit}). Solo se pueden mezclar unidades de la misma familia (KG↔G, L↔ML).`
        );
      }
    }
  }
}
