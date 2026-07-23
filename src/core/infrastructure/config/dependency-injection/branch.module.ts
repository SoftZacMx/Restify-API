import { container } from 'tsyringe';
import { BranchRepository } from '../../database/repositories/branch.repository';
import { UserBranchAccessRepository } from '../../database/repositories/user-branch-access.repository';
import { OrganizationRepository } from '../../database/repositories/organization.repository';
import { IBranchRepository } from '../../../domain/interfaces/branch-repository.interface';
import { IUserBranchAccessRepository } from '../../../domain/interfaces/user-branch-access-repository.interface';
import { IOrganizationRepository } from '../../../domain/interfaces/organization-repository.interface';
import { BranchLimitService } from '../../../application/services/branch-limit.service';
import { BranchAccessService } from '../../../application/services/branch-access.service';
import { BootstrapBranchService } from '../../../application/services/bootstrap-branch.service';
import { TenantResolverService } from '../../../application/services/tenant-resolver.service';
import { ListBranchesUseCase } from '../../../application/use-cases/branches/list-branches.use-case';
import { GetBranchUseCase } from '../../../application/use-cases/branches/get-branch.use-case';
import { CreateBranchUseCase } from '../../../application/use-cases/branches/create-branch.use-case';
import { CreateFirstBranchUseCase } from '../../../application/use-cases/branches/create-first-branch.use-case';
import { UpdateBranchUseCase } from '../../../application/use-cases/branches/update-branch.use-case';
import { DisableBranchUseCase } from '../../../application/use-cases/branches/disable-branch.use-case';
import { EnableBranchUseCase } from '../../../application/use-cases/branches/enable-branch.use-case';
import { ResolvePublicBranchUseCase } from '../../../application/use-cases/branches/resolve-public-branch.use-case';
import { prismaClient } from './prisma.module';

container.register<IBranchRepository>('IBranchRepository', {
  useFactory: () => new BranchRepository(prismaClient),
});

container.register<IUserBranchAccessRepository>('IUserBranchAccessRepository', {
  useFactory: () => new UserBranchAccessRepository(prismaClient),
});

container.register<IOrganizationRepository>('IOrganizationRepository', {
  useFactory: () => new OrganizationRepository(prismaClient),
});

container.registerSingleton(BranchLimitService);
container.registerSingleton(BranchAccessService);
container.registerSingleton(BootstrapBranchService);
container.registerSingleton(TenantResolverService);

container.register(ListBranchesUseCase, ListBranchesUseCase);
container.register(GetBranchUseCase, GetBranchUseCase);
container.register(CreateBranchUseCase, CreateBranchUseCase);
container.register(CreateFirstBranchUseCase, CreateFirstBranchUseCase);
container.register(UpdateBranchUseCase, UpdateBranchUseCase);
container.register(DisableBranchUseCase, DisableBranchUseCase);
container.register(EnableBranchUseCase, EnableBranchUseCase);
container.register(ResolvePublicBranchUseCase, ResolvePublicBranchUseCase);
