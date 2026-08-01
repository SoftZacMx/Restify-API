import { Prisma, UnitOfMeasure } from '@prisma/client';
import { ReplaceRecipeUseCase } from '../../../../src/core/application/use-cases/recipes/replace-recipe.use-case';
import { RecipeService } from '../../../../src/core/application/services/recipe.service';

function makeCreatedIngredient(overrides: Record<string, any> = {}) {
  return {
    id: 'ing-1',
    menuItemId: 'mi-1',
    productId: 'prod-1',
    quantity: new Prisma.Decimal(2),
    unit: UnitOfMeasure.G,
    branchId: 'branch-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('ReplaceRecipeUseCase', () => {
  let useCase: ReplaceRecipeUseCase;
  let recipeService: jest.Mocked<RecipeService>;

  beforeEach(() => {
    recipeService = {
      addIngredient: jest.fn(),
      getRecipe: jest.fn(),
      replaceRecipe: jest.fn(),
      updateIngredientQuantity: jest.fn(),
      removeIngredient: jest.fn(),
    } as unknown as jest.Mocked<RecipeService>;
    useCase = new ReplaceRecipeUseCase(recipeService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('reemplaza la receta y mapea los ingredientes creados', async () => {
      recipeService.replaceRecipe.mockResolvedValue([
        makeCreatedIngredient(),
        makeCreatedIngredient({
          productId: 'prod-2',
          quantity: new Prisma.Decimal(500),
          unit: null,
        }),
      ] as any);

      const input = {
        ingredients: [
          { productId: 'prod-1', quantity: 2, unit: UnitOfMeasure.G },
          { productId: 'prod-2', quantity: 500 },
        ],
      };

      const result = await useCase.execute('mi-1', input);

      expect(recipeService.replaceRecipe).toHaveBeenCalledWith('mi-1', input.ingredients);
      expect(result).toEqual({
        menuItemId: 'mi-1',
        ingredients: [
          { productId: 'prod-1', quantity: '2', unit: UnitOfMeasure.G },
          { productId: 'prod-2', quantity: '500', unit: null },
        ],
      });
    });
  });
});
