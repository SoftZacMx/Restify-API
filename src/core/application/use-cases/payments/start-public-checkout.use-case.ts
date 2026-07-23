import { inject, injectable } from 'tsyringe';
import { randomUUID } from 'crypto';
import { PaymentStatus, PaymentMethod, PaymentGateway } from '@prisma/client';
import { IBranchRepository } from '../../../domain/interfaces/branch-repository.interface';
import { IPaymentRepository } from '../../../domain/interfaces/payment-repository.interface';
import { IPaymentSessionRepository } from '../../../domain/interfaces/payment-session-repository.interface';
import { IPendingCheckoutRepository, PendingCheckoutCartItem } from '../../../domain/interfaces/pending-checkout-repository.interface';
import { PublicOrderPersistenceService } from '../../services/public-order-persistence.service';
import { validateBranchAndHours } from '../orders/create-public-order.use-case';
import { MercadoPagoService } from '../../../infrastructure/payment-gateways/mercado-pago.service';
import { PaymentConfigService } from '../../services/payment-config.service';
import { buildNotificationUrl } from './pay-order-with-qr-mercado-pago.use-case';
import { AppError } from '../../../../shared/errors';

export interface StartPublicCheckoutInput {
  branchId: string; // Required for multi-tenancy (viene del body, resuelto por PublicTenantMiddleware)
  customerName: string;
  customerPhone: string;
  orderType: 'DELIVERY' | 'PICKUP';
  deliveryAddress?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  scheduledAt?: string | null;
  items: PendingCheckoutCartItem[];
}

export interface StartPublicCheckoutResult {
  checkoutId: string;
  trackingToken: string;
  paymentId: string;
  preferenceId: string;
  initPoint: string;
  expiresAt: Date;
  total: number;
}

/** Prefijo del external_reference para distinguir checkouts de órdenes ya existentes. */
export const CHECKOUT_REF_PREFIX = 'checkout';

/**
 * Inicia el pago de un pedido público SIN crear la orden todavía (Opción A).
 *
 * Guarda un borrador (PendingCheckout) con el carrito + datos del cliente, crea el
 * Payment (PENDING, sin orderId) y la preferencia de Mercado Pago con
 * external_reference = "checkout:<checkoutId>:<branchId>". La orden real se materializa
 * al confirmar el pago (ConfirmMercadoPagoPaymentUseCase). Así un pago rechazado no deja
 * órdenes huérfanas y reintentar no genera duplicados.
 */
@injectable()
export class StartPublicCheckoutUseCase {
  constructor(
    @inject('IBranchRepository') private readonly branchRepository: IBranchRepository,
    @inject('IPaymentRepository') private readonly paymentRepository: IPaymentRepository,
    @inject('IPaymentSessionRepository') private readonly paymentSessionRepository: IPaymentSessionRepository,
    @inject('IPendingCheckoutRepository') private readonly pendingCheckoutRepository: IPendingCheckoutRepository,
    @inject(PublicOrderPersistenceService) private readonly persistence: PublicOrderPersistenceService,
    @inject('MercadoPagoService') private readonly mercadoPagoService: MercadoPagoService,
    @inject(PaymentConfigService) private readonly paymentConfigService: PaymentConfigService,
  ) {}

  async execute(input: StartPublicCheckoutInput): Promise<StartPublicCheckoutResult> {
    // 1. Validar branch + horario de operación
    await validateBranchAndHours(this.branchRepository, input.branchId, input.scheduledAt);

    const branch = await this.branchRepository.findById(input.branchId);
    if (!branch) {
      throw new AppError('BRANCH_NOT_FOUND', 'Branch not found');
    }

    // Cada comercio cobra en su propia cuenta de MP: si no la configuró, cortar aquí antes
    // de generar el pago (evita mandar el cobro a la cuenta equivocada). Falla si falta.
    await this.paymentConfigService.getForCharging();

    // 2. Validar items disponibles y calcular total (sin escribir orden ni stock)
    const { subtotal, total } = await this.persistence.validateAndPrice(input.items);

    // 3. Crear borrador (snapshot del pedido) con trackingToken pre-generado
    const trackingToken = randomUUID();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutos (igual que la preferencia MP)

    const checkout = await this.pendingCheckoutRepository.create({
      branchId: input.branchId,
      cart: input.items,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      orderType: input.orderType,
      deliveryAddress: input.orderType === 'DELIVERY' ? input.deliveryAddress ?? null : null,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
      total,
      subtotal,
      trackingToken,
      expiresAt,
    });

    // 4. Crear Payment PENDING (sin orderId — la orden aún no existe)
    const payment = await this.paymentRepository.create({
      orderId: null,
      userId: null,
      amount: total,
      currency: branch.currency || 'MXN',
      status: PaymentStatus.PENDING,
      paymentMethod: PaymentMethod.QR_MERCADO_PAGO,
      gateway: PaymentGateway.MERCADO_PAGO,
    });

    // 5. Crear preferencia en Mercado Pago. external_reference apunta al checkout.
    const externalReference = `${CHECKOUT_REF_PREFIX}:${checkout.id}:${input.branchId}`;
    const notificationUrl = buildNotificationUrl(input.branchId);

    const preference = await this.mercadoPagoService.createPreference({
      orderId: checkout.id, // sólo para el item de la preferencia; el ref real es externalReference
      branchId: input.branchId,
      title: `Pedido online - ${branch.name}`,
      description: `Pedido de ${input.customerName}`,
      amount: total,
      currency: branch.currency || 'MXN',
      metadata: {
        orderId: '', // aún no existe
        paymentId: payment.id,
      },
      externalReference,
      notificationUrl,
      expirationDate: expiresAt.toISOString(),
    });

    // 6. Vincular preferencia al Payment y al checkout
    await this.paymentRepository.update(payment.id, { gatewayTransactionId: preference.id });
    await this.pendingCheckoutRepository.update(checkout.id, {
      mpPreferenceId: preference.id,
      paymentId: payment.id,
    });

    // 7. Crear PaymentSession (permite polling del estado)
    await this.paymentSessionRepository.create({
      paymentId: payment.id,
      clientSecret: preference.initPoint,
      expiresAt,
    });

    return {
      checkoutId: checkout.id,
      trackingToken,
      paymentId: payment.id,
      preferenceId: preference.id,
      initPoint: preference.initPoint,
      expiresAt,
      total,
    };
  }
}
