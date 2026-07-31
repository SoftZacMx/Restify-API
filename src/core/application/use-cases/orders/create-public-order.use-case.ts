import { inject, injectable } from 'tsyringe';
import { IBranchRepository } from '../../../domain/interfaces/branch-repository.interface';
import { PublicOrderPersistenceService } from '../../services/public-order-persistence.service';
import { formatInTimeZone } from 'date-fns-tz';
import { AppError } from '../../../../shared/errors';
import { isWithinOperatingHours } from '../../../../shared/utils/operating-hours.util';

export interface CreatePublicOrderInput {
  branchId: string; // Required for multi-tenancy
  customerName: string;
  customerPhone: string;
  orderType: 'DELIVERY' | 'PICKUP';
  deliveryAddress?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  scheduledAt?: string | null;
  items: {
    menuItemId: string;
    quantity: number;
    note?: string | null;
    extras?: { extraId: string; quantity: number }[];
  }[];
}

export interface CreatePublicOrderResult {
  id: string;
  trackingToken: string;
  total: number;
  subtotal: number;
  origin: string;
  customerName: string;
  orderType: 'DELIVERY' | 'PICKUP';
  createdAt: Date;
}

/**
 * Crea un pedido público directamente (flujo legacy: la orden existe antes de pagar).
 * El flujo nuevo recomendado es StartPublicCheckoutUseCase, que difiere la creación
 * hasta confirmar el pago. Este use case se mantiene por compatibilidad.
 */
@injectable()
export class CreatePublicOrderUseCase {
  constructor(
    @inject('IBranchRepository') private readonly branchRepository: IBranchRepository,
    @inject(PublicOrderPersistenceService) private readonly persistence: PublicOrderPersistenceService,
  ) {}

  async execute(input: CreatePublicOrderInput): Promise<CreatePublicOrderResult> {
    await validateBranchAndHours(this.branchRepository, input.branchId, input.scheduledAt);

    const persisted = await this.persistence.persistOrder({
      branchId: input.branchId,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      orderType: input.orderType,
      deliveryAddress: input.orderType === 'DELIVERY' ? input.deliveryAddress ?? null : null,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
      items: input.items,
    });

    return {
      id: persisted.id,
      trackingToken: persisted.trackingToken,
      total: persisted.total,
      subtotal: persisted.subtotal,
      origin: persisted.origin,
      customerName: input.customerName,
      orderType: input.orderType,
      createdAt: persisted.createdAt,
    };
  }
}

/**
 * Valida que la sucursal exista y que el momento del pedido caiga dentro del horario
 * de operación. Compartido por la creación directa y el checkout diferido.
 */
export async function validateBranchAndHours(
  branchRepository: IBranchRepository,
  branchId: string,
  scheduledAt?: string | null,
): Promise<void> {
  const branch = await branchRepository.findById(branchId);
  if (!branch) {
    throw new AppError('BRANCH_NOT_FOUND', 'Branch not found');
  }

  if (branch.startOperations && branch.endOperations) {
    const timeToCheck = scheduledAt ? new Date(scheduledAt) : new Date();
    const hhmm = formatInTimeZone(timeToCheck, branch.timezone, 'HH:mm');

    if (!isWithinOperatingHours(hhmm, branch.startOperations, branch.endOperations)) {
      throw new AppError(
        'OUTSIDE_OPERATING_HOURS',
        `Horario de operación: ${branch.startOperations} - ${branch.endOperations}. No se pueden crear pedidos fuera de este horario.`
      );
    }
  }
}
