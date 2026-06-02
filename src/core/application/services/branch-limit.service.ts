import { inject, injectable } from 'tsyringe';
import { OrganizationPlan } from '@prisma/client';
import { IOrganizationRepository } from '../../domain/interfaces/organization-repository.interface';
import { AppError } from '../../../shared/errors';

const MAX_BRANCHES_BY_PLAN: Record<OrganizationPlan, number> = {
  FREE: 3,
  PRO: 10,
  ENTERPRISE: 999,
};

@injectable()
export class BranchLimitService {
  constructor(
    @inject('IOrganizationRepository')
    private readonly organizationRepository: IOrganizationRepository
  ) {}

  async getMaxBranches(organizationId: string): Promise<number> {
    const org = await this.organizationRepository.findById(organizationId);
    if (!org) {
      throw new AppError('ORGANIZATION_NOT_FOUND');
    }
    return MAX_BRANCHES_BY_PLAN[org.plan] ?? MAX_BRANCHES_BY_PLAN.FREE;
  }
}
