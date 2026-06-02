import { inject, injectable } from 'tsyringe';
import { IOrderRepository } from '../../../domain/interfaces/order-repository.interface';
import { IPaymentRepository } from '../../../domain/interfaces/payment-repository.interface';
import { IPaymentSessionRepository } from '../../../domain/interfaces/payment-session-repository.interface';
import { IBranchRepository } from '../../../domain/interfaces/branch-repository.interface';
import { PaymentStatus, PaymentMethod, PaymentGateway } from '@prisma/client';
import { AppError } from '../../../../shared/errors';
import { MercadoPagoService } from '../../../infrastructure/payment-gateways/mercado-pago.service';
import { runWithTenant, withoutTenant } from '../../../infrastructure/tenant/tenant-context';

export interface PayPublicOrderInput {
  orderId: string;
}

export interface PayPublicOrderResult {
  paymentId: string;
  preferenceId: string;
  initPoint: string;
  expiresAt: Date;
}

@injectable()
export class PayPublicOrderUseCase {
  constructor(
    @inject('IOrderRepository') private readonly orderRepository: IOrderRepository,
    @inject('IPaymentRepository') private readonly paymentRepository: IPaymentRepository,
    @inject('IPaymentSessionRepository') private readonly paymentSessionRepository: IPaymentSessionRepository,
    @inject('IBranchRepository') private readonly branchRepository: IBranchRepository,
    @inject('MercadoPagoService') private readonly mercadoPagoService: MercadoPagoService
  ) {}

  async execute(input: PayPublicOrderInput): Promise<PayPublicOrderResult> {
    // Buscar la orden sin tenant context (es ruta pública, no hay JWT)
    const order = await withoutTenant(() => this.orderRepository.findById(input.orderId));
    if (!order) {
      throw new AppError('ORDER_NOT_FOUND');
    }
    if (order.status) {
      throw new AppError('ORDER_ALREADY_PAID');
    }
    if (order.userId) {
      throw new AppError('VALIDATION_ERROR', 'This endpoint is only for public orders');
    }

    // Establecer tenant context a partir de la orden para las operaciones restantes
    if (order.branchId) {
      const branch = await withoutTenant(() => this.branchRepository.findById(order.branchId!));
      if (branch) {
        return runWithTenant(
          { organizationId: branch.organizationId, branchId: branch.id },
          () => this.processPayment(order)
        );
      }
    }

    // Fallback legacy (sin branchId)
    return this.processPayment(order);
  }

  private async processPayment(order: any): Promise<PayPublicOrderResult> {
    // Si ya existe un pago pendiente de MP, reutilizar
    const existingPayments = await this.paymentRepository.findAll({
      orderIds: [order.id],
      status: PaymentStatus.PENDING,
    });
    const pendingMPPayment = existingPayments.find(
      (p) => p.gateway === PaymentGateway.MERCADO_PAGO
    );
    if (pendingMPPayment) {
      const existingSession = await this.paymentSessionRepository.findByPaymentId(pendingMPPayment.id);
      if (existingSession && existingSession.expiresAt > new Date()) {
        return {
          paymentId: pendingMPPayment.id,
          preferenceId: pendingMPPayment.gatewayTransactionId || '',
          initPoint: existingSession.clientSecret,
          expiresAt: existingSession.expiresAt,
        };
      }
      if (existingSession) {
        await this.paymentSessionRepository.deleteByPaymentId(pendingMPPayment.id);
      }
      await this.paymentRepository.update(pendingMPPayment.id, { status: PaymentStatus.CANCELED });
    }

    // Crear Payment PENDING (sin userId — orden pública)
    const payment = await this.paymentRepository.create({
      orderId: order.id,
      userId: null,
      amount: order.total,
      currency: 'MXN',
      status: PaymentStatus.PENDING,
      paymentMethod: PaymentMethod.QR_MERCADO_PAGO,
      gateway: PaymentGateway.MERCADO_PAGO,
    });

    // Crear Preference en Mercado Pago
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    const notificationUrl = process.env.MP_NOTIFICATION_URL || '';
    const backUrl = process.env.MP_PUBLIC_BACK_URL || process.env.MP_BACK_URL || '';

    const preference = await this.mercadoPagoService.createPreference({
      orderId: order.id,
      branchId: order.branchId ?? undefined,
      title: `Pedido online #${order.id.slice(0, 8)} - Restify`,
      description: `Pedido de ${order.customerName}`,
      amount: order.total,
      currency: 'MXN',
      metadata: {
        orderId: order.id,
        paymentId: payment.id,
      },
      notificationUrl,
      expirationDate: expiresAt.toISOString(),
    });

    // Actualizar Payment con gatewayTransactionId
    await this.paymentRepository.update(payment.id, {
      gatewayTransactionId: preference.id,
    });

    // Crear PaymentSession
    await this.paymentSessionRepository.create({
      paymentId: payment.id,
      clientSecret: preference.initPoint,
      expiresAt,
    });

    return {
      paymentId: payment.id,
      preferenceId: preference.id,
      initPoint: preference.initPoint,
      expiresAt,
    };
  }
}
