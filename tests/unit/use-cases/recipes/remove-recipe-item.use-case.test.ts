import { RemoveRecipeItemUseCase } from '../../../../src/core/application/use-cases/recipes/remove-recipe-item.use-case';
import { RecipeService } from '../../../../src/core/application/services/recipe.service';

describe('RemoveRecipeItemUseCase', () => {
  let useCase: RemoveRecipeItemUseCase;
  let recipeService: jest.Mocked<RecipeService>;

  beforeEach(() => {
    recipeService = {
      addIngredient: jest.fn(),
      getRecipe: jest.fn(),
      replaceRecipe: jest.fn(),
      updateIngredientQuantity: jest.fn(),
      removeIngredient: jest.fn(),
    } as unknown as jest.Mocked<RecipeService>;
    useCase = new RemoveRecipeItemUseCase(recipeService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('elimina el ingrediente de la receta', async () => {
      recipeService.removeIngredient.mockResolvedValue(undefined);

      await expect(useCase.execute('mi-1', 'prod-1')).resolves.toBeUndefined();

      expect(recipeService.removeIngredient).toHaveBeenCalledWith('mi-1', 'prod-1');
    });

    it('propaga los errores del servicio', async () => {
      recipeService.removeIngredient.mockRejectedValue(
        Object.assign(new Error('Product prod-1 is not in this recipe'), {
          code: 'INGREDIENT_NOT_FOUND',
        })
      );

      await expect(useCase.execute('mi-1', 'prod-1')).rejects.toMatchObject({
        code: 'INGREDIENT_NOT_FOUND',
      });
    });
  });
});
