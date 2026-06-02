import { inject, injectable } from 'tsyringe';
import { IBranchRepository } from '../../../domain/interfaces/branch-repository.interface';
import { BranchAccessService } from '../../services/branch-access.service';
import {
  BranchListItemResponse,
  toBranchListItem,
} from '../../mappers/branch-response.mapper';
import { getOrganizationId } from '../../../infrastructure/tenant/tenant-context';
import { OrganizationRole } from '../../../../shared/constants/roles.constants';

export interface ListBranchesInput {
  userId: string;
  role: OrganizationRole;
  includeDisabled?: boolean;
}

@injectable()
export class ListBranchesUseCase {
  constructor(
    @inject('IBranchRepository') private readonly branchRepository: IBranchRepository,
    @inject(BranchAccessService) private readonly branchAccessService: BranchAccessService
  ) {}

  async execute(input: ListBranchesInput): Promise<BranchListItemResponse[]> {
    const organizationId = getOrganizationId();
    const accessibleIds = await this.branchAccessService.getAccessibleBranchIds(
      organizationId,
      input.userId,
      input.role
    );

    const branchIdsFilter = accessibleIds.length > 0 ? accessibleIds : [];

    if (branchIdsFilter.length === 0) {
      return [];
    }

    const rows = await this.branchRepository.findManyForList(
      organizationId,
      branchIdsFilter,
      { includeDisabled: input.includeDisabled }
    );

    return rows.map(toBranchListItem);
  }
}
