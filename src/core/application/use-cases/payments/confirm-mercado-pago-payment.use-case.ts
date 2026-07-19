import { inject, injectable } from 'tsyringe';
import { IPaymentRepository } from '../../../domain/interfaces/payment-repository.interface';
import { IOrderRepository } from '../../../domain/interfaces/order-repository.interface';
import { ITableRepository } from '../../../domain/interfaces/table-repository.interface';
import { IBranchRepository } from '../../../domain/interfaces/branch-repository.interface';
import { IOrganizationRepository } from '../../../domain/interfaces/organization-repository.interface';
import { PaymentStatus, PaymentGateway } from '@prisma/client';
import { MercadoPagoService, MPPaymentResult } from '../../../infrastructure/payment-gateways/mercado-pago.service';
import { CreateMercadoPagoFeeExpenseUseCase } from '../expenses/create-mercado-pago-fee-expense.use-case';
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

// external_reference: "orderId:branchId" o "orderId" (preferencias viejas)
function parseExternalReference(raw: string | undefined): { orderId: string; branchId?: string } | null {
  if (!raw) return null;
  const [orderId, branchId] = raw.split(':');
  if (!orderId) return null;
  return { orderId, branchId: branchId || undefined };
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

@injectable()
export class ConfirmMercadoPagoPaymentUseCase {
  constructor(
    @inject('IPaymentRepository') private readonly paymentRepository: IPaymentRepository,
    @inject('IOrderRepository') private readonly orderRepository: IOrderRepository,
    @inject('ITableRepository') private readonly tableRepository: ITableRepository,
    @inject('IBranchRepository') private readonly branchRepository: IBranchRepository,
    @inject('IOrganizationRepository') private readonly organizationRepository: IOrganizationRepository,
    @inject('MercadoPagoService') private readonly mercadoPagoService: MercadoPagoService,
    @inject(CreateMercadoPagoFeeExpenseUseCase)
    private readonly createMpFeeExpenseUseCase: CreateMercadoPagoFeeExpenseUseCase,
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

        const result = await this.processPayment(ref.orderId, mpPayment);
        logger.info(
          {
            mpPaymentId: input.mpPaymentId,
            branchId: tenant.branchId,
            organizationId: tenant.organizationId,
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

    return runWithTenant(tenant, () => this.processPayment(ref.orderId, mpPayment));
  }

  private async resolveTenant(
    branchId: string,
    mpPaymentId: number
  ): Promise<{ organizationId: string; branchId: string } | null> {
    const branch = await this.branchRepository.findById(branchId);
    if (!branch) {
      logger.warn({ mpPaymentId, branchId }, '[ConfirmMP] branch no encontrado — webhook ignorado');
      return null;
    }
    // No procesar pagos de organizaciones canceladas/suspendidas
    const org = await this.organizationRepository.findById(branch.organizationId);
    if (!org || org.status !== 'ACTIVE') {
      logger.warn(
        { mpPaymentId, branchId, organizationId: branch.organizationId, orgStatus: org?.status },
        '[ConfirmMP] organización inactiva — webhook ignorado'
      );
      return null;
    }
    return { organizationId: branch.organizationId, branchId: branch.id };
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
    mpPayment: MPPaymentResult
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
