import { inject, injectable } from 'tsyringe';
import { IBranchRepository } from '../../../domain/interfaces/branch-repository.interface';
import { UpdateBranchInput } from '../../dto/branch.dto';
import { BranchAccessService } from '../../services/branch-access.service';
import { BranchDetailResponse, toBranchDetail } from '../../mappers/branch-response.mapper';
import { getOrganizationId } from '../../../infrastructure/tenant/tenant-context';
import { AppError } from '../../../../shared/errors';
import { OrganizationRole } from '../../../../shared/constants/roles.constants';

export interface UpdateBranchParams {
  branchId: string;
  userId: string;
  role: OrganizationRole;
  data: UpdateBranchInput;
}

@injectable()
export class UpdateBranchUseCase {
  constructor(
    @inject('IBranchRepository') private readonly branchRepository: IBranchRepository,
    @inject(BranchAccessService) private readonly branchAccessService: BranchAccessService
  ) {}

  async execute(input: UpdateBranchParams): Promise<BranchDetailResponse> {
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

    const branch = await this.branchRepository.update(input.branchId, {
      ...(input.data.name !== undefined && { name: input.data.name }),
      ...(input.data.state !== undefined && { state: input.data.state }),
      ...(input.data.city !== undefined && { city: input.data.city }),
      ...(input.data.street !== undefined && { street: input.data.street }),
      ...(input.data.exteriorNumber !== undefined && { exteriorNumber: input.data.exteriorNumber }),
      ...(input.data.phone !== undefined && { phone: input.data.phone }),
      ...(input.data.rfc !== undefined && { rfc: input.data.rfc }),
      ...(input.data.logoUrl !== undefined && { logoUrl: input.data.logoUrl }),
      ...(input.data.startOperations !== undefined && {
        startOperations: input.data.startOperations,
      }),
      ...(input.data.endOperations !== undefined && { endOperations: input.data.endOperations }),
      ...(input.data.timezone !== undefined && { timezone: input.data.timezone }),
      ...(input.data.currency !== undefined && { currency: input.data.currency }),
      ...(input.data.ticketConfig !== undefined && { ticketConfig: input.data.ticketConfig }),
      ...(input.data.paymentConfig !== undefined && { paymentConfig: input.data.paymentConfig }),
    });

    return toBranchDetail(branch);
  }
}
