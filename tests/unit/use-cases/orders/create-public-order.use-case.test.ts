import { CreatePublicOrderUseCase } from '../../../../src/core/application/use-cases/orders/create-public-order.use-case';
import { IMenuItemRepository } from '../../../../src/core/domain/interfaces/menu-item-repository.interface';
import { ICompanyRepository } from '../../../../src/core/domain/interfaces/company-repository.interface';
import { PrismaService } from '../../../../src/core/infrastructure/config/prisma.config';
import { MenuItem } from '../../../../src/core/domain/entities/menu-item.entity';
import { AppError } from '../../../../src/shared/errors';

function createMockPrismaService(orderOverrides: Record<string, any> = {}) {
  const mockTx = {
    order: {
      create: jest.fn().mockResolvedValue({
        id: 'order-1',
        date: new Date(),
        status: false,
        paymentMethod: null,
        total: 120,
        subtotal: 120,
        iva: 0,
        delivered: false,
        tableId: null,
        tip: 0,
        origin: 'online-delivery',
        client: null,
        paymentDiffer: false,
        note: null,
        userId: null,
        customerName: 'Juan',
        customerPhone: '5512345678',
        trackingToken: 'token-abc',
        createdAt: new Date(),
        updatedAt: new Date(),
        ...orderOverrides,
      }),
    },
    orderItem: {
      create: jest.fn().mockResolvedValue({
        id: 'item-1',
        quantity: 1,
        price: 120,
        orderId: 'order-1',
        productId: null,
        menuItemId: 'menu-1',
        note: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    },
    orderItemExtra: {
      create: jest.fn().mockResolvedValue({}),
    },
  };

  return {
    getClient: jest.fn().mockReturnValue({
      $transaction: jest.fn().mockImplementation((cb: Function) => cb(mockTx)),
    }),
    connect: jest.fn(),
    disconnect: jest.fn(),
    healthCheck: jest.fn(),
    mockTx,
  } as unknown as jest.Mocked<PrismaService> & { mockTx: typeof mockTx };
}

describe('CreatePublicOrderUseCase', () => {
  let useCase: CreatePublicOrderUseCase;
  let mockMenuItemRepository: jest.Mocked<IMenuItemRepository>;
  let mockCompanyRepository: jest.Mocked<ICompanyRepository>;
  let mockPrismaService: ReturnType<typeof createMockPrismaService>;

  const mockMenuItem = new MenuItem(
    'menu-1', 'Hamburguesa', 120, true, false, 'cat-1', 'user-1', new Date(), new Date()
  );

  const mockExtra = new MenuItem(
    'extra-1', 'Queso extra', 15, true, true, 'cat-1', 'user-1', new Date(), new Date()
  );

  beforeEach(() => {
    mockMenuItemRepository = {
      findById: jest.fn(),
      findByIds: jest.fn(),
      findAll: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    mockCompanyRepository = {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
      update: jest.fn(),
    };

    mockPrismaService = createMockPrismaService();

    useCase = new CreatePublicOrderUseCase(
      mockMenuItemRepository,
      mockCompanyRepository,
      mockPrismaService as any,
    );
  });

  afterEach(() => jest.clearAllMocks());

  it('should create a delivery order with userId null and trackingToken', async () => {
    mockMenuItemRepository.findById.mockResolvedValue(mockMenuItem);

    const result = await useCase.execute({
      customerName: 'Juan',
      customerPhone: '5512345678',
      orderType: 'DELIVERY',
      deliveryAddress: 'Calle 1',
      latitude: 19.43,
      longitude: -99.13,
      items: [{ menuItemId: 'menu-1', quantity: 1 }],
    });

    expect(result.trackingToken).toBeDefined();
    expect(result.origin).toBe('online-delivery');
    expect(result.customerName).toBe('Juan');
    expect(mockPrismaService.mockTx.order.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: null,
        origin: 'online-delivery',
        customerName: 'Juan',
        customerPhone: '5512345678',
      }),
    });
  });

  it('should create a pickup order with origin online-pickup', async () => {
    mockMenuItemRepository.findById.mockResolvedValue(mockMenuItem);
    mockPrismaService.mockTx.order.create.mockResolvedValue({
      id: 'order-1',
      origin: 'online-pickup',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await useCase.execute({
      customerName: 'Maria',
      customerPhone: '5598765432',
      orderType: 'PICKUP',
      items: [{ menuItemId: 'menu-1', quantity: 1 }],
    });

    expect(result.origin).toBe('online-pickup');
  });

  it('should throw error when items array is empty', async () => {
    await expect(useCase.execute({
      customerName: 'Juan',
      customerPhone: '5512345678',
      orderType: 'DELIVERY',
      items: [],
    })).rejects.toThrow(AppError);
  });

  it('should throw error when menu item not found', async () => {
    mockMenuItemRepository.findById.mockResolvedValue(null);

    await expect(useCase.execute({
      customerName: 'Juan',
      customerPhone: '5512345678',
      orderType: 'DELIVERY',
      items: [{ menuItemId: 'nonexistent', quantity: 1 }],
    })).rejects.toMatchObject({ code: 'MENU_ITEM_NOT_FOUND' });
  });

  it('should throw error when menu item is inactive', async () => {
    const inactiveItem = new MenuItem(
      'menu-1', 'Hamburguesa', 120, false, false, 'cat-1', 'user-1', new Date(), new Date()
    );
    mockMenuItemRepository.findById.mockResolvedValue(inactiveItem);

    await expect(useCase.execute({
      customerName: 'Juan',
      customerPhone: '5512345678',
      orderType: 'DELIVERY',
      items: [{ menuItemId: 'menu-1', quantity: 1 }],
    })).rejects.toMatchObject({ code: 'MENU_ITEM_NOT_AVAILABLE' });
  });

  it('should throw error when menu item is an extra', async () => {
    mockMenuItemRepository.findById.mockResolvedValue(mockExtra);

    await expect(useCase.execute({
      customerName: 'Juan',
      customerPhone: '5512345678',
      orderType: 'DELIVERY',
      items: [{ menuItemId: 'extra-1', quantity: 1 }],
    })).rejects.toMatchObject({ code: 'INVALID_MENU_ITEM' });
  });

  it('should use transaction for order + items creation', async () => {
    mockMenuItemRepository.findById.mockResolvedValue(mockMenuItem);

    await useCase.execute({
      customerName: 'Juan',
      customerPhone: '5512345678',
      orderType: 'DELIVERY',
      items: [{ menuItemId: 'menu-1', quantity: 1 }],
    });

    // Verify $transaction was called
    const client = mockPrismaService.getClient();
    expect(client.$transaction).toHaveBeenCalled();

    // Verify order and item were created inside transaction
    expect(mockPrismaService.mockTx.order.create).toHaveBeenCalled();
    expect(mockPrismaService.mockTx.orderItem.create).toHaveBeenCalled();
  });

  it('should create extras inside transaction', async () => {
    mockMenuItemRepository.findById
      .mockResolvedValueOnce(mockMenuItem)  // item validation
      .mockResolvedValueOnce(mockExtra);    // extra validation

    await useCase.execute({
      customerName: 'Juan',
      customerPhone: '5512345678',
      orderType: 'DELIVERY',
      items: [{
        menuItemId: 'menu-1',
        quantity: 2,
        extras: [{ extraId: 'extra-1', quantity: 1 }],
      }],
    });

    expect(mockPrismaService.mockTx.orderItemExtra.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        extraId: 'extra-1',
        price: 15,
      }),
    });
  });

  it('should throw OUTSIDE_OPERATING_HOURS when current time is outside hours', async () => {
    // Simular horario 09:00 - 22:00, y forzar hora actual fuera de rango
    mockCompanyRepository.findFirst.mockResolvedValue({
      id: 'company-1',
      name: 'Test',
      state: '',
      city: '',
      street: '',
      exteriorNumber: '',
      phone: '',
      rfc: null,
      logoUrl: null,
      startOperations: '09:00',
      endOperations: '22:00',
      ticketConfig: null,
      paymentConfig: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // scheduledAt a las 23:00 (fuera de horario)
    await expect(useCase.execute({
      customerName: 'Juan',
      customerPhone: '5512345678',
      orderType: 'PICKUP',
      scheduledAt: new Date(2026, 3, 12, 23, 0).toISOString(),
      items: [{ menuItemId: 'menu-1', quantity: 1 }],
    })).rejects.toMatchObject({ code: 'OUTSIDE_OPERATING_HOURS' });
  });

  it('should allow order when no operating hours configured', async () => {
    mockCompanyRepository.findFirst.mockResolvedValue(null);
    mockMenuItemRepository.findById.mockResolvedValue(mockMenuItem);

    const result = await useCase.execute({
      customerName: 'Juan',
      customerPhone: '5512345678',
      orderType: 'DELIVERY',
      items: [{ menuItemId: 'menu-1', quantity: 1 }],
    });

    expect(result.trackingToken).toBeDefined();
  });
});
