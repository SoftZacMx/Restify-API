import { DeleteOrderUseCase } from '../../../../src/core/application/use-cases/orders/delete-order.use-case';
import { IOrderRepository } from '../../../../src/core/domain/interfaces/order-repository.interface';
import { Order } from '../../../../src/core/domain/entities/order.entity';
import { AppError } from '../../../../src/shared/errors';

describe('DeleteOrderUseCase', () => {
  let deleteOrderUseCase: DeleteOrderUseCase;
  let mockOrderRepository: jest.Mocked<IOrderRepository>;

  beforeEach(() => {
    mockOrderRepository = {
      findById: jest.fn(),
      findAll: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      createOrderItem: jest.fn(),
      findOrderItemsByOrderId: jest.fn(),
      createOrderMenuItem: jest.fn(),
      findOrderMenuItemsByOrderId: jest.fn(),
    };

    deleteOrderUseCase = new DeleteOrderUseCase(mockOrderRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    const validInput = {
      order_id: 'order-123',
    };

    it('should delete order successfully', async () => {
      const mockOrder = new Order(
        'order-123',
        new Date(),
        false,
        1,
        23.20,
        20.00,
        3.20,
        false,
        null,
        0,
        'Local',
        null,
        false,
        null,
        'user-123',
        new Date(),
        new Date()
      );

      mockOrderRepository.findById.mockResolvedValue(mockOrder);
      mockOrderRepository.delete.mockResolvedValue();

      await deleteOrderUseCase.execute(validInput);

      expect(mockOrderRepository.findById).toHaveBeenCalledWith('order-123');
      expect(mockOrderRepository.delete).toHaveBeenCalledWith('order-123');
    });

    it('should throw error when order not found', async () => {
      mockOrderRepository.findById.mockResolvedValue(null);

      try {
        await deleteOrderUseCase.execute(validInput);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).code).toBe('ORDER_NOT_FOUND');
        expect(mockOrderRepository.delete).not.toHaveBeenCalled();
      }
    });
  });
});

