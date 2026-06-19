import { inject, injectable } from 'tsyringe';
import { PaymentConfigService } from '../../services/payment-config.service';
import { PaymentConfig, SavePaymentConfigInput } from '../../../domain/types/payment-config.types';
import { MercadoPagoService } from '../../../infrastructure/payment-gateways/mercado-pago.service';
import { getBranchId } from '../../../infrastructure/tenant/tenant-context';

@injectable()
export class SavePaymentConfigUseCase {
  constructor(
    @inject(PaymentConfigService) private readonly paymentConfigService: PaymentConfigService,
    @inject('MercadoPagoService') private readonly mercadoPagoService: MercadoPagoService
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
    // El token pudo cambiar: invalidar el cliente MP cacheado de este branch
    this.mercadoPagoService.clearClient(getBranchId());
  }
}
