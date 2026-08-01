import { GetPublicCheckoutStatusUseCase } from '../../../../src/core/application/use-cases/orders/get-public-checkout-status.use-case';
import { GetPublicOrderStatusUseCase, PublicOrderStatus } from '../../../../src/core/application/use-cases/orders/get-public-order-status.use-case';
import { IPendingCheckoutRepository, PendingCheckout } from '../../../../src/core/domain/interfaces/pending-checkout-repository.interface';
import * as tenantContext from '../../../../src/core/infrastructure/tenant/tenant-context';

jest.mock('../../../../src/core/infrastructure/tenant/tenant-context', () => ({
  withoutTenant: jest.fn((fn: () => Promise<unknown>) => fn()),
}));

describe('GetPublicCheckoutStatusUseCase', () => {
  let useCase: GetPublicCheckoutStatusUseCase;
  let mockPendingCheckoutRepository: jest.Mocked<IPendingCheckoutRepository>;
  let mockGetPublicOrderStatus: jest.Mocked<Pick<GetPublicOrderStatusUseCase, 'execute'>>;

  function makeCheckout(overrides: Partial<PendingCheckout> = {}): PendingCheckout {
    return {
      id: 'checkout-1',
      branchId: 'branch-1',
      status: 'WAITING',
      cart: [],
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
      mpPreferenceId: null,
      paymentId: null,
      orderId: null,
      expiresAt: new Date(),
      createdAt: new Date(),
      ...overrides,
    } as PendingCheckout;
  }

  function makeStatus(): PublicOrderStatus {
    return {
      status: 'PENDING_PAYMENT',
      trackingToken: 'track-xyz',
      customerName: 'Ana',
      orderType: 'PICKUP',
      scheduledAt: null,
      items: [],
      total: 150,
      createdAt: '2026-01-01T00:00:00.000Z',
      branchSlug: 'mi-restaurante',
    };
  }

  beforeEach(() => {
    mockPendingCheckoutRepository = {
      findById: jest.fn(),
      findByTrackingToken: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    };

    mockGetPublicOrderStatus = {
      execute: jest.fn().mockResolvedValue(makeStatus()),
    };

    useCase = new GetPublicCheckoutStatusUseCase(
      mockPendingCheckoutRepository,
      mockGetPublicOrderStatus as unknown as GetPublicOrderStatusUseCase
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('resuelve el status público de la orden a partir del trackingToken del checkout', async () => {
    mockPendingCheckoutRepository.findById.mockResolvedValue(makeCheckout());

    const result = await useCase.execute({ checkoutId: 'checkout-1' });

    expect(tenantContext.withoutTenant).toHaveBeenCalled();
    expect(mockPendingCheckoutRepository.findById).toHaveBeenCalledWith('checkout-1');
    expect(mockGetPublicOrderStatus.execute).toHaveBeenCalledWith('track-xyz');
    expect(result).toEqual(makeStatus());
  });

  it('lanza ORDER_NOT_FOUND si el checkout no existe', async () => {
    mockPendingCheckoutRepository.findById.mockResolvedValue(null);

    await expect(useCase.execute({ checkoutId: 'missing' })).rejects.toMatchObject({
      code: 'ORDER_NOT_FOUND',
    });
    expect(mockGetPublicOrderStatus.execute).not.toHaveBeenCalled();
  });
});
