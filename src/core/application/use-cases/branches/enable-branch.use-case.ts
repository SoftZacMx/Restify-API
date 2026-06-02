import { inject, injectable } from 'tsyringe';
import { IBranchRepository } from '../../../domain/interfaces/branch-repository.interface';
import { BranchAccessService } from '../../services/branch-access.service';
import { BranchLimitService } from '../../services/branch-limit.service';
import { BranchDetailResponse, toBranchDetail } from '../../mappers/branch-response.mapper';
import { getOrganizationId } from '../../../infrastructure/tenant/tenant-context';
import { AppError } from '../../../../shared/errors';
import { BranchActionInput } from './disable-branch.use-case';

@injectable()
export class EnableBranchUseCase {
  constructor(
    @inject('IBranchRepository') private readonly branchRepository: IBranchRepository,
    @inject(BranchAccessService) private readonly branchAccessService: BranchAccessService,
    @inject(BranchLimitService) private readonly branchLimitService: BranchLimitService
  ) {}

  async execute(input: BranchActionInput): Promise<BranchDetailResponse> {
    const organizationId = getOrganizationId();

    await this.branchAccessService.assertCanAccessBranch(
      organizationId,
      input.userId,
      input.role,
      input.branchId
    );

    const existing = await this.branchRepository.findByIdAndOrganizationId(
      input.branchId,
      organizationId
    );

    if (!existing) {
      throw new AppError('BRANCH_NOT_FOUND');
    }

    if (existing.status === 'active') {
      throw new AppError('BRANCH_ALREADY_ACTIVE');
    }

    const [activeCount, maxBranches] = await Promise.all([
      this.branchRepository.countActiveByOrganizationId(organizationId),
      this.branchLimitService.getMaxBranches(organizationId),
    ]);

    if (activeCount >= maxBranches) {
      throw new AppError('BRANCH_LIMIT_REACHED', undefined, {
        activeCount,
        maxBranches,
      });
    }

    const branch = await this.branchRepository.update(input.branchId, {
      status: 'active',
    });

    return toBranchDetail(branch);
  }
}
