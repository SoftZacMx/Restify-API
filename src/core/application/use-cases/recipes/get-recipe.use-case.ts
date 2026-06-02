import { inject, injectable } from 'tsyringe';
import { RecipeService } from '../../services/recipe.service';

@injectable()
export class GetRecipeUseCase {
  constructor(@inject(RecipeService) private readonly recipeService: RecipeService) {}

  async execute(menuItemId: string) {
    const ingredients = await this.recipeService.getRecipe(menuItemId);
    return {
      menuItemId,
      ingredients: ingredients.map((i) => ({
        productId: i.productId,
        productName: i.productName,
        quantity: i.quantity.toString(),
        // unidad efectiva: la del ingrediente si está set, sino la del producto
        unit: i.unit ?? i.productUnitOfMeasure,
        // unidad base del producto (referencia para mostrar al usuario)
        productUnitOfMeasure: i.productUnitOfMeasure,
      })),
    };
  }
}
