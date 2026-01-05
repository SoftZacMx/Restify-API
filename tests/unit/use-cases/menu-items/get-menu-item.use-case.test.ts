import { GetMenuItemUseCase } from '../../../../src/core/application/use-cases/menu-items/get-menu-item.use-case';
import { IMenuItemRepository } from '../../../../src/core/domain/interfaces/menu-item-repository.interface';
import { MenuItem } from '../../../../src/core/domain/entities/menu-item.entity';
import { AppError } from '../../../../src/shared/errors';

describe('GetMenuItemUseCase', () => {
  let getMenuItemUseCase: GetMenuItemUseCase;
  let mockMenuItemRepository: jest.Mocked<IMenuItemRepository>;

  beforeEach(() => {
    mockMenuItemRepository = {
      findById: jest.fn(),
      findAll: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    getMenuItemUseCase = new GetMenuItemUseCase(mockMenuItemRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    const validInput = {
      menu_item_id: '123',
    };

    it('should return menu item data when item exists', async () => {
      const mockMenuItem = new MenuItem(
        '123',
        'Pizza',
        15.99,
        true,
        '456',
        '789',
        new Date(),
        new Date()
      );

      mockMenuItemRepository.findById.mockResolvedValue(mockMenuItem);

      const result = await getMenuItemUseCase.execute(validInput);

      expect(result).toHaveProperty('id');
      expect(result.id).toBe('123');
      expect(result.name).toBe('Pizza');
      expect(mockMenuItemRepository.findById).toHaveBeenCalledWith('123');
    });

    it('should throw error when menu item not found', async () => {
      mockMenuItemRepository.findById.mockResolvedValue(null);

      try {
        await getMenuItemUseCase.execute(validInput);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).code).toBe('MENU_ITEM_NOT_FOUND');
      }
    });
  });
});

