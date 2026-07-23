import { StartPublicCheckoutUseCase, CHECKOUT_REF_PREFIX } from '../../../../src/core/application/use-cases/payments/start-public-checkout.use-case';
import { IBranchRepository } from '../../../../src/core/domain/interfaces/branch-repository.interface';
import { IPaymentRepository } from '../../../../src/core/domain/interfaces/payment-repository.interface';
import { IPaymentSessionRepository } from '../../../../src/core/domain/interfaces/payment-session-repository.interface';
import { IPendingCheckoutRepository } from '../../../../src/core/domain/interfaces/pending-checkout-repository.interface';
import { PublicOrderPersistenceService } from '../../../../src/core/application/services/public-order-persistence.service';
import { MercadoPagoService } from '../../../../src/core/infrastructure/payment-gateways/mercado-pago.service';
import { PaymentConfigService } from '../../../../src/core/application/services/payment-config.service';
import { Branch } from '../../../../src/core/domain/entities/branch.entity';
import { Payment } from '../../../../src/core/domain/entities/payment.entity';
import { PaymentStatus, PaymentMethod, PaymentGateway } from '@prisma/client';
import { AppError } from '../../../../src/shared/errors';

describe('StartPublicCheckoutUseCase', () => {
  let useCase: StartPublicCheckoutUseCase;
  let mockBranchRepository: jest.Mocked<IBranchRepository>;
  let mockPaymentRepository: jest.Mocked<IPaymentRepository>;
  let mockPaymentSessionRepository: jest.Mocked<IPaymentSessionRepository>;
  let mockPendingCheckoutRepository: jest.Mocked<IPendingCheckoutRepository>;
  let mockPersistence: jest.Mocked<PublicOrderPersistenceService>;
  let mockMercadoPagoService: jest.Mocked<MercadoPagoService>;
  let mockPaymentConfigService: jest.Mocked<PaymentConfigService>;

  const branchId = 'branch-1';
  const checkoutId = 'checkout-1';
  const paymentId = 'payment-1';
  const preferenceId = 'pref-1';

  function makeBranch(overrides: Partial<{ currency: string | null }> = {}): Branch {
    return new Branch(
      branchId, 'org-1', 'Sucursal Centro', 'CDMX', 'CDMX', 'Calle 1', '10',
      '5512345678', null, null, null, null, null, null, 'America/Mexico_City',
      (overrides.currency === undefined ? 'MXN' : overrides.currency) as any,
      'active', new Date(), new Date(), null
    );
  }

  const baseInput = {
    branchId,
    customerName: 'Ana',
    customerPhone: '5551112222',
    orderType: 'PICKUP' as const,
    items: [{ menuItemId: 'menu-1', quantity: 2 }],
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

    mockPaymentRepository = {
      findById: jest.fn(),
      findByGatewayTransactionId: jest.fn(),
      findAll: jest.fn(),
      create: jest.fn().mockResolvedValue(
        new Payment(paymentId, null, null, 240, 'MXN', PaymentStatus.PENDING,
          PaymentMethod.QR_MERCADO_PAGO, PaymentGateway.MERCADO_PAGO, null, null, new Date(), new Date())
      ),
      update: jest.fn().mockResolvedValue({} as any),
      delete: jest.fn(),
    };

    mockPaymentSessionRepository = {
      create: jest.fn().mockResolvedValue({} as any),
      findByPaymentId: jest.fn(),
      update: jest.fn(),
    } as any;

    mockPendingCheckoutRepository = {
      findById: jest.fn(),
      findByTrackingToken: jest.fn(),
      create: jest.fn().mockImplementation(async (data) => ({
        id: checkoutId,
        status: 'WAITING',
        orderId: null,
        mpPreferenceId: null,
        paymentId: null,
        createdAt: new Date(),
        ...data,
      })),
      update: jest.fn().mockResolvedValue({} as any),
    };

    mockPersistence = {
      validateAndPrice: jest.fn().mockResolvedValue({ subtotal: 240, total: 240 }),
      persistOrder: jest.fn(),
    } as any;

    mockMercadoPagoService = {
      createPreference: jest.fn().mockResolvedValue({
        id: preferenceId,
        initPoint: 'https://mp.com/init',
        sandboxInitPoint: 'https://mp.com/sandbox',
        expirationDate: null,
      }),
      getPreference: jest.fn(),
      getPayment: jest.fn(),
      cancelPayment: jest.fn(),
      validateWebhookSignature: jest.fn(),
    } as any;

    mockPaymentConfigService = {
      getForCharging: jest.fn().mockResolvedValue({
        mercadoPago: { accessToken: 'APP_USR-test', webhookSecret: '' },
      }),
    } as any;

    useCase = new StartPublicCheckoutUseCase(
      mockBranchRepository,
      mockPaymentRepository,
      mockPaymentSessionRepository,
      mockPendingCheckoutRepository,
      mockPersistence,
      mockMercadoPagoService,
      mockPaymentConfigService,
    );
  });

  afterEach(() => jest.clearAllMocks());

  it('should return the checkout, payment and preference identifiers', async () => {
    const result = await useCase.execute(baseInput);

    expect(result).toMatchObject({
      checkoutId,
      paymentId,
      preferenceId,
      initPoint: 'https://mp.com/init',
      total: 240,
    });
    expect(result.trackingToken).toBeDefined();
    expect(result.expiresAt).toBeInstanceOf(Date);
  });

  it('should price items without creating an order or stock', async () => {
    await useCase.execute(baseInput);

    expect(mockPersistence.validateAndPrice).toHaveBeenCalledWith(baseInput.items);
    expect(mockPersistence.persistOrder).not.toHaveBeenCalled();
  });

  it('should build external_reference as "checkout:<id>:<branch>"', async () => {
    await useCase.execute(baseInput);

    expect(mockMercadoPagoService.createPreference).toHaveBeenCalledWith(
      expect.objectContaining({
        externalReference: `${CHECKOUT_REF_PREFIX}:${checkoutId}:${branchId}`,
      })
    );
  });

  it('should create the Payment as PENDING with no orderId', async () => {
    await useCase.execute(baseInput);

    expect(mockPaymentRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: null,
        amount: 240,
        status: PaymentStatus.PENDING,
        gateway: PaymentGateway.MERCADO_PAGO,
      })
    );
  });

  it('should create the draft with the pre-generated trackingToken', async () => {
    const result = await useCase.execute(baseInput);

    expect(mockPendingCheckoutRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        branchId,
        cart: baseInput.items,
        total: 240,
        trackingToken: result.trackingToken,
      })
    );
  });

  it('should link the preference to both the Payment and the checkout draft', async () => {
    await useCase.execute(baseInput);

    expect(mockPaymentRepository.update).toHaveBeenCalledWith(paymentId, { gatewayTransactionId: preferenceId });
    expect(mockPendingCheckoutRepository.update).toHaveBeenCalledWith(checkoutId, {
      mpPreferenceId: preferenceId,
      paymentId,
    });
  });

  it('should create a PaymentSession for polling using the initPoint', async () => {
    await useCase.execute(baseInput);

    expect(mockPaymentSessionRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ paymentId, clientSecret: 'https://mp.com/init' })
    );
  });

  it('should fall back to MXN currency when the branch has none', async () => {
    mockBranchRepository.findById.mockResolvedValue(makeBranch({ currency: null }));

    await useCase.execute(baseInput);

    expect(mockPaymentRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ currency: 'MXN' })
    );
  });

  it('should not persist a delivery address for pickup orders', async () => {
    await useCase.execute({ ...baseInput, orderType: 'PICKUP', deliveryAddress: 'ignorada' });

    expect(mockPendingCheckoutRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ deliveryAddress: null })
    );
  });

  it('should throw BRANCH_NOT_FOUND when the branch does not exist', async () => {
    mockBranchRepository.findById.mockResolvedValue(null);

    await expect(useCase.execute(baseInput)).rejects.toMatchObject({ code: 'BRANCH_NOT_FOUND' });
    expect(mockPendingCheckoutRepository.create).not.toHaveBeenCalled();
  });

  it('should fail before creating anything when the merchant has no payment account', async () => {
    mockPaymentConfigService.getForCharging.mockRejectedValue(
      new AppError('MERCHANT_PAYMENT_ACCOUNT_NOT_CONFIGURED')
    );

    await expect(useCase.execute(baseInput)).rejects.toMatchObject({
      code: 'MERCHANT_PAYMENT_ACCOUNT_NOT_CONFIGURED',
    });
    expect(mockPendingCheckoutRepository.create).not.toHaveBeenCalled();
    expect(mockPaymentRepository.create).not.toHaveBeenCalled();
    expect(mockMercadoPagoService.createPreference).not.toHaveBeenCalled();
  });
});
