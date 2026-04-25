import { inject, injectable } from 'tsyringe';
import { IPaymentRepository } from '../../../domain/interfaces/payment-repository.interface';
import { IOrderRepository } from '../../../domain/interfaces/order-repository.interface';
import { ITableRepository } from '../../../domain/interfaces/table-repository.interface';
import { PaymentStatus, PaymentGateway } from '@prisma/client';
import { MercadoPagoService } from '../../../infrastructure/payment-gateways/mercado-pago.service';
import { CreateMercadoPagoFeeExpenseUseCase } from '../expenses/create-mercado-pago-fee-expense.use-case';

export interface ConfirmMPPaymentInput {
  mpPaymentId: number;
  action: string; // "payment.created" o "payment.updated"
}

export interface ConfirmMPPaymentResult {
  payment: {
    id: string;
    orderId: string | null;
    status: PaymentStatus;
    gatewayTransactionId: string | null;
  };
  order?: {
    id: string;
    status: boolean;
    paymentMethod: number | null;
  };
  tableReleased?: boolean;
}

function mapMPStatusToPaymentStatus(mpStatus: string): PaymentStatus | null {
  switch (mpStatus) {
    case 'approved':
      return PaymentStatus.SUCCEEDED;
    case 'rejected':
      return PaymentStatus.FAILED;
    case 'cancelled':
      return PaymentStatus.CANCELED;
    case 'pending':
    case 'in_process':
      return PaymentStatus.PROCESSING;
    default:
      return null;
  }
}

@injectable()
export class ConfirmMercadoPagoPaymentUseCase {
  constructor(
    @inject('IPaymentRepository') private readonly paymentRepository: IPaymentRepository,
    @inject('IOrderRepository') private readonly orderRepository: IOrderRepository,
    @inject('ITableRepository') private readonly tableRepository: ITableRepository,
    @inject('MercadoPagoService') private readonly mercadoPagoService: MercadoPagoService,
    @inject(CreateMercadoPagoFeeExpenseUseCase)
    private readonly createMpFeeExpenseUseCase: CreateMercadoPagoFeeExpenseUseCase,
  ) {}

  async execute(input: ConfirmMPPaymentInput): Promise<ConfirmMPPaymentResult | null> {
    // 1. Obtener detalles del pago desde MP
    const mpPayment = await this.mercadoPagoService.getPayment(String(input.mpPaymentId));

    // 2. Extraer external_reference (nuestro orderId)
    const orderId = mpPayment.externalReference;
    if (!orderId) {
      return null;
    }

    // 3. Buscar Payment en BD por orderId + gateway MERCADO_PAGO + status PENDING
    const payments = await this.paymentRepository.findAll({
      orderId,
      status: PaymentStatus.PENDING,
    });
    const pendingPayment = payments.find(
      (p) => p.gateway === PaymentGateway.MERCADO_PAGO
    );

    // 4. Si no existe pago pendiente → ignorar (idempotencia)
    if (!pendingPayment) {
      return null;
    }

    // 5. Mapear status de MP a nuestro PaymentStatus
    const newStatus = mapMPStatusToPaymentStatus(mpPayment.status);
    if (!newStatus) {
      return null;
    }

    // 6. Actualizar Payment
    const updatedPayment = await this.paymentRepository.update(pendingPayment.id, {
      status: newStatus,
      gatewayTransactionId: String(mpPayment.id),
    });

    let updatedOrder: { id: string; status: boolean; paymentMethod: number | null } | undefined;
    let tableReleased = false;

    if (newStatus === PaymentStatus.SUCCEEDED && pendingPayment.orderId) {
      // Actualizar Order: status = true, paymentMethod = 4 (QR MP)
      const existingOrder = await this.orderRepository.findById(pendingPayment.orderId);

      // Órdenes online: no marcar como entregada al pagar (el admin gestiona la entrega)
      const isOnline = existingOrder &&
        (existingOrder.origin === 'online-delivery' || existingOrder.origin === 'online-pickup');

      const order = await this.orderRepository.update(pendingPayment.orderId, {
        status: true,
        paymentMethod: 4, // 4 = QR Mercado Pago
        delivered: !isOnline,
        ...(isOnline && { deliveryStatus: 'PAID' }),
      });
      updatedOrder = {
        id: order.id,
        status: order.status,
        paymentMethod: order.paymentMethod,
      };

      // Liberar mesa si es orden local
      if (existingOrder && existingOrder.tableId && existingOrder.origin.toLowerCase() === 'local') {
        await this.tableRepository.update(existingOrder.tableId, {
          availabilityStatus: true,
        });
        tableReleased = true;
      }

      // Registrar la comisión cobrada por MP como expense de operación.
      // Idempotente por paymentId: si el webhook se reenvía, no se duplica.
      const totalFee = mpPayment.feeDetails.reduce((sum, fee) => sum + fee.amount, 0);
      if (totalFee > 0) {
        try {
          await this.createMpFeeExpenseUseCase.execute({
            paymentId: pendingPayment.id,
            orderId: pendingPayment.orderId,
            mpPaymentId: mpPayment.id,
            feeAmount: totalFee,
            date: mpPayment.dateApproved ? new Date(mpPayment.dateApproved) : undefined,
          });
        } catch (err) {
          // No fallar la confirmación del pago si el registro del gasto falla;
          // el pago ya fue procesado exitosamente. Se loguea para observabilidad.
          console.error('[ConfirmMP] Failed to record MP fee expense', {
            paymentId: pendingPayment.id,
            mpPaymentId: mpPayment.id,
            err,
          });
        }
      }
    }

    return {
      payment: {
        id: updatedPayment.id,
        orderId: updatedPayment.orderId,
        status: updatedPayment.status,
        gatewayTransactionId: updatedPayment.gatewayTransactionId,
      },
      order: updatedOrder,
      tableReleased,
    };
  }
}
