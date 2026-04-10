import { inject, injectable } from 'tsyringe';
import { PaymentConfigService } from '../../services/payment-config.service';
import { MaskedPaymentConfig } from '../../../domain/types/payment-config.types';

function maskKey(key: string): string {
  if (!key || key.length < 8) return key ? '••••' : '';
  return '••••' + key.slice(-8);
}

@injectable()
export class GetPaymentConfigUseCase {
  constructor(
    @inject(PaymentConfigService) private readonly paymentConfigService: PaymentConfigService
  ) {}

  async execute(): Promise<MaskedPaymentConfig> {
    const config = await this.paymentConfigService.get();
    return {
      mercadoPago: {
        accessToken: maskKey(config.mercadoPago.accessToken),
        webhookSecret: maskKey(config.mercadoPago.webhookSecret),
      },
      isConfigured: !!config.mercadoPago.accessToken,
    };
  }
}
