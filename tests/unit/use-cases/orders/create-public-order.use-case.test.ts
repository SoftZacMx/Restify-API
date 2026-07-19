import { CreatePublicOrderUseCase } from '../../../../src/core/application/use-cases/orders/create-public-order.use-case';
import { IBranchRepository } from '../../../../src/core/domain/interfaces/branch-repository.interface';
import { PublicOrderPersistenceService } from '../../../../src/core/application/services/public-order-persistence.service';
import { Branch } from '../../../../src/core/domain/entities/branch.entity';
import { AppError } from '../../../../src/shared/errors';

describe('CreatePublicOrderUseCase', () => {
  let useCase: CreatePublicOrderUseCase;
  let mockBranchRepository: jest.Mocked<IBranchRepository>;
  let mockPersistence: jest.Mocked<PublicOrderPersistenceService>;

  // Branch base: sin horarios de operación (permite cualquier hora).
  function makeBranch(overrides: Partial<{ startOperations: string | null; endOperations: string | null }> = {}): Branch {
    return new Branch(
      'branch-1', 'org-1', 'Sucursal Centro', 'CDMX', 'CDMX', 'Calle 1', '10',
      '5512345678', null, null,
      overrides.startOperations ?? null,
      overrides.endOperations ?? null,
      null, null, 'America/Mexico_City', 'MXN', 'active',
      new Date(), new Date(), null
    );
  }

  const persistedResult = {
    id: 'order-1',
    trackingToken: 'token-abc',
    total: 120,
    subtotal: 120,
    origin: 'online-delivery',
    createdAt: new Date(),
  };

  beforeEach(() => {
    mockBranchRepository = {
      findById: jest.fn().mockResolvedValue(makeBranch()),
      findBySlug: jest.fn(),
      findByIdAndOrganizationId: jest.fn(),
      findAllIdsByOrganizationId: jest.fn(),
      findManyByOrganizationId: jest.fn(),
      findManyForList: jest.fn(),
      countActiveByOrganizationId: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    } as any;

    mockPersistence = {
      validateAndPrice: jest.fn(),
      persistOrder: jest.fn().mockResolvedValue(persistedResult),
    } as any;

    useCase = new CreatePublicOrderUseCase(mockBranchRepository, mockPersistence);
  });

  afterEach(() => jest.clearAllMocks());

  it('should create a delivery order delegating to the persistence service', async () => {
    const result = await useCase.execute({
      branchId: 'branch-1',
      customerName: 'Juan',
      customerPhone: '5512345678',
      orderType: 'DELIVERY',
      deliveryAddress: 'Calle 1',
      latitude: 19.43,
      longitude: -99.13,
      items: [{ menuItemId: 'menu-1', quantity: 1 }],
    });

    expect(result.trackingToken).toBe('token-abc');
    expect(result.origin).toBe('online-delivery');
    expect(result.customerName).toBe('Juan');
    expect(result.orderType).toBe('DELIVERY');
    expect(mockPersistence.persistOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        branchId: 'branch-1',
        customerName: 'Juan',
        customerPhone: '5512345678',
        orderType: 'DELIVERY',
        deliveryAddress: 'Calle 1',
        items: [{ menuItemId: 'menu-1', quantity: 1 }],
      })
    );
  });

  it('should not forward a delivery address for pickup orders', async () => {
    mockPersistence.persistOrder.mockResolvedValue({ ...persistedResult, origin: 'online-pickup' });

    const result = await useCase.execute({
      branchId: 'branch-1',
      customerName: 'Maria',
      customerPhone: '5598765432',
      orderType: 'PICKUP',
      deliveryAddress: 'ignorada',
      items: [{ menuItemId: 'menu-1', quantity: 1 }],
    });

    expect(result.origin).toBe('online-pickup');
    expect(mockPersistence.persistOrder).toHaveBeenCalledWith(
      expect.objectContaining({ orderType: 'PICKUP', deliveryAddress: null })
    );
  });

  it('should parse scheduledAt into a Date before persisting', async () => {
    const scheduledAt = new Date(2026, 3, 12, 12, 0).toISOString();

    await useCase.execute({
      branchId: 'branch-1',
      customerName: 'Juan',
      customerPhone: '5512345678',
      orderType: 'DELIVERY',
      scheduledAt,
      items: [{ menuItemId: 'menu-1', quantity: 1 }],
    });

    const arg = mockPersistence.persistOrder.mock.calls[0][0];
    expect(arg.scheduledAt).toBeInstanceOf(Date);
    expect(arg.scheduledAt?.toISOString()).toBe(scheduledAt);
  });

  it('should throw BRANCH_NOT_FOUND when branch does not exist', async () => {
    mockBranchRepository.findById.mockResolvedValue(null);

    await expect(useCase.execute({
      branchId: 'nonexistent',
      customerName: 'Juan',
      customerPhone: '5512345678',
      orderType: 'DELIVERY',
      items: [{ menuItemId: 'menu-1', quantity: 1 }],
    })).rejects.toMatchObject({ code: 'BRANCH_NOT_FOUND' });

    expect(mockPersistence.persistOrder).not.toHaveBeenCalled();
  });

  it('should propagate validation errors thrown by persistOrder', async () => {
    mockPersistence.persistOrder.mockRejectedValue(
      new AppError('MENU_ITEM_NOT_FOUND', 'Menu item with ID nope not found')
    );

    await expect(useCase.execute({
      branchId: 'branch-1',
      customerName: 'Juan',
      customerPhone: '5512345678',
      orderType: 'DELIVERY',
      items: [{ menuItemId: 'nope', quantity: 1 }],
    })).rejects.toMatchObject({ code: 'MENU_ITEM_NOT_FOUND' });
  });

  it('should throw OUTSIDE_OPERATING_HOURS when scheduled outside hours', async () => {
    mockBranchRepository.findById.mockResolvedValue(
      makeBranch({ startOperations: '09:00', endOperations: '22:00' })
    );

    await expect(useCase.execute({
      branchId: 'branch-1',
      customerName: 'Juan',
      customerPhone: '5512345678',
      orderType: 'PICKUP',
      scheduledAt: new Date(2026, 3, 12, 23, 0).toISOString(),
      items: [{ menuItemId: 'menu-1', quantity: 1 }],
    })).rejects.toMatchObject({ code: 'OUTSIDE_OPERATING_HOURS' });

    expect(mockPersistence.persistOrder).not.toHaveBeenCalled();
  });

  it('should allow order when no operating hours configured', async () => {
    mockBranchRepository.findById.mockResolvedValue(makeBranch());

    const result = await useCase.execute({
      branchId: 'branch-1',
      customerName: 'Juan',
      customerPhone: '5512345678',
      orderType: 'DELIVERY',
      items: [{ menuItemId: 'menu-1', quantity: 1 }],
    });

    expect(result.trackingToken).toBeDefined();
  });
});
