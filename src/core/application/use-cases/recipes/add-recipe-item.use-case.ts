import { inject, injectable } from 'tsyringe';
import { RecipeService } from '../../services/recipe.service';
import { AddRecipeItemInput } from '../../dto/recipe.dto';

@injectable()
export class AddRecipeItemUseCase {
  constructor(@inject(RecipeService) private readonly recipeService: RecipeService) {}

  async execute(menuItemId: string, input: AddRecipeItemInput) {
    const ingredient = await this.recipeService.addIngredient(
      menuItemId,
      input.productId,
      input.quantity,
      input.unit ?? null
    );
    return {
      menuItemId,
      productId: ingredient.productId,
      quantity: ingredient.quantity.toString(),
      unit: ingredient.unit,
    };
  }
}
