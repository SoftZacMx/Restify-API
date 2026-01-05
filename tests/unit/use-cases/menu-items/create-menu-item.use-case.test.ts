import { CreateMenuItemUseCase } from '../../../../src/core/application/use-cases/menu-items/create-menu-item.use-case';
import { IMenuItemRepository } from '../../../../src/core/domain/interfaces/menu-item-repository.interface';
import { IMenuCategoryRepository } from '../../../../src/core/domain/interfaces/menu-category-repository.interface';
import { IUserRepository } from '../../../../src/core/domain/interfaces/user-repository.interface';
import { MenuItem } from '../../../../src/core/domain/entities/menu-item.entity';
import { MenuCategory } from '../../../../src/core/domain/entities/menu-category.entity';
import { User } from '../../../../src/core/domain/entities/user.entity';
import { UserRole } from '@prisma/client';
import { AppError } from '../../../../src/shared/errors';

describe('CreateMenuItemUseCase', () => {
  let createMenuItemUseCase: CreateMenuItemUseCase;
  let mockMenuItemRepository: jest.Mocked<IMenuItemRepository>;
  let mockMenuCategoryRepository: jest.Mocked<IMenuCategoryRepository>;
  let mockUserRepository: jest.Mocked<IUserRepository>;

  beforeEach(() => {
    mockMenuItemRepository = {
      findById: jest.fn(),
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

    mockUserRepository = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findAll: jest.fn(),
    };

    createMenuItemUseCase = new CreateMenuItemUseCase(
      mockMenuItemRepository,
      mockMenuCategoryRepository,
      mockUserRepository
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    const validInput = {
      name: 'Pizza',
      price: 15.99,
      status: true,
      categoryId: '123',
      userId: '456',
    };

    it('should create a new menu item successfully', async () => {
      const mockCategory = new MenuCategory('123', 'Bebidas', true, new Date(), new Date());
      const mockUser = new User(
        '456',
        'John',
        'Doe',
        null,
        'john@example.com',
        'hashed_password',
        null,
        true,
        UserRole.WAITER,
        new Date(),
        new Date()
      );

      mockMenuCategoryRepository.findById.mockResolvedValue(mockCategory);
      mockUserRepository.findById.mockResolvedValue(mockUser);

      const mockCreatedMenuItem = new MenuItem(
        '789',
        'Pizza',
        15.99,
        true,
        '123',
        '456',
        new Date(),
        new Date()
      );

      mockMenuItemRepository.create.mockResolvedValue(mockCreatedMenuItem);

      const result = await createMenuItemUseCase.execute(validInput);

      expect(result).toHaveProperty('id');
      expect(result.name).toBe('Pizza');
      expect(result.price).toBe(15.99);
      expect(mockMenuCategoryRepository.findById).toHaveBeenCalledWith('123');
      expect(mockUserRepository.findById).toHaveBeenCalledWith('456');
      expect(mockMenuItemRepository.create).toHaveBeenCalled();
    });

    it('should throw error when category not found', async () => {
      mockMenuCategoryRepository.findById.mockResolvedValue(null);

      try {
        await createMenuItemUseCase.execute(validInput);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).code).toBe('MENU_CATEGORY_NOT_FOUND');
      }
    });

    it('should throw error when user not found', async () => {
      const mockCategory = new MenuCategory('123', 'Bebidas', true, new Date(), new Date());
      mockMenuCategoryRepository.findById.mockResolvedValue(mockCategory);
      mockUserRepository.findById.mockResolvedValue(null);

      try {
        await createMenuItemUseCase.execute(validInput);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).code).toBe('USER_NOT_FOUND');
      }
    });

    it('should use default status true when not provided', async () => {
      const mockCategory = new MenuCategory('123', 'Bebidas', true, new Date(), new Date());
      const mockUser = new User(
        '456',
        'John',
        'Doe',
        null,
        'john@example.com',
        'hashed_password',
        null,
        true,
        UserRole.WAITER,
        new Date(),
        new Date()
      );

      mockMenuCategoryRepository.findById.mockResolvedValue(mockCategory);
      mockUserRepository.findById.mockResolvedValue(mockUser);

      const mockCreatedMenuItem = new MenuItem(
        '789',
        'Pizza',
        15.99,
        true,
        '123',
        '456',
        new Date(),
        new Date()
      );

      mockMenuItemRepository.create.mockResolvedValue(mockCreatedMenuItem);

      const inputWithoutStatus = { ...validInput, status: undefined };
      await createMenuItemUseCase.execute(inputWithoutStatus);

      expect(mockMenuItemRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          status: true,
        })
      );
    });
  });
});

