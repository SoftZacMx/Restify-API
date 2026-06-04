import { inject, injectable } from 'tsyringe';
import { IOrganizationRepository } from '../../../domain/interfaces/organization-repository.interface';
import { CloseOrganizationInput } from '../../dto/organization.dto';
import { AppError } from '../../../../shared/errors';
import { getOrganizationId } from '../../../infrastructure/tenant/tenant-context';
import { OrganizationRole } from '../../../../shared/constants/roles.constants';

export interface CloseOrganizationCommand extends CloseOrganizationInput {
  userId: string;
  role: OrganizationRole;
}

export interface CloseOrganizationResult {
  id: string;
  status: string;
  closedAt: Date | null;
}

/**
 * Sub-fase 4.1.G — Cierre de organización (owner).
 *
 * Marca la org como cerrada (`deletedAt = now()`, status CANCELLED) e invalida las
 * sesiones de TODOS sus usuarios (incrementa su `tokenVersion`). El hard-delete real
 * ocurre vía cron a los 30 días (Transversal C.3). El owner puede reactivarla dentro
 * de esa ventana con `POST /api/organization/reactivate`.
 */
@injectable()
export class CloseOrganizationUseCase {
  constructor(
    @inject('IOrganizationRepository')
    private readonly organizationRepository: IOrganizationRepository
  ) {}

  async execute(input: CloseOrganizationCommand): Promise<CloseOrganizationResult> {
    // Solo el owner puede cerrar la organización.
    if (input.role !== OrganizationRole.OWNER) {
      throw new AppError('FORBIDDEN', 'Solo el owner puede cerrar la organización');
    }

    const organizationId = getOrganizationId();

    const org = await this.organizationRepository.findById(organizationId);
    if (!org) {
      throw new AppError('ORGANIZATION_NOT_FOUND');
    }

    if (org.deletedAt !== null) {
      throw new AppError('ORGANIZATION_ALREADY_CLOSED');
    }

    // Confirmación: el nombre escrito debe coincidir exactamente con el de la org.
    if (input.confirmationName !== org.name) {
      throw new AppError('ORGANIZATION_NAME_MISMATCH');
    }

    const closed = await this.organizationRepository.close(organizationId);

    return {
      id: closed.id,
      status: closed.status,
      closedAt: closed.deletedAt,
    };
  }
}
