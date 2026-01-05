import { UpdateMenuItemUseCase } from '../../../../src/core/application/use-cases/menu-items/update-menu-item.use-case';
import { IMenuItemRepository } from '../../../../src/core/domain/interfaces/menu-item-repository.interface';
import { IMenuCategoryRepository } from '../../../../src/core/domain/interfaces/menu-category-repository.interface';
import { IUserRepository } from '../../../../src/core/domain/interfaces/user-repository.interface';
import { MenuItem } from '../../../../src/core/domain/entities/menu-item.entity';
import { MenuCategory } from '../../../../src/core/domain/entities/menu-category.entity';
import { User } from '../../../../src/core/domain/entities/user.entity';
import { UserRole } from '@prisma/client';
import { AppError } from '../../../../src/shared/errors';

describe('UpdateMenuItemUseCase', () => {
  let updateMenuItemUseCase: UpdateMenuItemUseCase;
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

    updateMenuItemUseCase = new UpdateMenuItemUseCase(
      mockMenuItemRepository,
      mockMenuCategoryRepository,
      mockUserRepository
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    const menuItemId = '123';
    const existingMenuItem = new MenuItem(
      '123',
      'Pizza',
      15.99,
      true,
      '456',
      '789',
      new Date(),
      new Date()
    );

    it('should update menu item successfully', async () => {
      mockMenuItemRepository.findById.mockResolvedValue(existingMenuItem);
      mockMenuItemRepository.update.mockResolvedValue({
        ...existingMenuItem,
        price: 16.99,
      } as MenuItem);

      const result = await updateMenuItemUseCase.execute(menuItemId, { price: 16.99 });

      expect(result.price).toBe(16.99);
      expect(mockMenuItemRepository.findById).toHaveBeenCalledWith(menuItemId);
      expect(mockMenuItemRepository.update).toHaveBeenCalled();
    });

    it('should throw error when menu item not found', async () => {
      mockMenuItemRepository.findById.mockResolvedValue(null);

      try {
        await updateMenuItemUseCase.execute(menuItemId, { price: 16.99 });
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).code).toBe('MENU_ITEM_NOT_FOUND');
      }
    });

    it('should throw error when new category not found', async () => {
      mockMenuItemRepository.findById.mockResolvedValue(existingMenuItem);
      mockMenuCategoryRepository.findById.mockResolvedValue(null);

      try {
        await updateMenuItemUseCase.execute(menuItemId, { categoryId: '999' });
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).code).toBe('MENU_CATEGORY_NOT_FOUND');
      }
    });

    it('should throw error when new user not found', async () => {
      mockMenuItemRepository.findById.mockResolvedValue(existingMenuItem);
      mockUserRepository.findById.mockResolvedValue(null);

      try {
        await updateMenuItemUseCase.execute(menuItemId, { userId: '999' });
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).code).toBe('USER_NOT_FOUND');
      }
    });
  });
});

