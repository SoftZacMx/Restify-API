import { UpdateMenuCategoryUseCase } from '../../../../src/core/application/use-cases/menu-categories/update-menu-category.use-case';
import { IMenuCategoryRepository } from '../../../../src/core/domain/interfaces/menu-category-repository.interface';
import { MenuCategory } from '../../../../src/core/domain/entities/menu-category.entity';
import { AppError } from '../../../../src/shared/errors';

describe('UpdateMenuCategoryUseCase', () => {
  let updateMenuCategoryUseCase: UpdateMenuCategoryUseCase;
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

    updateMenuCategoryUseCase = new UpdateMenuCategoryUseCase(mockMenuCategoryRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    const categoryId = '123';
    const existingCategory = new MenuCategory(
      '123',
      'Bebidas',
      true,
      new Date(),
      new Date()
    );

    it('should update category successfully', async () => {
      mockMenuCategoryRepository.findById.mockResolvedValue(existingCategory);
      mockMenuCategoryRepository.update.mockResolvedValue({
        ...existingCategory,
        status: false,
      } as MenuCategory);

      const result = await updateMenuCategoryUseCase.execute(categoryId, { status: false });

      expect(result.status).toBe(false);
      expect(mockMenuCategoryRepository.findById).toHaveBeenCalledWith(categoryId);
      expect(mockMenuCategoryRepository.update).toHaveBeenCalled();
    });

    it('should throw error when category not found', async () => {
      mockMenuCategoryRepository.findById.mockResolvedValue(null);

      try {
        await updateMenuCategoryUseCase.execute(categoryId, { status: false });
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).code).toBe('MENU_CATEGORY_NOT_FOUND');
      }
    });

    it('should throw error when new category name already exists', async () => {
      const otherCategory = new MenuCategory(
        '789',
        'Postres',
        true,
        new Date(),
        new Date()
      );

      mockMenuCategoryRepository.findById.mockResolvedValue(existingCategory);
      mockMenuCategoryRepository.findByName.mockResolvedValue(otherCategory);

      try {
        await updateMenuCategoryUseCase.execute(categoryId, { name: 'Postres' });
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).code).toBe('VALIDATION_ERROR');
      }
    });

    it('should allow updating to same name', async () => {
      mockMenuCategoryRepository.findById.mockResolvedValue(existingCategory);
      mockMenuCategoryRepository.update.mockResolvedValue(existingCategory);

      await updateMenuCategoryUseCase.execute(categoryId, { name: 'Bebidas' });

      expect(mockMenuCategoryRepository.findByName).not.toHaveBeenCalled();
      expect(mockMenuCategoryRepository.update).toHaveBeenCalled();
    });
  });
});

