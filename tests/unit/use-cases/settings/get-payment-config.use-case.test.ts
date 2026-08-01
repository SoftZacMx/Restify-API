import { GetPaymentConfigUseCase } from '../../../../src/core/application/use-cases/settings/get-payment-config.use-case';
import { PaymentConfigService } from '../../../../src/core/application/services/payment-config.service';
import { PaymentConfig } from '../../../../src/core/domain/types/payment-config.types';

describe('GetPaymentConfigUseCase', () => {
  let useCase: GetPaymentConfigUseCase;
  let paymentConfigService: jest.Mocked<PaymentConfigService>;

  beforeEach(() => {
    paymentConfigService = {
      get: jest.fn(),
    } as unknown as jest.Mocked<PaymentConfigService>;
    useCase = new GetPaymentConfigUseCase(paymentConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('enmascara tokens largos y marca la config como configurada', async () => {
    const config: PaymentConfig = {
      mercadoPago: { accessToken: '1234567890', webhookSecret: 'abc' },
    };
    paymentConfigService.get.mockResolvedValue(config);

    const result = await useCase.execute();

    expect(result).toEqual({
      mercadoPago: { accessToken: '••••34567890', webhookSecret: '••••' },
      isConfigured: true,
    });
  });

  it('enmascara tokens vacíos y cortos', async () => {
    const config: PaymentConfig = {
      mercadoPago: { accessToken: '', webhookSecret: '1234567890' },
    };
    paymentConfigService.get.mockResolvedValue(config);

    const result = await useCase.execute();

    expect(result).toEqual({
      mercadoPago: { accessToken: '', webhookSecret: '••••34567890' },
      isConfigured: false,
    });
  });
});
