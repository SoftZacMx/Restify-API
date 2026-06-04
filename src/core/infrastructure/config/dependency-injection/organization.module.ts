import { container } from 'tsyringe';
import { CloseOrganizationUseCase } from '../../../application/use-cases/organization/close-organization.use-case';
import { ReactivateOrganizationUseCase } from '../../../application/use-cases/organization/reactivate-organization.use-case';
import { CleanupUnverifiedOrgsUseCase } from '../../../application/use-cases/organization/cleanup-unverified-orgs.use-case';

// Los repositorios (IUserRepository, IOrganizationRepository, IBranchRepository) ya están
// registrados en user.module / branch.module. Aquí solo registramos los use-cases del módulo.
container.register(CloseOrganizationUseCase, CloseOrganizationUseCase);
container.register(ReactivateOrganizationUseCase, ReactivateOrganizationUseCase);
container.register(CleanupUnverifiedOrgsUseCase, CleanupUnverifiedOrgsUseCase);
