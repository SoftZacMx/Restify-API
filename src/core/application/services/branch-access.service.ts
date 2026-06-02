import { inject, injectable } from 'tsyringe';
import { IBranchRepository } from '../../domain/interfaces/branch-repository.interface';
import { IUserBranchAccessRepository } from '../../domain/interfaces/user-branch-access-repository.interface';
import { AppError } from '../../../shared/errors';
import { ORG_WIDE_ROLES, OrganizationRole } from '../../../shared/constants/roles.constants';

@injectable()
export class BranchAccessService {
  constructor(
    @inject('IBranchRepository') private readonly branchRepository: IBranchRepository,
    @inject('IUserBranchAccessRepository')
    private readonly userBranchAccessRepository: IUserBranchAccessRepository
  ) {}

  async getAccessibleBranchIds(
    organizationId: string,
    userId: string,
    role: OrganizationRole
  ): Promise<string[]> {
    if (ORG_WIDE_ROLES.has(role)) {
      return this.branchRepository.findAllIdsByOrganizationId(organizationId);
    }
    const branchIds = await this.userBranchAccessRepository.findBranchIdsByUserId(userId);
    if (branchIds.length === 0) {
      return [];
    }
    const orgBranches = await this.branchRepository.findAllIdsByOrganizationId(organizationId);
    const orgBranchSet = new Set(orgBranches);
    return branchIds.filter((id) => orgBranchSet.has(id));
  }

  async assertCanAccessBranch(
    organizationId: string,
    userId: string,
    role: OrganizationRole,
    branchId: string
  ): Promise<void> {
    const allowed = await this.getAccessibleBranchIds(organizationId, userId, role);
    if (!allowed.includes(branchId)) {
      throw new AppError('FORBIDDEN', 'No tienes acceso a esta sucursal');
    }
  }
}
