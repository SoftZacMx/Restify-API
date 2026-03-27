import { inject, injectable } from 'tsyringe';
import { IOrderRepository } from '../../../domain/interfaces/order-repository.interface';
import { IPaymentRepository } from '../../../domain/interfaces/payment-repository.interface';
import { IPaymentSessionRepository } from '../../../domain/interfaces/payment-session-repository.interface';
import { PayOrderWithQRMercadoPagoInput } from '../../dto/payment.dto';
import { PaymentStatus, PaymentMethod, PaymentGateway } from '@prisma/client';
import { AppError } from '../../../../shared/errors';
import { MercadoPagoService } from '../../../infrastructure/payment-gateways/mercado-pago.service';

export interface PayOrderWithQRMercadoPagoResult {
  paymentId: string;
  preferenceId: string;
  initPoint: string;
  expiresAt: Date;
}

@injectable()
export class PayOrderWithQRMercadoPagoUseCase {
  constructor(
    @inject('IOrderRepository') private readonly orderRepository: IOrderRepository,
    @inject('IPaymentRepository') private readonly paymentRepository: IPaymentRepository,
    @inject('IPaymentSessionRepository') private readonly paymentSessionRepository: IPaymentSessionRepository,
    @inject('MercadoPagoService') private readonly mercadoPagoService: MercadoPagoService
  ) {}

  async execute(input: PayOrderWithQRMercadoPagoInput): Promise<PayOrderWithQRMercadoPagoResult> {
    // 1. Validar que la orden existe y NO está pagada
    const order = await this.orderRepository.findById(input.orderId);
    if (!order) {
      throw new AppError('ORDER_NOT_FOUND');
    }

    if (order.status) {
      throw new AppError('ORDER_ALREADY_PAID');
    }

    // 2. Validar que no existe un pago pendiente de MP para esta orden
    const existingPayments = await this.paymentRepository.findAll({
      orderIds: [order.id],
      status: PaymentStatus.PENDING,
    });
    const pendingMPPayment = existingPayments.find(
      (p) => p.gateway === PaymentGateway.MERCADO_PAGO
    );
    if (pendingMPPayment) {
      throw new AppError('PENDING_MP_PAYMENT_EXISTS');
    }

    // 3. Crear registro Payment con status PENDING
    const payment = await this.paymentRepository.create({
      orderId: order.id,
      userId: input.userId,
      amount: order.total,
      currency: 'MXN',
      status: PaymentStatus.PENDING,
      paymentMethod: PaymentMethod.QR_MERCADO_PAGO,
      gateway: PaymentGateway.MERCADO_PAGO,
    });

    // 4. Crear Preference en Mercado Pago
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutos
    const notificationUrl = process.env.MP_NOTIFICATION_URL || '';

    const preference = await this.mercadoPagoService.createPreference({
      orderId: order.id,
      title: `Orden #${order.id.slice(0, 8)} - Restify`,
      description: `Pago de orden`,
      amount: order.total,
      currency: 'MXN',
      metadata: {
        orderId: order.id,
        paymentId: payment.id,
      },
      notificationUrl,
      expirationDate: expiresAt.toISOString(),
    });

    // 5. Actualizar Payment con gatewayTransactionId = preference.id
    await this.paymentRepository.update(payment.id, {
      gatewayTransactionId: preference.id,
    });

    // 6. Crear PaymentSession con clientSecret = initPoint
    await this.paymentSessionRepository.create({
      paymentId: payment.id,
      clientSecret: preference.initPoint,
      connectionId: input.connectionId || null,
      expiresAt,
    });

    // 7. Retornar resultado
    return {
      paymentId: payment.id,
      preferenceId: preference.id,
      initPoint: preference.initPoint,
      expiresAt,
    };
  }
}
