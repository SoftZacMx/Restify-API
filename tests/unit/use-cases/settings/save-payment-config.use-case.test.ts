import { SavePaymentConfigUseCase } from '../../../../src/core/application/use-cases/settings/save-payment-config.use-case';
import { PaymentConfigService } from '../../../../src/core/application/services/payment-config.service';
import { MercadoPagoService } from '../../../../src/core/infrastructure/payment-gateways/mercado-pago.service';
import { PaymentConfig } from '../../../../src/core/domain/types/payment-config.types';

jest.mock('../../../../src/core/infrastructure/tenant/tenant-context', () => ({
  getBranchId: jest.fn(() => 'branch-1'),
}));

describe('SavePaymentConfigUseCase', () => {
  let useCase: SavePaymentConfigUseCase;
  let paymentConfigService: jest.Mocked<PaymentConfigService>;
  let mercadoPagoService: jest.Mocked<MercadoPagoService>;

  const currentConfig: PaymentConfig = {
    mercadoPago: { accessToken: 'old-token', webhookSecret: 'old-secret' },
  };

  beforeEach(() => {
    paymentConfigService = {
      get: jest.fn(),
      save: jest.fn(),
    } as unknown as jest.Mocked<PaymentConfigService>;
    mercadoPagoService = {
      clearClient: jest.fn(),
    } as unknown as jest.Mocked<MercadoPagoService>;
    paymentConfigService.get.mockResolvedValue(currentConfig);
    useCase = new SavePaymentConfigUseCase(paymentConfigService, mercadoPagoService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('guarda la config completa e invalida el cliente MP del branch', async () => {
    await useCase.execute({
      mercadoPago: { accessToken: 'new-token', webhookSecret: 'new-secret' },
    });

    expect(paymentConfigService.save).toHaveBeenCalledWith({
      mercadoPago: { accessToken: 'new-token', webhookSecret: 'new-secret' },
    });
    expect(mercadoPagoService.clearClient).toHaveBeenCalledWith('branch-1');
  });

  it('conserva el accessToken actual si no se envía', async () => {
    await useCase.execute({ mercadoPago: { webhookSecret: 'new-secret' } });

    expect(paymentConfigService.save).toHaveBeenCalledWith({
      mercadoPago: { accessToken: 'old-token', webhookSecret: 'new-secret' },
    });
  });

  it('conserva el webhookSecret actual si no se envía', async () => {
    await useCase.execute({ mercadoPago: { accessToken: 'new-token' } });

    expect(paymentConfigService.save).toHaveBeenCalledWith({
      mercadoPago: { accessToken: 'new-token', webhookSecret: 'old-secret' },
    });
  });

  it('conserva toda la config si mercadoPago no viene en el input', async () => {
    await useCase.execute({});

    expect(paymentConfigService.save).toHaveBeenCalledWith(currentConfig);
    expect(mercadoPagoService.clearClient).toHaveBeenCalledWith('branch-1');
  });
});
