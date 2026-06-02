import { inject, injectable } from 'tsyringe';
import { RecipeService } from '../../services/recipe.service';
import { UpdateRecipeItemInput } from '../../dto/recipe.dto';

@injectable()
export class UpdateRecipeItemUseCase {
  constructor(@inject(RecipeService) private readonly recipeService: RecipeService) {}

  async execute(menuItemId: string, productId: string, input: UpdateRecipeItemInput) {
    const ingredient = await this.recipeService.updateIngredientQuantity(
      menuItemId,
      productId,
      input.quantity,
      input.unit ?? undefined
    );
    return {
      menuItemId,
      productId: ingredient.productId,
      quantity: ingredient.quantity.toString(),
      unit: ingredient.unit,
    };
  }
}
