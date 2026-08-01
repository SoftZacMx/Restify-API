import { Prisma, UnitOfMeasure } from '@prisma/client';
import { GetRecipeUseCase } from '../../../../src/core/application/use-cases/recipes/get-recipe.use-case';
import { RecipeService } from '../../../../src/core/application/services/recipe.service';

function makeIngredientView(overrides: Record<string, any> = {}) {
  return {
    productId: 'prod-1',
    productName: 'Harina',
    quantity: new Prisma.Decimal(2.5),
    unit: UnitOfMeasure.G,
    productUnitOfMeasure: UnitOfMeasure.KG,
    ...overrides,
  };
}

describe('GetRecipeUseCase', () => {
  let useCase: GetRecipeUseCase;
  let recipeService: jest.Mocked<RecipeService>;

  beforeEach(() => {
    recipeService = {
      addIngredient: jest.fn(),
      getRecipe: jest.fn(),
      replaceRecipe: jest.fn(),
      updateIngredientQuantity: jest.fn(),
      removeIngredient: jest.fn(),
    } as unknown as jest.Mocked<RecipeService>;
    useCase = new GetRecipeUseCase(recipeService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('usa la unidad del ingrediente cuando está definida', async () => {
      recipeService.getRecipe.mockResolvedValue([makeIngredientView()] as any);

      const result = await useCase.execute('mi-1');

      expect(recipeService.getRecipe).toHaveBeenCalledWith('mi-1');
      expect(result).toEqual({
        menuItemId: 'mi-1',
        ingredients: [
          {
            productId: 'prod-1',
            productName: 'Harina',
            quantity: '2.5',
            unit: UnitOfMeasure.G,
            productUnitOfMeasure: UnitOfMeasure.KG,
          },
        ],
      });
    });

    it('hereda la unidad del producto cuando el ingrediente no define unit', async () => {
      recipeService.getRecipe.mockResolvedValue([
        makeIngredientView({ unit: null }),
        makeIngredientView({
          productId: 'prod-2',
          productName: 'Queso',
          unit: null,
          productUnitOfMeasure: null,
        }),
      ] as any);

      const result = await useCase.execute('mi-1');

      expect(result.ingredients[0].unit).toBe(UnitOfMeasure.KG);
      expect(result.ingredients[0].productUnitOfMeasure).toBe(UnitOfMeasure.KG);
      expect(result.ingredients[1].unit).toBeNull();
      expect(result.ingredients[1].productName).toBe('Queso');
    });
  });
});
