import { GetSaleTicketUseCase } from '../../../../src/core/application/use-cases/tickets/get-sale-ticket.use-case';
import { IOrderRepository } from '../../../../src/core/domain/interfaces/order-repository.interface';
import { ITableRepository } from '../../../../src/core/domain/interfaces/table-repository.interface';
import { IProductRepository } from '../../../../src/core/domain/interfaces/product-repository.interface';
import { IMenuItemRepository } from '../../../../src/core/domain/interfaces/menu-item-repository.interface';
import { IBranchRepository } from '../../../../src/core/domain/interfaces/branch-repository.interface';
import { Order } from '../../../../src/core/domain/entities/order.entity';
import { OrderItem } from '../../../../src/core/domain/entities/order-item.entity';
import { OrderItemExtra } from '../../../../src/core/domain/entities/order-item-extra.entity';
import { Branch } from '../../../../src/core/domain/entities/branch.entity';
import { Table } from '../../../../src/core/domain/entities/table.entity';
import { Product } from '../../../../src/core/domain/entities/product.entity';
import { MenuItem } from '../../../../src/core/domain/entities/menu-item.entity';

describe('GetSaleTicketUseCase', () => {
  let useCase: GetSaleTicketUseCase;
  let orderRepository: jest.Mocked<IOrderRepository>;
  let tableRepository: jest.Mocked<ITableRepository>;
  let productRepository: jest.Mocked<IProductRepository>;
  let menuItemRepository: jest.Mocked<IMenuItemRepository>;
  let branchRepository: jest.Mocked<IBranchRepository>;

  beforeEach(() => {
    orderRepository = {
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
    tableRepository = {
      findById: jest.fn(),
      findByName: jest.fn(),
      findAll: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
    productRepository = {
      findById: jest.fn(),
      findByIds: jest.fn(),
      findAll: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
    menuItemRepository = {
      findById: jest.fn(),
      findByIds: jest.fn(),
      findAll: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
    branchRepository = {
      findById: jest.fn(),
      findBySlug: jest.fn(),
      findByIdAndOrganizationId: jest.fn(),
      findAllIdsByOrganizationId: jest.fn(),
      findManyByOrganizationId: jest.fn(),
      findManyForList: jest.fn(),
      countActiveByOrganizationId: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    };

    useCase = new GetSaleTicketUseCase(
      orderRepository,
      tableRepository,
      productRepository,
      menuItemRepository,
      branchRepository
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  function makeOrder(overrides: Record<string, any> = {}): Order {
    return new Order(
      overrides.id ?? 'order-12345678',
      overrides.date ?? new Date('2026-07-01T12:00:00Z'),
      overrides.status ?? false,
      overrides.paymentMethod === undefined ? 1 : overrides.paymentMethod,
      overrides.total ?? 133.79,
      overrides.subtotal ?? 100,
      overrides.iva ?? 13.79,
      overrides.delivered ?? false,
      overrides.tableId ?? null,
      overrides.tip ?? 20,
      overrides.origin ?? 'local',
      overrides.client ?? null,
      overrides.paymentDiffer ?? false,
      overrides.note ?? null,
      overrides.userId ?? null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      overrides.branchId ?? null,
      new Date(),
      new Date()
    );
  }

  function makeOrderItem(overrides: Record<string, any> = {}): OrderItem {
    return new OrderItem(
      overrides.id ?? 'item-a',
      overrides.quantity ?? 1,
      overrides.price ?? 10,
      overrides.orderId ?? 'order-12345678',
      overrides.productId ?? null,
      overrides.menuItemId ?? null,
      overrides.note ?? null,
      new Date(),
      new Date()
    );
  }

  function makeExtra(overrides: Record<string, any> = {}): OrderItemExtra {
    return new OrderItemExtra(
      overrides.id ?? 'extra-1',
      overrides.orderId ?? 'order-12345678',
      overrides.orderItemId ?? 'item-a',
      overrides.extraId ?? 'extra-1',
      overrides.quantity ?? 1,
      overrides.price ?? 3,
      new Date(),
      new Date()
    );
  }

  function makeBranch(ticketConfig: unknown | null): Branch {
    return new Branch(
      'branch-1',
      'org-1',
      'Sucursal Norte',
      'CDMX',
      'CDMX',
      'Reforma',
      '1',
      '555',
      null,
      null,
      null,
      null,
      ticketConfig,
      null,
      'America/Mexico_City',
      'MXN',
      'active',
      new Date(),
      new Date(),
      null
    );
  }

  function makeTable(): Table {
    return new Table('table-1', 'Mesa 1', 'user-1', true, true, new Date(), new Date());
  }

  function makeMenuItem(id: string, name: string): MenuItem {
    return new MenuItem(id, name, 10, true, false, null, 'user-1', new Date(), new Date());
  }

  it('lanza ORDER_NOT_FOUND cuando la orden no existe', async () => {
    orderRepository.findById.mockResolvedValue(null);

    await expect(useCase.execute('order-nope')).rejects.toMatchObject({
      code: 'ORDER_NOT_FOUND',
    });
    expect(orderRepository.findOrderItemsByOrderId).not.toHaveBeenCalled();
  });

  it('genera el ticket de venta completo con mesa, sucursal y cliente', async () => {
    const order = makeOrder({
      tableId: 'table-1',
      branchId: 'branch-1',
      client: 'Cliente Uno',
      note: 'Para llevar',
      delivered: true,
      paymentMethod: 3,
      total: 133.79,
      subtotal: 100,
      iva: 13.79,
      tip: 20,
      date: new Date('2026-07-01T12:00:00Z'),
    });
    const item1 = makeOrderItem({ id: 'item-a', productId: 'product-1', quantity: 2, price: 50, note: 'sin cebolla' });
    const item2 = makeOrderItem({ id: 'item-b', menuItemId: 'menu-1', price: 40 });
    const extra1 = makeExtra({ orderItemId: 'item-a', extraId: 'extra-1', quantity: 1, price: 5 });
    const extra2 = makeExtra({ id: 'extra-2', orderItemId: 'item-a', extraId: 'extra-2', quantity: 2, price: 3 });

    orderRepository.findById.mockResolvedValue(order);
    orderRepository.findOrderItemsByOrderId.mockResolvedValue([item1, item2]);
    orderRepository.findOrderItemExtrasByOrderId.mockResolvedValue([extra1, extra2]);
    tableRepository.findById.mockResolvedValue(makeTable());
    branchRepository.findById.mockResolvedValue(makeBranch({ schemaVersion: 1 }));
    productRepository.findByIds.mockResolvedValue([
      new Product('product-1', 'Pizza', null, new Date(), true, 'user-1', new Date(), new Date()),
    ]);
    menuItemRepository.findById.mockImplementation(async (id) => {
      if (id === 'menu-1') return makeMenuItem('menu-1', 'Hamburguesa');
      if (id === 'extra-1') return makeMenuItem('extra-1', 'Queso');
      return makeMenuItem('extra-2', 'Tocino');
    });

    const result = await useCase.execute('order-12345678');

    expect(result.companyName).toBe('Sucursal Norte');
    expect(result.orderId).toBe('order-12345678');
    expect(result.date).toBe('2026-07-01T12:00:00.000Z');
    expect(result.origin).toBe('local');
    expect(result.tableName).toBe('Mesa 1');
    expect(result.client).toBe('Cliente Uno');
    expect(result.paymentMethod).toBe('Tarjeta');
    expect(result.delivered).toBe(true);
    expect(result.subtotal).toBe(100);
    expect(result.iva).toBe(13.79);
    expect(result.tip).toBe(20);
    expect(result.total).toBe(133.79);
    expect(result.items[0]).toEqual({
      name: 'Pizza',
      quantity: 2,
      price: 50,
      lineTotal: 111,
      note: 'sin cebolla',
      extras: [
        { name: 'Queso', quantity: 1, price: 5 },
        { name: 'Tocino', quantity: 2, price: 3 },
      ],
    });
    expect(result.items[1]).toEqual({ name: 'Hamburguesa', quantity: 1, price: 40, lineTotal: 40, extras: [] });
    expect(result.lines[0]).toBe('--- TICKET ---');
    expect(result.lines[1]).toMatch(/^Fecha: /);
    expect(result.lines).toContain('Mesa: Mesa 1');
    expect(result.lines).toContain('Cliente: Cliente Uno');
    expect(result.lines).toContain('Nota: Para llevar');
    expect(result.lines).toContain('2  Pizza  111.00');
    expect(result.lines).toContain('    + Queso (1)  5.00');
    expect(result.lines).toContain('    + Tocino (2)  6.00');
    expect(result.lines).toContain('    Nota: sin cebolla');
    expect(result.lines).toContain('Subtotal:    100.00');
    expect(result.lines).toContain('IVA:         13.79');
    expect(result.lines).toContain('Propina:     20.00');
    expect(result.lines).toContain('TOTAL:       133.79');
    expect(result.lines).toContain('Método:      Tarjeta');
    expect(result.lines).toContain('Entregado:   Sí');
    expect(result.printConfig.schemaVersion).toBe(1);
  });

  it('usa valores por defecto cuando faltan mesa, sucursal, cliente y nombres', async () => {
    const order = makeOrder({
      tableId: null,
      branchId: null,
      client: null,
      note: '   ',
      paymentMethod: null,
      delivered: false,
    });
    const item1 = makeOrderItem({ id: 'item-a', productId: 'missing-product' });
    const item2 = makeOrderItem({ id: 'item-b', menuItemId: 'missing-menu' });
    const item3 = makeOrderItem({ id: 'item-c', productId: null, menuItemId: null });
    const extra = makeExtra({ orderItemId: 'item-a', extraId: 'missing-extra' });

    orderRepository.findById.mockResolvedValue(order);
    orderRepository.findOrderItemsByOrderId.mockResolvedValue([item1, item2, item3]);
    orderRepository.findOrderItemExtrasByOrderId.mockResolvedValue([extra]);
    productRepository.findByIds.mockResolvedValue([]);
    menuItemRepository.findById.mockResolvedValue(null);

    const result = await useCase.execute('order-12345678');

    expect(result.companyName).toBe('Restify');
    expect(result.tableName).toBeNull();
    expect(result.client).toBeNull();
    expect(result.paymentMethod).toBe('Pago dividido');
    expect(result.delivered).toBe(false);
    expect(result.items[0].name).toBe('Producto');
    expect(result.items[1].name).toBe('Ítem');
    expect(result.items[2].name).toBe('Ítem');
    expect(result.items[0].extras[0].name).toBe('Extra');
    expect(result.items[2].extras).toEqual([]);
    expect(result.items[2].note).toBeUndefined();
    expect(result.lines).toContain('Para llevar');
    expect(result.lines).not.toContain('Cliente:');
    expect(result.lines).not.toContain('Nota:');
    expect(result.lines).toContain('Entregado:   No');
    expect(tableRepository.findById).not.toHaveBeenCalled();
    expect(branchRepository.findById).not.toHaveBeenCalled();
  });

  it('no consulta productos cuando ningún ítem tiene productId', async () => {
    const order = makeOrder({ tableId: null, branchId: 'branch-1' });
    const item = makeOrderItem({ id: 'item-a', menuItemId: 'menu-1' });

    orderRepository.findById.mockResolvedValue(order);
    orderRepository.findOrderItemsByOrderId.mockResolvedValue([item]);
    orderRepository.findOrderItemExtrasByOrderId.mockResolvedValue([]);
    branchRepository.findById.mockResolvedValue(makeBranch(null));
    menuItemRepository.findById.mockResolvedValue(makeMenuItem('menu-1', 'Tacos'));

    const result = await useCase.execute('order-12345678');

    expect(result.items[0].name).toBe('Tacos');
    expect(result.companyName).toBe('Sucursal Norte');
    expect(productRepository.findByIds).not.toHaveBeenCalled();
    expect(menuItemRepository.findById).toHaveBeenCalledTimes(1);
  });

  it.each([
    [null, 'Pago dividido'],
    [1, 'Efectivo'],
    [2, 'Transferencia'],
    [3, 'Tarjeta'],
    [4, 'QR Mercado Pago'],
    [5, 'Otro'],
  ] as const)('mapea el método de pago %p a "%s"', async (paymentMethod, label) => {
    const order = makeOrder({ paymentMethod, tableId: null, branchId: null });

    orderRepository.findById.mockResolvedValue(order);
    orderRepository.findOrderItemsByOrderId.mockResolvedValue([]);
    orderRepository.findOrderItemExtrasByOrderId.mockResolvedValue([]);

    const result = await useCase.execute('order-12345678');

    expect(result.paymentMethod).toBe(label);
  });
});
