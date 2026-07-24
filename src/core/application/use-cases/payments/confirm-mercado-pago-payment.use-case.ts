import { inject, injectable } from 'tsyringe';
import { IPaymentRepository } from '../../../domain/interfaces/payment-repository.interface';
import { IOrderRepository } from '../../../domain/interfaces/order-repository.interface';
import { ITableRepository } from '../../../domain/interfaces/table-repository.interface';
import { IPendingCheckoutRepository, PendingCheckout } from '../../../domain/interfaces/pending-checkout-repository.interface';
import { PaymentStatus, PaymentGateway, PendingCheckoutStatus } from '@prisma/client';
import { MercadoPagoService, MPPaymentResult } from '../../../infrastructure/payment-gateways/mercado-pago.service';
import { CreateMercadoPagoFeeExpenseUseCase } from '../expenses/create-mercado-pago-fee-expense.use-case';
import { PublicOrderPersistenceService } from '../../services/public-order-persistence.service';
import { TenantResolverService } from '../../services/tenant-resolver.service';
import { CHECKOUT_REF_PREFIX } from './start-public-checkout.use-case';
import { runWithTenant } from '../../../infrastructure/tenant/tenant-context';
import { logger } from '../../../../shared/utils/logger';

export interface ConfirmMPPaymentInput {
  mpPaymentId: number;
  action: string; // "payment.created" o "payment.updated"
  branchId?: string; // del query param de la notification_url
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

// Referencia externa parseada. Dos formatos posibles:
//  - Checkout diferido (Opción A): "checkout:<checkoutId>:<branchId>" → la orden aún no existe.
//  - Orden existente (legacy/POS): "orderId:branchId" o "orderId" (preferencias viejas).
interface ParsedRef {
  kind: 'checkout' | 'order';
  id: string; // checkoutId u orderId según kind
  branchId?: string;
}

function parseExternalReference(raw: string | undefined): ParsedRef | null {
  if (!raw) return null;
  const parts = raw.split(':');

  if (parts[0] === CHECKOUT_REF_PREFIX) {
    const [, checkoutId, branchId] = parts;
    if (!checkoutId) return null;
    return { kind: 'checkout', id: checkoutId, branchId: branchId || undefined };
  }

  const [orderId, branchId] = parts;
  if (!orderId) return null;
  return { kind: 'order', id: orderId, branchId: branchId || undefined };
}

function mapMPStatusToPaymentStatus(mpStatus: string): PaymentStatus {
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
      // Cualquier estado no contemplado (in_review, authorized, etc.) se
      // registra como PROCESSING en vez de descartarse, para no perder el pago.
      return PaymentStatus.PROCESSING;
  }
}

// Una orden es de autoservicio (sin cajero) cuando proviene del menú público.
function isPublicOrder(origin: string | undefined): boolean {
  return origin === 'online-delivery' || origin === 'online-pickup';
}

// El monto que MP reporta como cobrado debe coincidir con el total esperado. Como la
// firma del webhook está desactivada, esta comparación es la defensa contra un pago
// aprobado por un monto menor al debido (p. ej. manipulando el checkout). Tolerancia de
// 1 centavo por redondeos de decimales entre MP y el total calculado.
function isAmountMismatch(paidAmount: number, expectedAmount: number): boolean {
  return Math.abs(paidAmount - expectedAmount) > 0.01;
}

@injectable()
export class ConfirmMercadoPagoPaymentUseCase {
  constructor(
    @inject('IPaymentRepository') private readonly paymentRepository: IPaymentRepository,
    @inject('IOrderRepository') private readonly orderRepository: IOrderRepository,
    @inject('ITableRepository') private readonly tableRepository: ITableRepository,
    @inject('IPendingCheckoutRepository') private readonly pendingCheckoutRepository: IPendingCheckoutRepository,
    @inject('MercadoPagoService') private readonly mercadoPagoService: MercadoPagoService,
    @inject(CreateMercadoPagoFeeExpenseUseCase)
    private readonly createMpFeeExpenseUseCase: CreateMercadoPagoFeeExpenseUseCase,
    @inject(PublicOrderPersistenceService)
    private readonly persistence: PublicOrderPersistenceService,
    @inject(TenantResolverService)
    private readonly tenantResolver: TenantResolverService,
  ) {}

  async execute(input: ConfirmMPPaymentInput): Promise<ConfirmMPPaymentResult | null> {
    // Camino preferido: el branchId viene en la notification_url, lo que permite
    // establecer el tenant context ANTES de consultar la API de MP (credenciales por branch).
    if (input.branchId) {
      const tenant = await this.resolveTenant(input.branchId, input.mpPaymentId);
      if (!tenant) return null;

      return runWithTenant(tenant, async () => {
        const mpPayment = await this.mercadoPagoService.getPayment(String(input.mpPaymentId));
        const ref = parseExternalReference(mpPayment.externalReference);
        if (!ref) return null;

        // Verificación cruzada: el branch del pago debe coincidir con el de la URL
        if (ref.branchId && ref.branchId !== input.branchId) {
          logger.warn(
            { mpPaymentId: input.mpPaymentId, urlBranchId: input.branchId, refBranchId: ref.branchId },
            '[ConfirmMP] branchId mismatch entre notification_url y external_reference — webhook ignorado'
          );
          return null;
        }

        const result = await this.processRef(ref, mpPayment);
        logger.info(
          {
            mpPaymentId: input.mpPaymentId,
            branchId: tenant.branchId,
            organizationId: tenant.organizationId,
            refKind: ref.kind,
            processed: result !== null,
            paymentStatus: result?.payment.status,
          },
          '[ConfirmMP] webhook procesado'
        );
        return result;
      });
    }

    // TODO(2026-06): retirar este fallback cuando expiren las preferencias creadas
    // sin branchId en la notification_url (las sesiones QR duran 5 minutos).
    // Fallback: preferencias creadas antes de incluir branchId en la notification_url.
    // El tenant se deduce del external_reference, por lo que getPayment corre sin contexto.
    const mpPayment = await this.mercadoPagoService.getPayment(String(input.mpPaymentId));
    const ref = parseExternalReference(mpPayment.externalReference);
    if (!ref) return null;

    if (!ref.branchId) {
      // Formato legacy "orderId" sin branch: nunca procesar sin tenant context.
      logger.warn(
        { mpPaymentId: input.mpPaymentId, externalReference: mpPayment.externalReference },
        '[ConfirmMP] external_reference sin branchId — webhook ignorado'
      );
      return null;
    }

    const tenant = await this.resolveTenant(ref.branchId, input.mpPaymentId);
    if (!tenant) return null;

    return runWithTenant(tenant, () => this.processRef(ref, mpPayment));
  }

  /**
   * Enruta según el tipo de referencia:
   *  - 'checkout': la orden aún no existe → materializarla si el pago fue aprobado.
   *  - 'order': la orden ya existe (POS o flujo legacy) → confirmar directamente.
   */
  private async processRef(ref: ParsedRef, mpPayment: MPPaymentResult): Promise<ConfirmMPPaymentResult | null> {
    if (ref.kind === 'checkout') {
      return this.processCheckout(ref.id, mpPayment);
    }
    return this.processPayment(ref.id, mpPayment);
  }

  /**
   * Confirma un pago cuya orden aún no existe (Opción A). Localiza el borrador,
   * actualiza el Payment y, si el pago fue APROBADO, materializa la orden real
   * (idempotente: si el borrador ya se consumió, reusa la orden creada). Un pago
   * rechazado/cancelado sólo actualiza el Payment; nunca crea orden.
   */
  private async processCheckout(checkoutId: string, mpPayment: MPPaymentResult): Promise<ConfirmMPPaymentResult | null> {
    const mpPaymentId = String(mpPayment.id);
    const checkout = await this.pendingCheckoutRepository.findById(checkoutId);
    if (!checkout) {
      logger.warn({ mpPaymentId, checkoutId }, '[ConfirmMP] checkout no encontrado — webhook ignorado');
      return null;
    }

    const newStatus = mapMPStatusToPaymentStatus(mpPayment.status);

    // Localizar (o crear) la fila Payment de este intento, sin orderId todavía.
    const paymentRow = await this.resolveCheckoutPaymentRow(checkout, mpPaymentId, mpPayment);

    // Autoservicio: pago en revisión del banco → cancelar para permitir reintento sin doble cobro.
    if (mpPayment.status === 'in_process') {
      const result = await this.autoCancelPending({ id: paymentRow.id, orderId: paymentRow.orderId }, mpPayment, () =>
        this.processCheckout(checkoutId, { ...mpPayment, status: 'approved' })
      );
      // Si el pago se canceló de verdad, el borrador ya no espera nada: marcarlo EXPIRED
      // para que la vista pública deje de reportar "esperando pago" y el cliente reintente.
      // (Si el banco aprobó antes de cancelar, el borrador ya quedó CONSUMED; no se toca.)
      if (result?.payment.status === PaymentStatus.CANCELED) {
        await this.pendingCheckoutRepository.update(checkout.id, {
          status: PendingCheckoutStatus.EXPIRED,
        });
      }
      return result;
    }

    // No aprobado: actualizar el Payment y salir. No se crea orden.
    if (newStatus !== PaymentStatus.SUCCEEDED) {
      const updated = await this.paymentRepository.update(paymentRow.id, {
        status: newStatus,
        gatewayTransactionId: mpPaymentId,
      });
      // Terminal sin aprobación (rechazado/cancelado): el borrador ya no espera nada,
      // marcarlo EXPIRED para que la vista pública muestre "pago fallido" y el cliente
      // reintente. PROCESSING (pending) se deja WAITING: aún puede aprobarse.
      if (newStatus === PaymentStatus.FAILED || newStatus === PaymentStatus.CANCELED) {
        await this.pendingCheckoutRepository.update(checkout.id, {
          status: PendingCheckoutStatus.EXPIRED,
        });
      }
      return {
        payment: {
          id: updated.id,
          orderId: updated.orderId,
          status: updated.status,
          gatewayTransactionId: updated.gatewayTransactionId,
        },
      };
    }

    // Aprobado pero el monto cobrado no coincide con el total del checkout: no materializar
    // la orden. Se deja el Payment en PROCESSING para revisión manual (posible manipulación
    // del monto o desfase de precios). Nunca se crea la orden a partir de un pago corto.
    if (isAmountMismatch(mpPayment.transactionAmount, checkout.total)) {
      logger.warn(
        { mpPaymentId, checkoutId, paid: mpPayment.transactionAmount, expected: checkout.total },
        '[ConfirmMP] monto pagado no coincide con el total del checkout — no se materializa la orden'
      );
      const kept = await this.paymentRepository.update(paymentRow.id, {
        status: PaymentStatus.PROCESSING,
        gatewayTransactionId: mpPaymentId,
      });
      return {
        payment: {
          id: kept.id,
          orderId: kept.orderId,
          status: kept.status,
          gatewayTransactionId: kept.gatewayTransactionId,
        },
      };
    }

    // Aprobado: materializar la orden (idempotente por checkout ya consumido).
    let orderId = checkout.orderId;
    if (checkout.status === PendingCheckoutStatus.CONSUMED && orderId) {
      logger.info({ mpPaymentId, checkoutId, orderId }, '[ConfirmMP] checkout ya materializado — reusando orden');
    } else {
      const persisted = await this.persistence.persistOrder({
        branchId: checkout.branchId,
        customerName: checkout.customerName,
        customerPhone: checkout.customerPhone,
        orderType: checkout.orderType,
        deliveryAddress: checkout.deliveryAddress,
        latitude: checkout.latitude,
        longitude: checkout.longitude,
        scheduledAt: checkout.scheduledAt,
        items: checkout.cart,
        trackingToken: checkout.trackingToken,
      });
      orderId = persisted.id;
      await this.pendingCheckoutRepository.update(checkout.id, {
        status: PendingCheckoutStatus.CONSUMED,
        orderId,
      });
      logger.info({ mpPaymentId, checkoutId, orderId }, '[ConfirmMP] orden materializada desde checkout');
    }

    // Vincular el Payment a la orden recién creada y confirmar (marca pagada, comisión, etc.).
    await this.paymentRepository.update(paymentRow.id, { orderId });
    return this.processPayment(orderId, mpPayment);
  }

  /**
   * Localiza (o crea) la fila Payment asociada a un checkout para este pago de MP.
   * A diferencia de resolvePaymentRow, aquí la orden todavía no existe: se busca por
   * mpPaymentId, luego por el paymentId guardado en el checkout, y si no, se crea.
   */
  private async resolveCheckoutPaymentRow(checkout: PendingCheckout, mpPaymentId: string, mpPayment: MPPaymentResult) {
    const byMpId = await this.paymentRepository.findByGatewayTransactionId(mpPaymentId);
    if (byMpId && byMpId.gateway === PaymentGateway.MERCADO_PAGO) {
      return byMpId;
    }

    if (checkout.paymentId) {
      const existing = await this.paymentRepository.findById(checkout.paymentId);
      if (existing && existing.status === PaymentStatus.PENDING) {
        return existing;
      }
    }

    // Reintento en MP sin fila local previa (p. ej. tras cancelar el intento anterior).
    return this.paymentRepository.create({
      orderId: null,
      userId: null,
      amount: mpPayment.transactionAmount,
      currency: mpPayment.currencyId,
      status: PaymentStatus.PENDING,
      paymentMethod: 'QR_MERCADO_PAGO',
      gateway: PaymentGateway.MERCADO_PAGO,
      gatewayTransactionId: mpPaymentId,
    });
  }

  /**
   * Resuelve el tenant a partir del branchId usando el TenantResolver compartido.
   * A diferencia de las rutas públicas, un webhook NO exige que el branch esté activo:
   * un pago que ya ocurrió debe confirmarse aunque el branch se deshabilite después.
   * Ante fallo se loguea y se devuelve null (webhook ignorado), sin lanzar excepción.
   */
  private async resolveTenant(
    branchId: string,
    mpPaymentId: number
  ): Promise<{ organizationId: string; branchId: string } | null> {
    const resolution = await this.tenantResolver.resolve(branchId);
    if (resolution.ok) {
      return resolution.tenant;
    }

    if (resolution.reason === 'BRANCH_NOT_FOUND') {
      logger.warn({ mpPaymentId, branchId }, '[ConfirmMP] branch no encontrado — webhook ignorado');
    } else {
      logger.warn(
        { mpPaymentId, branchId, organizationId: resolution.organizationId, orgStatus: resolution.orgStatus },
        '[ConfirmMP] organización inactiva — webhook ignorado'
      );
    }
    return null;
  }

  private async processPayment(orderId: string, mpPayment: MPPaymentResult): Promise<ConfirmMPPaymentResult | null> {
    const mpPaymentId = String(mpPayment.id);
    const existingOrder = await this.orderRepository.findById(orderId);

    // Localizar la fila Payment de ESTE intento de MP. Cada reintento en MP
    // genera un mpPaymentId distinto, por lo que la búsqueda es por ese ID.
    const paymentRow = await this.resolvePaymentRow(orderId, mpPaymentId, mpPayment);
    if (!paymentRow) {
      return null;
    }

    // Autoservicio (orden pública): un pago que queda "en revisión del banco"
    // (in_process) se cancela automáticamente para que el cliente reintente sin
    // riesgo de doble cobro. No hay cajero que decida.
    if (mpPayment.status === 'in_process' && isPublicOrder(existingOrder?.origin)) {
      return this.autoCancelPending(paymentRow, mpPayment);
    }

    // Pago aprobado por un monto distinto al total de la orden: no confirmar. Se deja en
    // PROCESSING para revisión manual en vez de marcar pagada una orden con monto corto.
    if (
      mapMPStatusToPaymentStatus(mpPayment.status) === PaymentStatus.SUCCEEDED &&
      existingOrder &&
      !existingOrder.status &&
      isAmountMismatch(mpPayment.transactionAmount, existingOrder.total)
    ) {
      logger.warn(
        { mpPaymentId, orderId, paid: mpPayment.transactionAmount, expected: existingOrder.total },
        '[ConfirmMP] monto pagado no coincide con el total de la orden — no se confirma el pago'
      );
      const kept = await this.paymentRepository.update(paymentRow.id, {
        status: PaymentStatus.PROCESSING,
        gatewayTransactionId: mpPaymentId,
      });
      return {
        payment: {
          id: kept.id,
          orderId: kept.orderId,
          status: kept.status,
          gatewayTransactionId: kept.gatewayTransactionId,
        },
      };
    }

    const newStatus = mapMPStatusToPaymentStatus(mpPayment.status);

    // 6. Actualizar Payment
    const updatedPayment = await this.paymentRepository.update(paymentRow.id, {
      status: newStatus,
      gatewayTransactionId: mpPaymentId,
    });

    let updatedOrder: { id: string; status: boolean; paymentMethod: number | null } | undefined;
    let tableReleased = false;

    // Marcar la orden pagada solo si el pago fue aprobado y la orden aún no lo está
    // (evita liberar mesa / registrar comisión dos veces ante webhooks repetidos).
    if (newStatus === PaymentStatus.SUCCEEDED && paymentRow.orderId && existingOrder && !existingOrder.status) {
      // Órdenes online: no marcar como entregada al pagar (el admin gestiona la entrega)
      const isOnline = isPublicOrder(existingOrder.origin);

      const order = await this.orderRepository.update(paymentRow.orderId, {
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
      if (existingOrder.tableId && existingOrder.origin.toLowerCase() === 'local') {
        await this.tableRepository.update(existingOrder.tableId, {
          availabilityStatus: true,
        });
        tableReleased = true;
      }

      // Registrar la comisión cobrada por MP como expense de operación.
      // Idempotente por paymentId: si el webhook se reenvía, no se duplica.
      const totalFee = mpPayment.feeDetails.reduce((sum: number, fee: any) => sum + fee.amount, 0);
      if (totalFee > 0) {
        try {
          await this.createMpFeeExpenseUseCase.execute({
            paymentId: paymentRow.id,
            orderId: paymentRow.orderId,
            mpPaymentId: mpPayment.id,
            feeAmount: totalFee,
            date: mpPayment.dateApproved ? new Date(mpPayment.dateApproved) : undefined,
          });
        } catch (err) {
          // No fallar la confirmación del pago si el registro del gasto falla;
          // el pago ya fue procesado exitosamente. Se loguea para observabilidad.
          console.error('[ConfirmMP] Failed to record MP fee expense', {
            paymentId: paymentRow.id,
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

  /**
   * Encuentra (o crea) la fila Payment que corresponde a este pago de MP.
   * Estrategia:
   *  1. Por gatewayTransactionId == mpPaymentId → webhook reenviado para el mismo pago.
   *  2. Fila PENDING de la orden → primer webhook del intento; se "reclama" con el mpPaymentId.
   *  3. Ninguna → reintento que MP generó sin una fila local previa; se crea una nueva.
   */
  private async resolvePaymentRow(orderId: string, mpPaymentId: string, mpPayment: MPPaymentResult) {
    const byMpId = await this.paymentRepository.findByGatewayTransactionId(mpPaymentId);
    if (byMpId && byMpId.gateway === PaymentGateway.MERCADO_PAGO) {
      return byMpId;
    }

    const pending = await this.paymentRepository.findAll({
      orderId,
      status: PaymentStatus.PENDING,
    });
    const pendingMP = pending.find((p) => p.gateway === PaymentGateway.MERCADO_PAGO);
    if (pendingMP) {
      return pendingMP;
    }

    // No hay fila local para este pago: registrarlo para no perderlo.
    return this.paymentRepository.create({
      orderId,
      userId: null,
      amount: mpPayment.transactionAmount,
      currency: mpPayment.currencyId,
      status: PaymentStatus.PENDING,
      paymentMethod: 'QR_MERCADO_PAGO',
      gateway: PaymentGateway.MERCADO_PAGO,
      gatewayTransactionId: mpPaymentId,
    });
  }

  /**
   * Cancela en MP un pago que quedó en revisión del banco (autoservicio) y marca
   * la fila local como CANCELED. Si MP responde que el pago ya fue aprobado (el
   * banco lo autorizó antes de que alcanzáramos a cancelar), no se puede cancelar:
   * se procesa como aprobado reprocesando el pago con el status real.
   */
  private async autoCancelPending(
    paymentRow: { id: string; orderId: string | null },
    mpPayment: MPPaymentResult,
    // Cómo reprocesar si el banco aprobó antes de cancelar. Por defecto reprocesa por
    // orderId (flujo con orden existente); el flujo de checkout inyecta su propia lógica
    // porque la orden aún no existe.
    reprocessApproved?: () => Promise<ConfirmMPPaymentResult | null>
  ): Promise<ConfirmMPPaymentResult | null> {
    let cancelResult: { status: string; statusDetail: string };
    try {
      cancelResult = await this.mercadoPagoService.cancelPayment(String(mpPayment.id));
    } catch (err) {
      // Si la cancelación falla, dejar el pago como PROCESSING para no perderlo;
      // el polling / próximos webhooks lo resolverán.
      logger.warn(
        { mpPaymentId: mpPayment.id, orderId: paymentRow.orderId, err: (err as Error)?.message },
        '[ConfirmMP] fallo al cancelar pago in_process — se deja en PROCESSING'
      );
      const kept = await this.paymentRepository.update(paymentRow.id, {
        status: PaymentStatus.PROCESSING,
        gatewayTransactionId: String(mpPayment.id),
      });
      return {
        payment: {
          id: kept.id,
          orderId: kept.orderId,
          status: kept.status,
          gatewayTransactionId: kept.gatewayTransactionId,
        },
      };
    }

    // El banco aprobó antes de cancelar: reprocesar como aprobado.
    if (cancelResult.status === 'approved') {
      logger.info(
        { mpPaymentId: mpPayment.id, orderId: paymentRow.orderId },
        '[ConfirmMP] pago aprobado por el banco antes de cancelar — se procesa como aprobado'
      );
      if (reprocessApproved) {
        return reprocessApproved();
      }
      return this.processPayment(paymentRow.orderId!, { ...mpPayment, status: 'approved' });
    }

    logger.info(
      { mpPaymentId: mpPayment.id, orderId: paymentRow.orderId, mpStatus: cancelResult.status },
      '[ConfirmMP] pago in_process cancelado automáticamente (autoservicio)'
    );
    const canceled = await this.paymentRepository.update(paymentRow.id, {
      status: PaymentStatus.CANCELED,
      gatewayTransactionId: String(mpPayment.id),
    });
    return {
      payment: {
        id: canceled.id,
        orderId: canceled.orderId,
        status: canceled.status,
        gatewayTransactionId: canceled.gatewayTransactionId,
      },
    };
  }
}
