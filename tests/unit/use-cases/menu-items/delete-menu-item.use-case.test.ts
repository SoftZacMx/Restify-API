import { DeleteMenuItemUseCase } from '../../../../src/core/application/use-cases/menu-items/delete-menu-item.use-case';
import { IMenuItemRepository } from '../../../../src/core/domain/interfaces/menu-item-repository.interface';
import { MenuItem } from '../../../../src/core/domain/entities/menu-item.entity';
import { AppError } from '../../../../src/shared/errors';

describe('DeleteMenuItemUseCase', () => {
  let deleteMenuItemUseCase: DeleteMenuItemUseCase;
  let mockMenuItemRepository: jest.Mocked<IMenuItemRepository>;

  beforeEach(() => {
    mockMenuItemRepository = {
      findById: jest.fn(),
      findByIds: jest.fn(),
      findAll: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    deleteMenuItemUseCase = new DeleteMenuItemUseCase(mockMenuItemRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    const validInput = {
      menu_item_id: '123',
    };

    it('should delete menu item successfully', async () => {
      const mockMenuItem = new MenuItem(
        '123',
        'Pizza',
        15.99,
        true,
        false,
        '456',
        '789',
        new Date(),
        new Date()
      );

      mockMenuItemRepository.findById.mockResolvedValue(mockMenuItem);
      mockMenuItemRepository.delete.mockResolvedValue();

      await deleteMenuItemUseCase.execute(validInput);

      expect(mockMenuItemRepository.findById).toHaveBeenCalledWith('123');
      expect(mockMenuItemRepository.delete).toHaveBeenCalledWith('123');
    });

    it('should throw error when menu item not found', async () => {
      mockMenuItemRepository.findById.mockResolvedValue(null);

      try {
        await deleteMenuItemUseCase.execute(validInput);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).code).toBe('MENU_ITEM_NOT_FOUND');
      }
    });
  });
});

