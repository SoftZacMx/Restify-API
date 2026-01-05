import { ListMenuCategoriesUseCase } from '../../../../src/core/application/use-cases/menu-categories/list-menu-categories.use-case';
import { IMenuCategoryRepository } from '../../../../src/core/domain/interfaces/menu-category-repository.interface';
import { MenuCategory } from '../../../../src/core/domain/entities/menu-category.entity';

describe('ListMenuCategoriesUseCase', () => {
  let listMenuCategoriesUseCase: ListMenuCategoriesUseCase;
  let mockMenuCategoryRepository: jest.Mocked<IMenuCategoryRepository>;

  beforeEach(() => {
    mockMenuCategoryRepository = {
      findById: jest.fn(),
      findByName: jest.fn(),
      findAll: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    listMenuCategoriesUseCase = new ListMenuCategoriesUseCase(mockMenuCategoryRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('should return all categories when no filters provided', async () => {
      const mockCategories = [
        new MenuCategory('1', 'Bebidas', true, new Date(), new Date()),
        new MenuCategory('2', 'Postres', true, new Date(), new Date()),
      ];

      mockMenuCategoryRepository.findAll.mockResolvedValue(mockCategories);

      const result = await listMenuCategoriesUseCase.execute();

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Bebidas');
      expect(result[1].name).toBe('Postres');
      expect(mockMenuCategoryRepository.findAll).toHaveBeenCalledWith(undefined);
    });

    it('should return filtered categories by status', async () => {
      const mockCategories = [
        new MenuCategory('1', 'Bebidas', true, new Date(), new Date()),
      ];

      mockMenuCategoryRepository.findAll.mockResolvedValue(mockCategories);

      const result = await listMenuCategoriesUseCase.execute({ status: true });

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe(true);
      expect(mockMenuCategoryRepository.findAll).toHaveBeenCalledWith({
        status: true,
        search: undefined,
      });
    });

    it('should return filtered categories by search', async () => {
      const mockCategories = [
        new MenuCategory('1', 'Bebidas', true, new Date(), new Date()),
      ];

      mockMenuCategoryRepository.findAll.mockResolvedValue(mockCategories);

      const result = await listMenuCategoriesUseCase.execute({ search: 'Beb' });

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Bebidas');
      expect(mockMenuCategoryRepository.findAll).toHaveBeenCalledWith({
        status: undefined,
        search: 'Beb',
      });
    });
  });
});

