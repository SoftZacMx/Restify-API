export class MenuItem {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly price: number,
    public readonly status: boolean,
    public readonly isExtra: boolean,
    public readonly categoryId: string | null,
    public readonly userId: string,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
    // Stock integration (Fase 7 — Bloque D): permite al UI mostrar el indicador
    // "directo / receta / sin tracking" sin pegar el endpoint de receta por cada item.
    public readonly productId: string | null = null,
    public readonly hasRecipe: boolean = false,
    // Transversal — Storage de imágenes (S3): URL pública de la imagen del menu item.
    public readonly imageUrl: string | null = null
  ) {}
}

