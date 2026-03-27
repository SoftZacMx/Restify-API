import { inject, injectable } from 'tsyringe';
import { IPaymentRepository } from '../../../domain/interfaces/payment-repository.interface';
import { PaymentStatus, PaymentGateway } from '@prisma/client';
import { AppError } from '../../../../shared/errors';
import { MercadoPagoService } from '../../../infrastructure/payment-gateways/mercado-pago.service';

export interface GetQRPaymentStatusInput {
  orderId: string;
}

export interface GetQRPaymentStatusResult {
  paymentId: string;
  status: PaymentStatus;
  gatewayTransactionId: string | null;
}

@injectable()
export class GetQRPaymentStatusUseCase {
  constructor(
    @inject('IPaymentRepository') private readonly paymentRepository: IPaymentRepository,
    @inject('MercadoPagoService') private readonly mercadoPagoService: MercadoPagoService
  ) {}

  async execute(input: GetQRPaymentStatusInput): Promise<GetQRPaymentStatusResult> {
    // 1. Buscar Payment por orderId + gateway MERCADO_PAGO
    const payments = await this.paymentRepository.findAll({
      orderId: input.orderId,
    });
    const mpPayment = payments.find(
      (p) => p.gateway === PaymentGateway.MERCADO_PAGO
    );

    if (!mpPayment) {
      throw new AppError('PAYMENT_NOT_FOUND');
    }

    // 2. Si PENDING o PROCESSING, consultar MP para estado más reciente
    if (
      (mpPayment.status === PaymentStatus.PENDING || mpPayment.status === PaymentStatus.PROCESSING) &&
      mpPayment.gatewayTransactionId
    ) {
      try {
        const mpStatus = await this.mercadoPagoService.getPayment(mpPayment.gatewayTransactionId);

        if (mpStatus.status === 'approved') {
          await this.paymentRepository.update(mpPayment.id, {
            status: PaymentStatus.SUCCEEDED,
          });
          return {
            paymentId: mpPayment.id,
            status: PaymentStatus.SUCCEEDED,
            gatewayTransactionId: mpPayment.gatewayTransactionId,
          };
        }
      } catch {
        // Si falla la consulta a MP, retornar el estado local
      }
    }

    // 3. Retornar status actual
    return {
      paymentId: mpPayment.id,
      status: mpPayment.status,
      gatewayTransactionId: mpPayment.gatewayTransactionId,
    };
  }
}
