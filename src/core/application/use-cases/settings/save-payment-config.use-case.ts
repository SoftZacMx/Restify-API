import { inject, injectable } from 'tsyringe';
import { PaymentConfigService } from '../../services/payment-config.service';
import { PaymentConfig, SavePaymentConfigInput } from '../../../domain/types/payment-config.types';

@injectable()
export class SavePaymentConfigUseCase {
  constructor(
    @inject(PaymentConfigService) private readonly paymentConfigService: PaymentConfigService
  ) {}

  async execute(input: SavePaymentConfigInput): Promise<void> {
    const current = await this.paymentConfigService.get();

    const merged: PaymentConfig = {
      mercadoPago: {
        accessToken: input.mercadoPago?.accessToken ?? current.mercadoPago.accessToken,
        webhookSecret: input.mercadoPago?.webhookSecret ?? current.mercadoPago.webhookSecret,
      },
    };

    await this.paymentConfigService.save(merged);
  }
}
