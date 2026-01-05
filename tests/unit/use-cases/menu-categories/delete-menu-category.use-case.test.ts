import { DeleteMenuCategoryUseCase } from '../../../../src/core/application/use-cases/menu-categories/delete-menu-category.use-case';
import { IMenuCategoryRepository } from '../../../../src/core/domain/interfaces/menu-category-repository.interface';
import { MenuCategory } from '../../../../src/core/domain/entities/menu-category.entity';
import { AppError } from '../../../../src/shared/errors';

describe('DeleteMenuCategoryUseCase', () => {
  let deleteMenuCategoryUseCase: DeleteMenuCategoryUseCase;
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

    deleteMenuCategoryUseCase = new DeleteMenuCategoryUseCase(mockMenuCategoryRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    const validInput = {
      category_id: '123',
    };

    it('should delete category successfully', async () => {
      const mockCategory = new MenuCategory(
        '123',
        'Bebidas',
        true,
        new Date(),
        new Date()
      );

      mockMenuCategoryRepository.findById.mockResolvedValue(mockCategory);
      mockMenuCategoryRepository.delete.mockResolvedValue();

      await deleteMenuCategoryUseCase.execute(validInput);

      expect(mockMenuCategoryRepository.findById).toHaveBeenCalledWith('123');
      expect(mockMenuCategoryRepository.delete).toHaveBeenCalledWith('123');
    });

    it('should throw error when category not found', async () => {
      mockMenuCategoryRepository.findById.mockResolvedValue(null);

      try {
        await deleteMenuCategoryUseCase.execute(validInput);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).code).toBe('MENU_CATEGORY_NOT_FOUND');
      }
    });
  });
});

