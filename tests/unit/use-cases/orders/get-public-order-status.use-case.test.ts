import { GetPublicOrderStatusUseCase } from '../../../../src/core/application/use-cases/orders/get-public-order-status.use-case';
import { IOrderRepository } from '../../../../src/core/domain/interfaces/order-repository.interface';
import { IMenuItemRepository } from '../../../../src/core/domain/interfaces/menu-item-repository.interface';
import { Order } from '../../../../src/core/domain/entities/order.entity';
import { OrderItem } from '../../../../src/core/domain/entities/order-item.entity';
import { MenuItem } from '../../../../src/core/domain/entities/menu-item.entity';
import { AppError } from '../../../../src/shared/errors';

describe('GetPublicOrderStatusUseCase', () => {
  let useCase: GetPublicOrderStatusUseCase;
  let mockOrderRepository: jest.Mocked<IOrderRepository>;
  let mockMenuItemRepository: jest.Mocked<IMenuItemRepository>;

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

    mockMenuItemRepository = {
      findById: jest.fn(),
      findByIds: jest.fn(),
      findAll: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    useCase = new GetPublicOrderStatusUseCase(mockOrderRepository, mockMenuItemRepository);
  });

  afterEach(() => jest.clearAllMocks());

  it('should return PENDING_PAYMENT when order is not paid', async () => {
    const order = new Order(
      'order-1', new Date(), false, null, 150, 150, 0,
      false, null, 0, 'online-delivery', null, false, null, null,
      'Juan', '5512345678', null, null, null, null, 'token-abc', null,
      new Date(), new Date()
    );
    mockOrderRepository.findByTrackingToken.mockResolvedValue(order);
    mockOrderRepository.findOrderItemsByOrderId.mockResolvedValue([]);
    mockMenuItemRepository.findByIds.mockResolvedValue([]);

    const result = await useCase.execute('token-abc');

    expect(result.status).toBe('PENDING_PAYMENT');
    expect(result.customerName).toBe('Juan');
    expect(result.orderType).toBe('DELIVERY');
  });

  it('should return deliveryStatus when it exists', async () => {
    const order = new Order(
      'order-1', new Date(), true, 4, 150, 150, 0,
      false, null, 0, 'online-delivery', null, false, null, null,
      'Juan', '5512345678', null, null, null, null, 'token-abc', 'PREPARING',
      new Date(), new Date()
    );
    mockOrderRepository.findByTrackingToken.mockResolvedValue(order);
    mockOrderRepository.findOrderItemsByOrderId.mockResolvedValue([]);
    mockMenuItemRepository.findByIds.mockResolvedValue([]);

    const result = await useCase.execute('token-abc');

    expect(result.status).toBe('PREPARING');
  });

  it('should resolve item names from menu items', async () => {
    const order = new Order(
      'order-1', new Date(), true, 4, 150, 150, 0,
      false, null, 0, 'online-delivery', null, false, null, null,
      'Juan', '5512345678', null, null, null, null, 'token-abc', 'PAID',
      new Date(), new Date()
    );
    const orderItem = new OrderItem('oi-1', 2, 75, 'order-1', null, 'menu-1', null, new Date(), new Date());
    const menuItem = new MenuItem('menu-1', 'Hamburguesa', 75, true, false, 'cat-1', 'user-1', new Date(), new Date());

    mockOrderRepository.findByTrackingToken.mockResolvedValue(order);
    mockOrderRepository.findOrderItemsByOrderId.mockResolvedValue([orderItem]);
    mockMenuItemRepository.findByIds.mockResolvedValue([menuItem]);

    const result = await useCase.execute('token-abc');

    expect(result.items).toHaveLength(1);
    expect(result.items[0].name).toBe('Hamburguesa');
    expect(result.items[0].quantity).toBe(2);
    expect(result.items[0].total).toBe(150);
  });

  it('should return PICKUP type for online-pickup origin', async () => {
    const order = new Order(
      'order-1', new Date(), true, 4, 150, 150, 0,
      false, null, 0, 'online-pickup', null, false, null, null,
      'Maria', '5598765432', null, null, null, null, 'token-xyz', 'READY',
      new Date(), new Date()
    );
    mockOrderRepository.findByTrackingToken.mockResolvedValue(order);
    mockOrderRepository.findOrderItemsByOrderId.mockResolvedValue([]);
    mockMenuItemRepository.findByIds.mockResolvedValue([]);

    const result = await useCase.execute('token-xyz');

    expect(result.orderType).toBe('PICKUP');
    expect(result.status).toBe('READY');
  });

  it('should throw ORDER_NOT_FOUND when token does not exist', async () => {
    mockOrderRepository.findByTrackingToken.mockResolvedValue(null);

    await expect(useCase.execute('nonexistent')).rejects.toMatchObject({ code: 'ORDER_NOT_FOUND' });
  });
});
