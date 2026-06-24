import { inject, injectable } from 'tsyringe';
import { IBranchRepository } from '../../../domain/interfaces/branch-repository.interface';
import { CreateBranchInput } from '../../dto/branch.dto';
import { BranchLimitService } from '../../services/branch-limit.service';
import { BranchDetailResponse, toBranchDetail } from '../../mappers/branch-response.mapper';
import { getOrganizationId } from '../../../infrastructure/tenant/tenant-context';
import { AppError } from '../../../../shared/errors';
import { slugify, ensureUniqueSlug } from '../../../../shared/utils/slug.util';

@injectable()
export class CreateBranchUseCase {
  constructor(
    @inject('IBranchRepository') private readonly branchRepository: IBranchRepository,
    @inject(BranchLimitService) private readonly branchLimitService: BranchLimitService
  ) {}

  async execute(input: CreateBranchInput): Promise<BranchDetailResponse> {
    const organizationId = getOrganizationId();

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

    const slug = await ensureUniqueSlug(slugify(input.name), async (candidate) => {
      return (await this.branchRepository.findBySlug(candidate)) !== null;
    });

    const branch = await this.branchRepository.create({
      organizationId,
      name: input.name,
      slug,
      state: input.state,
      city: input.city,
      street: input.street,
      exteriorNumber: input.exteriorNumber,
      phone: input.phone,
      rfc: input.rfc ?? null,
      logoUrl: input.logoUrl ?? null,
      startOperations: input.startOperations ?? null,
      endOperations: input.endOperations ?? null,
      timezone: input.timezone,
      currency: input.currency ?? 'MXN',
      ...(input.ticketConfig !== undefined && { ticketConfig: input.ticketConfig }),
      ...(input.paymentConfig !== undefined && { paymentConfig: input.paymentConfig }),
    });

    return toBranchDetail(branch);
  }
}
