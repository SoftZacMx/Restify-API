import { DeleteOrderUseCase } from '../../../../src/core/application/use-cases/orders/delete-order.use-case';
import { IOrderRepository } from '../../../../src/core/domain/interfaces/order-repository.interface';
import { Order } from '../../../../src/core/domain/entities/order.entity';
import { OrderItem } from '../../../../src/core/domain/entities/order-item.entity';
import { StockService } from '../../../../src/core/application/services/stock.service';
import { PrismaService } from '../../../../src/core/infrastructure/config/prisma.config';
import { AppError } from '../../../../src/shared/errors';

describe('DeleteOrderUseCase', () => {
  let deleteOrderUseCase: DeleteOrderUseCase;
  let mockOrderRepository: jest.Mocked<IOrderRepository>;
  let mockStockService: jest.Mocked<Pick<StockService, 'recordSaleForOrderItem' | 'reverseSaleForOrderItem' | 'reverseSalesBatch'>>;
  let mockPrismaService: jest.Mocked<PrismaService>;
  const mockTx = {
    table: { update: jest.fn().mockResolvedValue({}) },
    order: { delete: jest.fn().mockResolvedValue({}) },
  } as any;

  beforeEach(() => {
    mockOrderRepository = {
      findById: jest.fn(),
      findByTrackingToken: jest.fn(),
      findAll: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      createOrderItem: jest.fn(),
      updateOrderItem: jest.fn(),
      deleteOrderItem: jest.fn(),
      deleteOrderItemsByOrderId: jest.fn(),
      findOrderItemsByOrderId: jest.fn().mockResolvedValue([]),
      createOrderItemExtra: jest.fn(),
      deleteOrderItemExtrasByOrderId: jest.fn(),
      deleteOrderItemExtrasByOrderItemId: jest.fn(),
      findOrderItemExtrasByOrderId: jest.fn(),
      findOrderItemExtrasByOrderItemId: jest.fn(),
    };

    mockStockService = {
      recordSaleForOrderItem: jest.fn().mockResolvedValue([]),
      reverseSaleForOrderItem: jest.fn().mockResolvedValue([]),
      reverseSalesBatch: jest.fn().mockResolvedValue(undefined),
    };

    mockPrismaService = {
      getClient: jest.fn().mockReturnValue({
        $transaction: jest.fn().mockImplementation((cb: Function) => cb(mockTx)),
      }),
    } as unknown as jest.Mocked<PrismaService>;

    deleteOrderUseCase = new DeleteOrderUseCase(
      mockOrderRepository,
      mockPrismaService,
      mockStockService as unknown as StockService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    const validInput = {
      order_id: 'order-123',
      userId: 'user-1',
    };

    function buildOrder(tableId: string | null = null) {
      return new Order(
        'order-123', new Date(), false, 1, 23.20, 20.00, 3.20, false,
        tableId, 0, 'Local', null, false, null, 'user-123',
        null, null, null, null, null, null, null, null, null,
        new Date(), new Date()
      );
    }

    it('borra la orden y revierte stock por cada OrderItem (con userId del actor)', async () => {
      mockOrderRepository.findById.mockResolvedValue(buildOrder());
      mockOrderRepository.findOrderItemsByOrderId.mockResolvedValue([
        new OrderItem('oi-1', 1, 10, 'order-123', null, 'mi-1', null, new Date(), new Date()),
        new OrderItem('oi-2', 2, 5, 'order-123', null, 'mi-2', null, new Date(), new Date()),
      ]);

      await deleteOrderUseCase.execute(validInput);

      expect(mockStockService.reverseSalesBatch).toHaveBeenCalledTimes(1);
      expect(mockStockService.reverseSalesBatch).toHaveBeenCalledWith(
        ['oi-1', 'oi-2'], 'user-1', 'order cancelled', mockTx
      );
      expect(mockTx.order.delete).toHaveBeenCalledWith({ where: { id: 'order-123' } });
    });

    it('libera la mesa cuando la orden tenía mesa local', async () => {
      mockOrderRepository.findById.mockResolvedValue(buildOrder('table-1'));
      mockOrderRepository.findOrderItemsByOrderId.mockResolvedValue([]);

      await deleteOrderUseCase.execute(validInput);

      expect(mockTx.table.update).toHaveBeenCalledWith({
        where: { id: 'table-1' },
        data: { availabilityStatus: true },
      });
    });

    it('acepta userId null (delete del sistema, sin actor humano)', async () => {
      mockOrderRepository.findById.mockResolvedValue(buildOrder());
      mockOrderRepository.findOrderItemsByOrderId.mockResolvedValue([
        new OrderItem('oi-1', 1, 10, 'order-123', null, 'mi-1', null, new Date(), new Date()),
      ]);

      await deleteOrderUseCase.execute({ order_id: 'order-123', userId: null });

      expect(mockStockService.reverseSalesBatch).toHaveBeenCalledWith(
        ['oi-1'], null, 'order cancelled', mockTx
      );
    });

    it('lanza ORDER_NOT_FOUND si la orden no existe', async () => {
      mockOrderRepository.findById.mockResolvedValue(null);

      await expect(deleteOrderUseCase.execute(validInput)).rejects.toMatchObject({
        code: 'ORDER_NOT_FOUND',
      });
      expect(mockStockService.reverseSalesBatch).not.toHaveBeenCalled();
      expect(mockTx.order.delete).not.toHaveBeenCalled();
    });
  });
});
