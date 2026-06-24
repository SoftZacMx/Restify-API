import { inject, injectable } from 'tsyringe';
import { IBranchRepository } from '../../../domain/interfaces/branch-repository.interface';
import { IOrganizationRepository } from '../../../domain/interfaces/organization-repository.interface';
import { AppError } from '../../../../shared/errors';

export interface ResolvePublicBranchInput {
  slug: string;
}

export interface ResolvePublicBranchResult {
  branchId: string;
  name: string;
  organizationName: string;
  logoUrl: string | null;
  timezone: string;
  currency: string;
}

/**
 * Resuelve un slug público a los datos mínimos de la sucursal (incluido su id),
 * para que el frontend público pueda luego pedir menú / crear pedido con branchId.
 *
 * Fail-secure: solo resuelve sucursales activas de organizaciones activas.
 * No expone datos sensibles (paymentConfig, rfc, etc.).
 */
@injectable()
export class ResolvePublicBranchUseCase {
  constructor(
    @inject('IBranchRepository') private readonly branchRepository: IBranchRepository,
    @inject('IOrganizationRepository') private readonly organizationRepository: IOrganizationRepository
  ) {}

  async execute(input: ResolvePublicBranchInput): Promise<ResolvePublicBranchResult> {
    const branch = await this.branchRepository.findBySlug(input.slug);
    if (!branch || !branch.isActive()) {
      throw new AppError('BRANCH_NOT_FOUND');
    }

    const org = await this.organizationRepository.findById(branch.organizationId);
    if (!org || org.status !== 'ACTIVE') {
      throw new AppError('ORGANIZATION_INACTIVE');
    }

    return {
      branchId: branch.id,
      name: branch.name,
      organizationName: org.name,
      logoUrl: branch.logoUrl,
      timezone: branch.timezone,
      currency: branch.currency,
    };
  }
}
