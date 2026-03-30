import { ListMenuItemsUseCase } from '../../../../src/core/application/use-cases/menu-items/list-menu-items.use-case';
import { IMenuItemRepository } from '../../../../src/core/domain/interfaces/menu-item-repository.interface';
import { MenuItem } from '../../../../src/core/domain/entities/menu-item.entity';

describe('ListMenuItemsUseCase', () => {
  let listMenuItemsUseCase: ListMenuItemsUseCase;
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

    listMenuItemsUseCase = new ListMenuItemsUseCase(mockMenuItemRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('should return all menu items when no filters provided', async () => {
      const mockMenuItems = [
        new MenuItem('1', 'Pizza', 15.99, true, false, '123', '456', new Date(), new Date()),
        new MenuItem('2', 'Hamburguesa', 12.50, true, false, '123', '456', new Date(), new Date()),
      ];

      mockMenuItemRepository.findAll.mockResolvedValue(mockMenuItems);

      const result = await listMenuItemsUseCase.execute();

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Pizza');
      expect(result[1].name).toBe('Hamburguesa');
      expect(mockMenuItemRepository.findAll).toHaveBeenCalledWith(undefined);
    });

    it('should return filtered menu items by status', async () => {
      const mockMenuItems = [
        new MenuItem('1', 'Pizza', 15.99, true, false, '123', '456', new Date(), new Date()),
      ];

      mockMenuItemRepository.findAll.mockResolvedValue(mockMenuItems);

      const result = await listMenuItemsUseCase.execute({ status: true });

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe(true);
      expect(mockMenuItemRepository.findAll).toHaveBeenCalledWith({
        status: true,
        categoryId: undefined,
        userId: undefined,
        search: undefined,
      });
    });

    it('should return filtered menu items by categoryId', async () => {
      const mockMenuItems = [
        new MenuItem('1', 'Pizza', 15.99, true, false, '123', '456', new Date(), new Date()),
      ];

      mockMenuItemRepository.findAll.mockResolvedValue(mockMenuItems);

      const result = await listMenuItemsUseCase.execute({ categoryId: '123' });

      expect(result).toHaveLength(1);
      expect(result[0].categoryId).toBe('123');
      expect(mockMenuItemRepository.findAll).toHaveBeenCalledWith({
        status: undefined,
        categoryId: '123',
        userId: undefined,
        search: undefined,
      });
    });
  });
});

