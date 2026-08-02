import { inject, injectable } from 'tsyringe';
import { IPaymentRepository } from '../../../domain/interfaces/payment-repository.interface';
import { PaymentStatus, PaymentGateway } from '@prisma/client';
import { AppError } from '../../../../shared/errors';
import { MercadoPagoService } from '../../../infrastructure/payment-gateways/mercado-pago.service';
import { logger } from '../../../../shared/utils/logger';

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
          // Misma defensa que el webhook: con la firma desactivada, el monto cobrado
          // debe coincidir con el esperado ANTES de aprobar. Si no, queda PROCESSING
          // para revisión manual; nunca se marca exitoso un pago por monto distinto.
          if (Math.abs(mpStatus.transactionAmount - mpPayment.amount) > 0.01) {
            logger.warn(
              { paymentId: mpPayment.id, orderId: input.orderId, paid: mpStatus.transactionAmount, expected: mpPayment.amount },
              '[GetQRPaymentStatus] monto pagado no coincide con el esperado — no se aprueba'
            );
            await this.paymentRepository.update(mpPayment.id, {
              status: PaymentStatus.PROCESSING,
            });
            return {
              paymentId: mpPayment.id,
              status: PaymentStatus.PROCESSING,
              gatewayTransactionId: mpPayment.gatewayTransactionId,
            };
          }

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
