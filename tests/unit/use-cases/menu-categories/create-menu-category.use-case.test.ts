import { CreateMenuCategoryUseCase } from '../../../../src/core/application/use-cases/menu-categories/create-menu-category.use-case';
import { IMenuCategoryRepository } from '../../../../src/core/domain/interfaces/menu-category-repository.interface';
import { MenuCategory } from '../../../../src/core/domain/entities/menu-category.entity';
import { AppError } from '../../../../src/shared/errors';

describe('CreateMenuCategoryUseCase', () => {
  let createMenuCategoryUseCase: CreateMenuCategoryUseCase;
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

    createMenuCategoryUseCase = new CreateMenuCategoryUseCase(
      mockMenuCategoryRepository
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    const validInput = {
      name: 'Bebidas',
      status: true,
    };

    it('should create a new menu category successfully', async () => {
      mockMenuCategoryRepository.findByName.mockResolvedValue(null);

      const mockCreatedCategory = new MenuCategory(
        '123',
        'Bebidas',
        true,
        new Date(),
        new Date()
      );

      mockMenuCategoryRepository.create.mockResolvedValue(mockCreatedCategory);

      const result = await createMenuCategoryUseCase.execute(validInput);

      expect(result).toHaveProperty('id');
      expect(result.name).toBe('Bebidas');
      expect(result.status).toBe(true);
      expect(mockMenuCategoryRepository.findByName).toHaveBeenCalledWith('Bebidas');
      expect(mockMenuCategoryRepository.create).toHaveBeenCalled();
    });

    it('should throw error when category name already exists', async () => {
      const existingCategory = new MenuCategory(
        '456',
        'Bebidas',
        true,
        new Date(),
        new Date()
      );

      mockMenuCategoryRepository.findByName.mockResolvedValue(existingCategory);

      try {
        await createMenuCategoryUseCase.execute(validInput);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).code).toBe('VALIDATION_ERROR');
      }
    });

    it('should use default status true when not provided', async () => {
      mockMenuCategoryRepository.findByName.mockResolvedValue(null);

      const mockCreatedCategory = new MenuCategory(
        '123',
        'Bebidas',
        true,
        new Date(),
        new Date()
      );

      mockMenuCategoryRepository.create.mockResolvedValue(mockCreatedCategory);

      const inputWithoutStatus = { name: 'Bebidas' };
      await createMenuCategoryUseCase.execute(inputWithoutStatus);

      expect(mockMenuCategoryRepository.create).toHaveBeenCalledWith({
        name: 'Bebidas',
        status: true,
      });
    });
  });
});

