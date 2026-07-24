import { GetPublicOrderStatusUseCase } from '../../../../src/core/application/use-cases/orders/get-public-order-status.use-case';
import { IOrderRepository } from '../../../../src/core/domain/interfaces/order-repository.interface';
import { IMenuItemRepository } from '../../../../src/core/domain/interfaces/menu-item-repository.interface';
import { IBranchRepository } from '../../../../src/core/domain/interfaces/branch-repository.interface';
import { IPendingCheckoutRepository, PendingCheckout } from '../../../../src/core/domain/interfaces/pending-checkout-repository.interface';
import { Branch } from '../../../../src/core/domain/entities/branch.entity';
import { Order } from '../../../../src/core/domain/entities/order.entity';
import { OrderItem } from '../../../../src/core/domain/entities/order-item.entity';
import { MenuItem } from '../../../../src/core/domain/entities/menu-item.entity';
import { AppError } from '../../../../src/shared/errors';

describe('GetPublicOrderStatusUseCase', () => {
  let useCase: GetPublicOrderStatusUseCase;
  let mockOrderRepository: jest.Mocked<IOrderRepository>;
  let mockMenuItemRepository: jest.Mocked<IMenuItemRepository>;
  let mockBranchRepository: jest.Mocked<IBranchRepository>;
  let mockPendingCheckoutRepository: jest.Mocked<IPendingCheckoutRepository>;

  beforeEach(() => {
    mockOrderRepository = {
      findById: jest.fn(),
      findByTrackingToken: jest.fn(),
      findAll: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      createWithItems: jest.fn(),
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

    mockBranchRepository = {
      findById: jest.fn(),
      findBySlug: jest.fn(),
      findByIdAndOrganizationId: jest.fn(),
      findAllIdsByOrganizationId: jest.fn(),
      findManyByOrganizationId: jest.fn(),
      findManyForList: jest.fn(),
      countActiveByOrganizationId: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    } as any;

    // Por defecto el branch existe con slug 'mi-restaurante'; los tests lo pueden sobreescribir.
    mockBranchRepository.findById.mockResolvedValue(
      new Branch(
        'branch-1', 'org-1', 'Sucursal Centro', 'CDMX', 'CDMX', 'Reforma', '100',
        '5551234567', null, null, null, null, null, null,
        'America/Mexico_City', 'MXN', 'active', new Date(), new Date(), null, 'mi-restaurante'
      )
    );

    mockPendingCheckoutRepository = {
      findById: jest.fn(),
      findByTrackingToken: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    };

    useCase = new GetPublicOrderStatusUseCase(
      mockOrderRepository,
      mockMenuItemRepository,
      mockBranchRepository,
      mockPendingCheckoutRepository
    );
  });

  afterEach(() => jest.clearAllMocks());

  function makeCheckout(overrides: Partial<PendingCheckout> = {}): PendingCheckout {
    return {
      id: 'checkout-1',
      branchId: 'branch-1',
      status: 'WAITING',
      cart: [{ menuItemId: 'menu-1', quantity: 2 }],
      customerName: 'Ana',
      customerPhone: '5551112222',
      orderType: 'PICKUP',
      deliveryAddress: null,
      latitude: null,
      longitude: null,
      scheduledAt: null,
      total: 150,
      subtotal: 150,
      trackingToken: 'track-xyz',
      mpPreferenceId: 'pref-1',
      paymentId: 'payment-1',
      orderId: null,
      expiresAt: new Date(),
      createdAt: new Date(),
      ...overrides,
    } as PendingCheckout;
  }

  it('should return PENDING_PAYMENT when order is not paid', async () => {
    const order = new Order(
      'order-1', new Date(), false, null, 150, 150, 0,
      false, null, 0, 'online-delivery', null, false, null, null,
      'Juan', '5512345678', null, null, null, null, 'token-abc', null, null,
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
      'Juan', '5512345678', null, null, null, null, 'token-abc', 'PREPARING', null,
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
      'Juan', '5512345678', null, null, null, null, 'token-abc', 'PAID', null,
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
      'Maria', '5598765432', null, null, null, null, 'token-xyz', 'READY', null,
      new Date(), new Date()
    );
    mockOrderRepository.findByTrackingToken.mockResolvedValue(order);
    mockOrderRepository.findOrderItemsByOrderId.mockResolvedValue([]);
    mockMenuItemRepository.findByIds.mockResolvedValue([]);

    const result = await useCase.execute('token-xyz');

    expect(result.orderType).toBe('PICKUP');
    expect(result.status).toBe('READY');
  });

  it('should throw ORDER_NOT_FOUND when neither order nor checkout exist', async () => {
    mockOrderRepository.findByTrackingToken.mockResolvedValue(null);
    mockPendingCheckoutRepository.findByTrackingToken.mockResolvedValue(null);

    await expect(useCase.execute('nonexistent')).rejects.toMatchObject({ code: 'ORDER_NOT_FOUND' });
  });

  describe('checkout diferido: fallback cuando la orden aún no existe', () => {
    it('should report PENDING_PAYMENT from a pending checkout draft', async () => {
      mockOrderRepository.findByTrackingToken.mockResolvedValue(null);
      mockPendingCheckoutRepository.findByTrackingToken.mockResolvedValue(makeCheckout());
      const menuItem = new MenuItem('menu-1', 'Hamburguesa', 75, true, false, 'cat-1', 'user-1', new Date(), new Date());
      mockMenuItemRepository.findByIds.mockResolvedValue([menuItem]);

      const result = await useCase.execute('track-xyz');

      expect(result.status).toBe('PENDING_PAYMENT');
      expect(result.customerName).toBe('Ana');
      expect(result.orderType).toBe('PICKUP');
      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toEqual({ name: 'Hamburguesa', quantity: 2, total: 150 });
      expect(result.total).toBe(150);
      // No debe consultar items de orden — la orden no existe.
      expect(mockOrderRepository.findOrderItemsByOrderId).not.toHaveBeenCalled();
    });

    it('should report PAYMENT_FAILED when the checkout draft is EXPIRED', async () => {
      mockOrderRepository.findByTrackingToken.mockResolvedValue(null);
      mockPendingCheckoutRepository.findByTrackingToken.mockResolvedValue(
        makeCheckout({ status: 'EXPIRED' })
      );
      const menuItem = new MenuItem('menu-1', 'Hamburguesa', 75, true, false, 'cat-1', 'user-1', new Date(), new Date());
      mockMenuItemRepository.findByIds.mockResolvedValue([menuItem]);

      const result = await useCase.execute('track-xyz');

      // El pago se canceló: la vista debe indicar que falló para que el cliente reintente.
      expect(result.status).toBe('PAYMENT_FAILED');
      // Incluye el slug del branch para poder redirigir de vuelta al menú al reintentar.
      expect(result.branchSlug).toBe('mi-restaurante');
    });

    it('should include extras in the reconstructed checkout total', async () => {
      mockOrderRepository.findByTrackingToken.mockResolvedValue(null);
      mockPendingCheckoutRepository.findByTrackingToken.mockResolvedValue(
        makeCheckout({
          cart: [{ menuItemId: 'menu-1', quantity: 1, extras: [{ extraId: 'extra-1', quantity: 2 }] }],
        })
      );
      const menuItem = new MenuItem('menu-1', 'Hamburguesa', 100, true, false, 'cat-1', 'user-1', new Date(), new Date());
      const extra = new MenuItem('extra-1', 'Queso', 15, true, true, 'cat-1', 'user-1', new Date(), new Date());
      mockMenuItemRepository.findByIds.mockResolvedValue([menuItem, extra]);

      const result = await useCase.execute('track-xyz');

      // 100 * 1 + 15 * 2 = 130
      expect(result.items[0].total).toBe(130);
    });

    it('should default missing menu item to "Item" with price 0', async () => {
      mockOrderRepository.findByTrackingToken.mockResolvedValue(null);
      mockPendingCheckoutRepository.findByTrackingToken.mockResolvedValue(makeCheckout());
      mockMenuItemRepository.findByIds.mockResolvedValue([]);

      const result = await useCase.execute('track-xyz');

      expect(result.items[0].name).toBe('Item');
      expect(result.items[0].total).toBe(0);
    });

    it('should prefer a real order over a checkout draft', async () => {
      const order = new Order(
        'order-1', new Date(), true, 4, 150, 150, 0,
        false, null, 0, 'online-pickup', null, false, null, null,
        'Real', '5500000000', null, null, null, null, 'track-xyz', 'PAID', null,
        new Date(), new Date()
      );
      mockOrderRepository.findByTrackingToken.mockResolvedValue(order);
      mockOrderRepository.findOrderItemsByOrderId.mockResolvedValue([]);
      mockMenuItemRepository.findByIds.mockResolvedValue([]);

      const result = await useCase.execute('track-xyz');

      expect(result.status).toBe('PAID');
      expect(result.customerName).toBe('Real');
      expect(mockPendingCheckoutRepository.findByTrackingToken).not.toHaveBeenCalled();
    });
  });
});
