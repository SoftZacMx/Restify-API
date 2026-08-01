import { Prisma, UnitOfMeasure } from '@prisma/client';
import { UpdateRecipeItemUseCase } from '../../../../src/core/application/use-cases/recipes/update-recipe-item.use-case';
import { RecipeService } from '../../../../src/core/application/services/recipe.service';

function makeIngredient(overrides: Record<string, any> = {}) {
  return {
    id: 'ing-1',
    menuItemId: 'mi-1',
    productId: 'prod-1',
    quantity: new Prisma.Decimal(3),
    unit: UnitOfMeasure.G,
    branchId: 'branch-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('UpdateRecipeItemUseCase', () => {
  let useCase: UpdateRecipeItemUseCase;
  let recipeService: jest.Mocked<RecipeService>;

  beforeEach(() => {
    recipeService = {
      addIngredient: jest.fn(),
      getRecipe: jest.fn(),
      replaceRecipe: jest.fn(),
      updateIngredientQuantity: jest.fn(),
      removeIngredient: jest.fn(),
    } as unknown as jest.Mocked<RecipeService>;
    useCase = new UpdateRecipeItemUseCase(recipeService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('actualiza quantity y unit cuando la unidad viene definida', async () => {
      recipeService.updateIngredientQuantity.mockResolvedValue(makeIngredient() as any);

      const result = await useCase.execute('mi-1', 'prod-1', {
        quantity: 3,
        unit: UnitOfMeasure.G,
      });

      expect(recipeService.updateIngredientQuantity).toHaveBeenCalledWith('mi-1', 'prod-1', 3, UnitOfMeasure.G);
      expect(result).toEqual({
        menuItemId: 'mi-1',
        productId: 'prod-1',
        quantity: '3',
        unit: UnitOfMeasure.G,
      });
    });

    it('no pasa unit cuando viene null (se convierte en undefined)', async () => {
      recipeService.updateIngredientQuantity.mockResolvedValue(
        makeIngredient({ unit: null }) as any
      );

      const result = await useCase.execute('mi-1', 'prod-1', { quantity: 3, unit: null });

      expect(recipeService.updateIngredientQuantity).toHaveBeenCalledWith('mi-1', 'prod-1', 3, undefined);
      expect(result).toEqual({
        menuItemId: 'mi-1',
        productId: 'prod-1',
        quantity: '3',
        unit: null,
      });
    });
  });
});
