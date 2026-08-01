import { Prisma, UnitOfMeasure } from '@prisma/client';
import { AddRecipeItemUseCase } from '../../../../src/core/application/use-cases/recipes/add-recipe-item.use-case';
import { RecipeService } from '../../../../src/core/application/services/recipe.service';

function makeIngredient(overrides: Record<string, any> = {}) {
  return {
    id: 'ing-1',
    menuItemId: 'mi-1',
    productId: 'prod-1',
    quantity: new Prisma.Decimal(2.5),
    unit: UnitOfMeasure.G,
    branchId: 'branch-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('AddRecipeItemUseCase', () => {
  let useCase: AddRecipeItemUseCase;
  let recipeService: jest.Mocked<RecipeService>;

  beforeEach(() => {
    recipeService = {
      addIngredient: jest.fn(),
      getRecipe: jest.fn(),
      replaceRecipe: jest.fn(),
      updateIngredientQuantity: jest.fn(),
      removeIngredient: jest.fn(),
    } as unknown as jest.Mocked<RecipeService>;
    useCase = new AddRecipeItemUseCase(recipeService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('agrega un ingrediente con unidad explícita', async () => {
      recipeService.addIngredient.mockResolvedValue(makeIngredient() as any);

      const result = await useCase.execute('mi-1', {
        productId: 'prod-1',
        quantity: 2.5,
        unit: UnitOfMeasure.G,
      });

      expect(recipeService.addIngredient).toHaveBeenCalledWith('mi-1', 'prod-1', 2.5, UnitOfMeasure.G);
      expect(result).toEqual({
        menuItemId: 'mi-1',
        productId: 'prod-1',
        quantity: '2.5',
        unit: UnitOfMeasure.G,
      });
    });

    it('pasa null como unit cuando no se declara', async () => {
      recipeService.addIngredient.mockResolvedValue(
        makeIngredient({ quantity: new Prisma.Decimal(1), unit: null }) as any
      );

      const result = await useCase.execute('mi-1', { productId: 'prod-1', quantity: 1 });

      expect(recipeService.addIngredient).toHaveBeenCalledWith('mi-1', 'prod-1', 1, null);
      expect(result).toEqual({
        menuItemId: 'mi-1',
        productId: 'prod-1',
        quantity: '1',
        unit: null,
      });
    });
  });
});
