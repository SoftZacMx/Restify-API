import { inject, injectable } from 'tsyringe';
import { IBranchRepository } from '../../../domain/interfaces/branch-repository.interface';
import { BranchAccessService } from '../../services/branch-access.service';
import { BranchDetailResponse, toBranchDetail } from '../../mappers/branch-response.mapper';
import { getOrganizationId } from '../../../infrastructure/tenant/tenant-context';
import { AppError } from '../../../../shared/errors';
import { OrganizationRole } from '../../../../shared/constants/roles.constants';

export interface GetBranchInput {
  branchId: string;
  userId: string;
  role: OrganizationRole;
}

@injectable()
export class GetBranchUseCase {
  constructor(
    @inject('IBranchRepository') private readonly branchRepository: IBranchRepository,
    @inject(BranchAccessService) private readonly branchAccessService: BranchAccessService
  ) {}

  async execute(input: GetBranchInput): Promise<BranchDetailResponse> {
    const organizationId = getOrganizationId();

    await this.branchAccessService.assertCanAccessBranch(
      organizationId,
      input.userId,
      input.role,
      input.branchId
    );

    const branch = await this.branchRepository.findByIdAndOrganizationId(
      input.branchId,
      organizationId
    );

    if (!branch) {
      throw new AppError('BRANCH_NOT_FOUND');
    }

    return toBranchDetail(branch);
  }
}
