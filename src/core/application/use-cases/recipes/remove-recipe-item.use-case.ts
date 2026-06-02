import { inject, injectable } from 'tsyringe';
import { RecipeService } from '../../services/recipe.service';

@injectable()
export class RemoveRecipeItemUseCase {
  constructor(@inject(RecipeService) private readonly recipeService: RecipeService) {}

  async execute(menuItemId: string, productId: string): Promise<void> {
    await this.recipeService.removeIngredient(menuItemId, productId);
  }
}
