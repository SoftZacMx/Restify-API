import { Prisma, UnitOfMeasure } from '@prisma/client';
import { RecipeService } from '../../../src/core/application/services/recipe.service';
import { getBranchId } from '../../../src/core/infrastructure/tenant/tenant-context';

let activePrismaClient: any;
jest.mock('../../../src/core/infrastructure/database/prisma/get-prisma', () => ({
  getPrisma: () => activePrismaClient,
}));

jest.mock('../../../src/core/infrastructure/tenant/tenant-context', () => ({
  getOrganizationId: jest.fn(() => 'org-1'),
  getBranchId: jest.fn(() => 'branch-1'),
}));

function createMockPrisma() {
  const mockTx = {
    menuItemIngredient: {
      deleteMany: jest.fn().mockResolvedValue({ count: 2 }),
      create: jest.fn().mockImplementation(({ data }: { data: any }) =>
        Promise.resolve({ id: `ing-${data.productId}`, ...data })
      ),
    },
  };

  const mockClient = {
    menuItem: {
      findUnique: jest.fn(),
    },
    menuItemIngredient: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    product: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn().mockImplementation((cb: Function) => cb(mockTx)),
  };

  activePrismaClient = mockClient;

  return { mockClient, mockTx };
}

function makeMenuItem(overrides: Record<string, any> = {}) {
  return {
    id: 'mi-1',
    name: 'Pizza',
    price: new Prisma.Decimal(120),
    status: true,
    isExtra: false,
    categoryId: 'cat-1',
    userId: 'user-1',
    productId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeIngredientRow(overrides: Record<string, any> = {}) {
  return {
    id: 'ing-1',
    menuItemId: 'mi-1',
    productId: 'prod-1',
    quantity: new Prisma.Decimal(2),
    unit: UnitOfMeasure.G,
    branchId: 'branch-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    product: { id: 'prod-1', name: 'Harina', unitOfMeasure: UnitOfMeasure.KG },
    ...overrides,
  };
}

describe('RecipeService', () => {
  let service: RecipeService;
  let mockClient: any;
  let mockTx: any;

  beforeEach(() => {
    const built = createMockPrisma();
    mockClient = built.mockClient;
    mockTx = built.mockTx;
    service = new RecipeService();
    (getBranchId as jest.Mock).mockReturnValue('branch-1');
    jest.clearAllMocks();
  });

  describe('getRecipe', () => {
    it('devuelve los ingredientes con nombre y unidad del producto', async () => {
      mockClient.menuItem.findUnique.mockResolvedValue(makeMenuItem());
      mockClient.menuItemIngredient.findMany.mockResolvedValue([
        makeIngredientRow({ unit: null }),
        makeIngredientRow({
          id: 'ing-2',
          productId: 'prod-2',
          product: { id: 'prod-2', name: 'Queso', unitOfMeasure: null },
        }),
      ]);

      const result = await service.getRecipe('mi-1');

      expect(mockClient.menuItemIngredient.findMany).toHaveBeenCalledWith({
        where: { menuItemId: 'mi-1' },
        include: { product: true },
        orderBy: { createdAt: 'asc' },
      });
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        productId: 'prod-1',
        productName: 'Harina',
        quantity: expect.any(Prisma.Decimal),
        unit: null,
        productUnitOfMeasure: UnitOfMeasure.KG,
      });
      expect(result[1].unit).toBe(UnitOfMeasure.G);
      expect(result[1].productUnitOfMeasure).toBeNull();
      expect(result[1].productName).toBe('Queso');
    });

    it('lanza MENU_ITEM_NOT_FOUND si el menú no existe', async () => {
      mockClient.menuItem.findUnique.mockResolvedValue(null);

      await expect(service.getRecipe('missing')).rejects.toMatchObject({
        code: 'MENU_ITEM_NOT_FOUND',
      });
      expect(mockClient.menuItemIngredient.findMany).not.toHaveBeenCalled();
    });
  });

  describe('replaceRecipe', () => {
    it('lanza VALIDATION_ERROR si la lista de ingredientes está vacía', async () => {
      await expect(service.replaceRecipe('mi-1', [])).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
      });
      expect(mockClient.menuItem.findUnique).not.toHaveBeenCalled();
    });

    it('lanza MENU_ITEM_NOT_FOUND si el menú no existe', async () => {
      mockClient.menuItem.findUnique.mockResolvedValue(null);

      await expect(
        service.replaceRecipe('mi-1', [{ productId: 'prod-1', quantity: 1 }])
      ).rejects.toMatchObject({ code: 'MENU_ITEM_NOT_FOUND' });
    });

    it('lanza RECIPE_NOT_ALLOWED_ON_DIRECT_ITEM si el menú es un ítem directo', async () => {
      mockClient.menuItem.findUnique.mockResolvedValue(makeMenuItem({ productId: 'prod-x' }));

      await expect(
        service.replaceRecipe('mi-1', [{ productId: 'prod-1', quantity: 1 }])
      ).rejects.toMatchObject({ code: 'RECIPE_NOT_ALLOWED_ON_DIRECT_ITEM' });
    });

    it('lanza PRODUCT_NOT_FOUND si algún producto no existe', async () => {
      mockClient.menuItem.findUnique.mockResolvedValue(makeMenuItem());
      mockClient.product.findMany.mockResolvedValue([
        { id: 'prod-1', unitOfMeasure: UnitOfMeasure.KG },
      ]);

      await expect(
        service.replaceRecipe('mi-1', [
          { productId: 'prod-1', quantity: 1 },
          { productId: 'prod-999', quantity: 1 },
        ])
      ).rejects.toMatchObject({ code: 'PRODUCT_NOT_FOUND' });
      expect(mockClient.$transaction).not.toHaveBeenCalled();
    });

    it('lanza DUPLICATE_INGREDIENT si un producto aparece más de una vez', async () => {
      mockClient.menuItem.findUnique.mockResolvedValue(makeMenuItem());
      mockClient.product.findMany.mockResolvedValue([
        { id: 'prod-1', unitOfMeasure: UnitOfMeasure.KG },
      ]);

      await expect(
        service.replaceRecipe('mi-1', [
          { productId: 'prod-1', quantity: 1 },
          { productId: 'prod-1', quantity: 2 },
        ])
      ).rejects.toMatchObject({ code: 'DUPLICATE_INGREDIENT' });
      expect(mockClient.$transaction).not.toHaveBeenCalled();
    });

    it('lanza INCOMPATIBLE_UNIT si la unidad no es compatible con el producto', async () => {
      mockClient.menuItem.findUnique.mockResolvedValue(makeMenuItem());
      mockClient.product.findMany.mockResolvedValue([
        { id: 'prod-1', unitOfMeasure: UnitOfMeasure.KG },
      ]);

      await expect(
        service.replaceRecipe('mi-1', [
          { productId: 'prod-1', quantity: 1, unit: UnitOfMeasure.ML },
        ])
      ).rejects.toMatchObject({ code: 'INCOMPATIBLE_UNIT' });
      expect(mockClient.$transaction).not.toHaveBeenCalled();
    });

    it('borra la receta y crea los nuevos ingredientes en una transacción', async () => {
      mockClient.menuItem.findUnique.mockResolvedValue(makeMenuItem());
      mockClient.product.findMany.mockResolvedValue([
        { id: 'prod-1', unitOfMeasure: UnitOfMeasure.KG },
        { id: 'prod-2', unitOfMeasure: UnitOfMeasure.G },
      ]);

      const result = await service.replaceRecipe('mi-1', [
        { productId: 'prod-1', quantity: 2, unit: UnitOfMeasure.G },
        { productId: 'prod-2', quantity: 500 },
      ]);

      expect(mockClient.$transaction).toHaveBeenCalled();
      expect(mockTx.menuItemIngredient.deleteMany).toHaveBeenCalledWith({
        where: { menuItemId: 'mi-1' },
      });
      expect(mockTx.menuItemIngredient.create).toHaveBeenCalledTimes(2);

      const firstData = mockTx.menuItemIngredient.create.mock.calls[0][0].data;
      expect(firstData).toMatchObject({
        menuItemId: 'mi-1',
        productId: 'prod-1',
        unit: UnitOfMeasure.G,
        branchId: 'branch-1',
      });
      expect(firstData.quantity.toString()).toBe('2');

      const secondData = mockTx.menuItemIngredient.create.mock.calls[1][0].data;
      expect(secondData).toMatchObject({
        menuItemId: 'mi-1',
        productId: 'prod-2',
        unit: null,
        branchId: 'branch-1',
      });
      expect(secondData.quantity.toString()).toBe('500');

      expect(result).toHaveLength(2);
      expect(result[0].productId).toBe('prod-1');
      expect(result[0].unit).toBe(UnitOfMeasure.G);
    });

    it('usa branchId null cuando no hay sucursal en el contexto', async () => {
      (getBranchId as jest.Mock).mockReturnValue(null);
      mockClient.menuItem.findUnique.mockResolvedValue(makeMenuItem());
      mockClient.product.findMany.mockResolvedValue([
        { id: 'prod-1', unitOfMeasure: null },
      ]);

      const result = await service.replaceRecipe('mi-1', [
        { productId: 'prod-1', quantity: 1, unit: UnitOfMeasure.G },
      ]);

      const data = mockTx.menuItemIngredient.create.mock.calls[0][0].data;
      expect(data.branchId).toBeNull();
      expect(result).toHaveLength(1);
      expect(result[0].unit).toBe(UnitOfMeasure.G);
    });
  });

  describe('addIngredient', () => {
    it('lanza MENU_ITEM_NOT_FOUND si el menú no existe', async () => {
      mockClient.menuItem.findUnique.mockResolvedValue(null);

      await expect(service.addIngredient('mi-1', 'prod-1', 2)).rejects.toMatchObject({
        code: 'MENU_ITEM_NOT_FOUND',
      });
    });

    it('lanza RECIPE_NOT_ALLOWED_ON_DIRECT_ITEM si el menú es un ítem directo', async () => {
      mockClient.menuItem.findUnique.mockResolvedValue(makeMenuItem({ productId: 'prod-x' }));

      await expect(service.addIngredient('mi-1', 'prod-1', 2)).rejects.toMatchObject({
        code: 'RECIPE_NOT_ALLOWED_ON_DIRECT_ITEM',
      });
    });

    it('lanza PRODUCT_NOT_FOUND si el producto no existe', async () => {
      mockClient.menuItem.findUnique.mockResolvedValue(makeMenuItem());
      mockClient.product.findMany.mockResolvedValue([]);

      await expect(service.addIngredient('mi-1', 'prod-999', 2)).rejects.toMatchObject({
        code: 'PRODUCT_NOT_FOUND',
      });
    });

    it('lanza INCOMPATIBLE_UNIT si la unidad no es compatible con el producto', async () => {
      mockClient.menuItem.findUnique.mockResolvedValue(makeMenuItem());
      mockClient.product.findMany.mockResolvedValue([
        { id: 'prod-1', unitOfMeasure: UnitOfMeasure.KG },
      ]);

      await expect(
        service.addIngredient('mi-1', 'prod-1', 2, UnitOfMeasure.ML)
      ).rejects.toMatchObject({ code: 'INCOMPATIBLE_UNIT' });
    });

    it('lanza INGREDIENT_ALREADY_EXISTS si el producto ya está en la receta', async () => {
      mockClient.menuItem.findUnique.mockResolvedValue(makeMenuItem());
      mockClient.product.findMany.mockResolvedValue([
        { id: 'prod-1', unitOfMeasure: UnitOfMeasure.KG },
      ]);
      mockClient.menuItemIngredient.findUnique.mockResolvedValue({ id: 'ing-1' });

      await expect(
        service.addIngredient('mi-1', 'prod-1', 2, UnitOfMeasure.G)
      ).rejects.toMatchObject({ code: 'INGREDIENT_ALREADY_EXISTS' });
      expect(mockClient.menuItemIngredient.create).not.toHaveBeenCalled();
    });

    it('crea el ingrediente con la unidad explícita y branchId del tenant', async () => {
      mockClient.menuItem.findUnique.mockResolvedValue(makeMenuItem());
      mockClient.product.findMany.mockResolvedValue([
        { id: 'prod-1', unitOfMeasure: UnitOfMeasure.KG },
      ]);
      mockClient.menuItemIngredient.findUnique.mockResolvedValue(null);
      mockClient.menuItemIngredient.create.mockResolvedValue({
        id: 'ing-new',
        menuItemId: 'mi-1',
        productId: 'prod-1',
        quantity: new Prisma.Decimal(2),
        unit: UnitOfMeasure.G,
        branchId: 'branch-1',
      });

      const result = await service.addIngredient('mi-1', 'prod-1', 2, UnitOfMeasure.G);

      expect(mockClient.menuItemIngredient.create).toHaveBeenCalledWith({
        data: {
          menuItemId: 'mi-1',
          productId: 'prod-1',
          quantity: expect.any(Prisma.Decimal),
          unit: UnitOfMeasure.G,
          branchId: 'branch-1',
        },
      });
      expect(result.unit).toBe(UnitOfMeasure.G);
    });

    it('crea el ingrediente sin unidad (default null) y branchId null sin contexto', async () => {
      (getBranchId as jest.Mock).mockReturnValue(null);
      mockClient.menuItem.findUnique.mockResolvedValue(makeMenuItem());
      mockClient.product.findMany.mockResolvedValue([
        { id: 'prod-1', unitOfMeasure: null },
      ]);
      mockClient.menuItemIngredient.findUnique.mockResolvedValue(null);
      mockClient.menuItemIngredient.create.mockResolvedValue({
        id: 'ing-new',
        menuItemId: 'mi-1',
        productId: 'prod-1',
        quantity: new Prisma.Decimal(2),
        unit: null,
        branchId: null,
      });

      const result = await service.addIngredient('mi-1', 'prod-1', 2);

      expect(mockClient.menuItemIngredient.create).toHaveBeenCalledWith({
        data: {
          menuItemId: 'mi-1',
          productId: 'prod-1',
          quantity: expect.any(Prisma.Decimal),
          unit: null,
          branchId: null,
        },
      });
      expect(result.branchId).toBeNull();
    });
  });

  describe('updateIngredientQuantity', () => {
    it('lanza INGREDIENT_NOT_FOUND si el ingrediente no existe', async () => {
      mockClient.menuItemIngredient.findUnique.mockResolvedValue(null);

      await expect(service.updateIngredientQuantity('mi-1', 'prod-1', 3)).rejects.toMatchObject({
        code: 'INGREDIENT_NOT_FOUND',
      });
      expect(mockClient.menuItemIngredient.update).not.toHaveBeenCalled();
    });

    it('actualiza solo quantity cuando no se pasa unit', async () => {
      mockClient.menuItemIngredient.findUnique.mockResolvedValue({ id: 'ing-1' });
      mockClient.menuItemIngredient.update.mockResolvedValue({
        id: 'ing-1',
        quantity: new Prisma.Decimal(3),
      });

      const result = await service.updateIngredientQuantity('mi-1', 'prod-1', 3);

      expect(mockClient.menuItemIngredient.update).toHaveBeenCalledWith({
        where: { menuItemId_productId: { menuItemId: 'mi-1', productId: 'prod-1' } },
        data: { quantity: expect.any(Prisma.Decimal) },
      });
      expect(result.quantity.toString()).toBe('3');
    });

    it('lanza PRODUCT_NOT_FOUND si se declara unit pero el producto no existe', async () => {
      mockClient.menuItemIngredient.findUnique.mockResolvedValue({ id: 'ing-1' });
      mockClient.product.findMany.mockResolvedValue([]);

      await expect(
        service.updateIngredientQuantity('mi-1', 'prod-1', 3, UnitOfMeasure.G)
      ).rejects.toMatchObject({ code: 'PRODUCT_NOT_FOUND' });
      expect(mockClient.menuItemIngredient.update).not.toHaveBeenCalled();
    });

    it('lanza INCOMPATIBLE_UNIT si la unit declarada no es compatible', async () => {
      mockClient.menuItemIngredient.findUnique.mockResolvedValue({ id: 'ing-1' });
      mockClient.product.findMany.mockResolvedValue([
        { id: 'prod-1', unitOfMeasure: UnitOfMeasure.KG },
      ]);

      await expect(
        service.updateIngredientQuantity('mi-1', 'prod-1', 3, UnitOfMeasure.ML)
      ).rejects.toMatchObject({ code: 'INCOMPATIBLE_UNIT' });
    });

    it('actualiza quantity y unit cuando unit viene definida', async () => {
      mockClient.menuItemIngredient.findUnique.mockResolvedValue({ id: 'ing-1' });
      mockClient.product.findMany.mockResolvedValue([
        { id: 'prod-1', unitOfMeasure: UnitOfMeasure.KG },
      ]);
      mockClient.menuItemIngredient.update.mockResolvedValue({
        id: 'ing-1',
        quantity: new Prisma.Decimal(3),
        unit: UnitOfMeasure.G,
      });

      const result = await service.updateIngredientQuantity('mi-1', 'prod-1', 3, UnitOfMeasure.G);

      expect(mockClient.menuItemIngredient.update).toHaveBeenCalledWith({
        where: { menuItemId_productId: { menuItemId: 'mi-1', productId: 'prod-1' } },
        data: { quantity: expect.any(Prisma.Decimal), unit: UnitOfMeasure.G },
      });
      expect(result.unit).toBe(UnitOfMeasure.G);
    });

    it('valida y guarda unit null cuando se pasa explícitamente', async () => {
      mockClient.menuItemIngredient.findUnique.mockResolvedValue({ id: 'ing-1' });
      mockClient.product.findMany.mockResolvedValue([
        { id: 'prod-1', unitOfMeasure: null },
      ]);
      mockClient.menuItemIngredient.update.mockResolvedValue({
        id: 'ing-1',
        quantity: new Prisma.Decimal(3),
        unit: null,
      });

      const result = await service.updateIngredientQuantity('mi-1', 'prod-1', 3, null);

      expect(mockClient.product.findMany).toHaveBeenCalled();
      expect(mockClient.menuItemIngredient.update).toHaveBeenCalledWith({
        where: { menuItemId_productId: { menuItemId: 'mi-1', productId: 'prod-1' } },
        data: { quantity: expect.any(Prisma.Decimal), unit: null },
      });
      expect(result.unit).toBeNull();
    });
  });

  describe('removeIngredient', () => {
    it('lanza INGREDIENT_NOT_FOUND si el ingrediente no existe', async () => {
      mockClient.menuItemIngredient.findUnique.mockResolvedValue(null);

      await expect(service.removeIngredient('mi-1', 'prod-1')).rejects.toMatchObject({
        code: 'INGREDIENT_NOT_FOUND',
      });
      expect(mockClient.menuItemIngredient.delete).not.toHaveBeenCalled();
    });

    it('elimina el ingrediente de la receta', async () => {
      mockClient.menuItemIngredient.findUnique.mockResolvedValue({ id: 'ing-1' });
      mockClient.menuItemIngredient.delete.mockResolvedValue({ id: 'ing-1' });

      await service.removeIngredient('mi-1', 'prod-1');

      expect(mockClient.menuItemIngredient.delete).toHaveBeenCalledWith({
        where: { menuItemId_productId: { menuItemId: 'mi-1', productId: 'prod-1' } },
      });
    });
  });
});
