import { ListPublicMenuUseCase } from '../../../../src/core/application/use-cases/menu-items/list-public-menu.use-case';
import { IMenuItemRepository } from '../../../../src/core/domain/interfaces/menu-item-repository.interface';
import { IMenuCategoryRepository } from '../../../../src/core/domain/interfaces/menu-category-repository.interface';
import { MenuItem } from '../../../../src/core/domain/entities/menu-item.entity';
import { MenuCategory } from '../../../../src/core/domain/entities/menu-category.entity';

describe('ListPublicMenuUseCase', () => {
  let useCase: ListPublicMenuUseCase;
  let mockMenuItemRepository: jest.Mocked<IMenuItemRepository>;
  let mockMenuCategoryRepository: jest.Mocked<IMenuCategoryRepository>;

  beforeEach(() => {
    mockMenuItemRepository = {
      findById: jest.fn(),
      findByIds: jest.fn(),
      findAll: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    mockMenuCategoryRepository = {
      findById: jest.fn(),
      findByName: jest.fn(),
      findAll: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    useCase = new ListPublicMenuUseCase(mockMenuItemRepository, mockMenuCategoryRepository);
  });

  afterEach(() => jest.clearAllMocks());

  it('should return items grouped by category and extras separately', async () => {
    const categories = [
      new MenuCategory('cat-1', 'Platos fuertes', true, new Date(), new Date()),
      new MenuCategory('cat-2', 'Bebidas', true, new Date(), new Date()),
    ];

    const items = [
      new MenuItem('item-1', 'Hamburguesa', 120, true, false, 'cat-1', 'user-1', new Date(), new Date()),
      new MenuItem('item-2', 'Refresco', 30, true, false, 'cat-2', 'user-1', new Date(), new Date()),
    ];

    const extras = [
      new MenuItem('extra-1', 'Queso extra', 15, true, true, 'cat-1', 'user-1', new Date(), new Date()),
    ];

    mockMenuCategoryRepository.findAll.mockResolvedValue(categories);
    mockMenuItemRepository.findAll
      .mockResolvedValueOnce(items)   // status: true, isExtra: false
      .mockResolvedValueOnce(extras); // status: true, isExtra: true

    const result = await useCase.execute();

    expect(result.categories).toHaveLength(2);
    expect(result.categories[0].name).toBe('Platos fuertes');
    expect(result.categories[0].items).toHaveLength(1);
    expect(result.categories[0].items[0].name).toBe('Hamburguesa');
    expect(result.categories[1].name).toBe('Bebidas');
    expect(result.extras).toHaveLength(1);
    expect(result.extras[0].name).toBe('Queso extra');
  });

  it('should exclude categories with no items', async () => {
    const categories = [
      new MenuCategory('cat-1', 'Platos fuertes', true, new Date(), new Date()),
      new MenuCategory('cat-empty', 'Vacía', true, new Date(), new Date()),
    ];

    const items = [
      new MenuItem('item-1', 'Hamburguesa', 120, true, false, 'cat-1', 'user-1', new Date(), new Date()),
    ];

    mockMenuCategoryRepository.findAll.mockResolvedValue(categories);
    mockMenuItemRepository.findAll
      .mockResolvedValueOnce(items)
      .mockResolvedValueOnce([]);

    const result = await useCase.execute();

    expect(result.categories).toHaveLength(1);
    expect(result.categories[0].id).toBe('cat-1');
  });

  it('should return empty when no items exist', async () => {
    mockMenuCategoryRepository.findAll.mockResolvedValue([]);
    mockMenuItemRepository.findAll.mockResolvedValue([]);

    const result = await useCase.execute();

    expect(result.categories).toHaveLength(0);
    expect(result.extras).toHaveLength(0);
  });
});
