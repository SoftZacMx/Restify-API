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
      const totalFee = mpPayment.feeDetails.reduce((sum: number, fee: any) => sum + fee.amount, 0);
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
