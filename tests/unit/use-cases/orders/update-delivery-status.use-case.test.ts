import { UpdateDeliveryStatusUseCase } from '../../../../src/core/application/use-cases/orders/update-delivery-status.use-case';
import { IOrderRepository } from '../../../../src/core/domain/interfaces/order-repository.interface';
import { Order } from '../../../../src/core/domain/entities/order.entity';
import { AppError } from '../../../../src/shared/errors';

describe('UpdateDeliveryStatusUseCase', () => {
  let useCase: UpdateDeliveryStatusUseCase;
  let mockOrderRepository: jest.Mocked<IOrderRepository>;

  const makeOnlineOrder = (delivered = false, deliveryStatus: string | null = 'PAID') => new Order(
    'order-1', new Date(), true, 4, 150, 150, 0,
    delivered, null, 0, 'online-delivery', null, false, null, null,
    'Juan', '5512345678', 19.43, -99.13, 'Calle 1', null, 'token-abc', deliveryStatus,
    new Date(), new Date()
  );

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
      findOrderItemsByOrderId: jest.fn(),
      createOrderItemExtra: jest.fn(),
      deleteOrderItemExtrasByOrderId: jest.fn(),
      deleteOrderItemExtrasByOrderItemId: jest.fn(),
      findOrderItemExtrasByOrderId: jest.fn(),
      findOrderItemExtrasByOrderItemId: jest.fn(),
    };

    useCase = new UpdateDeliveryStatusUseCase(mockOrderRepository);
  });

  afterEach(() => jest.clearAllMocks());

  it('should update deliveryStatus to PREPARING', async () => {
    mockOrderRepository.findById.mockResolvedValue(makeOnlineOrder());
    mockOrderRepository.update.mockResolvedValue(makeOnlineOrder(false, 'PREPARING'));

    const result = await useCase.execute('order-1', { status: 'PREPARING' });

    expect(result.deliveryStatus).toBe('PREPARING');
    expect(result.delivered).toBe(false);
    expect(mockOrderRepository.update).toHaveBeenCalledWith('order-1', {
      delivered: false,
      deliveryStatus: 'PREPARING',
    });
  });

  it('should update deliveryStatus to READY', async () => {
    mockOrderRepository.findById.mockResolvedValue(makeOnlineOrder());
    mockOrderRepository.update.mockResolvedValue(makeOnlineOrder(false, 'READY'));

    const result = await useCase.execute('order-1', { status: 'READY' });

    expect(result.deliveryStatus).toBe('READY');
    expect(result.delivered).toBe(false);
  });

  it('should set delivered=true when status is DELIVERED', async () => {
    mockOrderRepository.findById.mockResolvedValue(makeOnlineOrder());
    mockOrderRepository.update.mockResolvedValue(makeOnlineOrder(true, 'DELIVERED'));

    const result = await useCase.execute('order-1', { status: 'DELIVERED' });

    expect(result.delivered).toBe(true);
    expect(result.deliveryStatus).toBe('DELIVERED');
    expect(mockOrderRepository.update).toHaveBeenCalledWith('order-1', {
      delivered: true,
      deliveryStatus: 'DELIVERED',
    });
  });

  it('should throw error for non-online orders', async () => {
    const localOrder = new Order(
      'order-1', new Date(), true, 1, 150, 150, 0,
      false, 'table-1', 0, 'Local', null, false, null, 'user-1',
      null, null, null, null, null, null, null, null,
      new Date(), new Date()
    );
    mockOrderRepository.findById.mockResolvedValue(localOrder);

    await expect(useCase.execute('order-1', { status: 'PREPARING' }))
      .rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('should throw error when order not found', async () => {
    mockOrderRepository.findById.mockResolvedValue(null);

    await expect(useCase.execute('nonexistent', { status: 'PREPARING' }))
      .rejects.toMatchObject({ code: 'ORDER_NOT_FOUND' });
  });

  it('should throw error when order is already delivered', async () => {
    mockOrderRepository.findById.mockResolvedValue(makeOnlineOrder(true, 'DELIVERED'));

    await expect(useCase.execute('order-1', { status: 'PREPARING' }))
      .rejects.toMatchObject({ code: 'ORDER_ALREADY_DELIVERED' });
  });
});
