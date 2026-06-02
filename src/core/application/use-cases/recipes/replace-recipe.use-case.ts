import { inject, injectable } from 'tsyringe';
import { RecipeService } from '../../services/recipe.service';
import { ReplaceRecipeInput } from '../../dto/recipe.dto';

@injectable()
export class ReplaceRecipeUseCase {
  constructor(@inject(RecipeService) private readonly recipeService: RecipeService) {}

  async execute(menuItemId: string, input: ReplaceRecipeInput) {
    const created = await this.recipeService.replaceRecipe(menuItemId, input.ingredients);
    return {
      menuItemId,
      ingredients: created.map((i) => ({
        productId: i.productId,
        quantity: i.quantity.toString(),
        unit: i.unit,
      })),
    };
  }
}
