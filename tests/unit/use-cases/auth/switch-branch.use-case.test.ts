import { SwitchBranchUseCase } from '../../../../src/core/application/use-cases/auth/switch-branch.use-case';
import { IUserRepository } from '../../../../src/core/domain/interfaces/user-repository.interface';
import { IBranchRepository } from '../../../../src/core/domain/interfaces/branch-repository.interface';
import { IUserBranchAccessRepository } from '../../../../src/core/domain/interfaces/user-branch-access-repository.interface';
import { IOrganizationRepository } from '../../../../src/core/domain/interfaces/organization-repository.interface';
import { User } from '../../../../src/core/domain/entities/user.entity';
import { Branch } from '../../../../src/core/domain/entities/branch.entity';
import { JwtUtil } from '../../../../src/shared/utils/jwt.util';
import { UserRole, UserAccountStatus, OrganizationPlan } from '@prisma/client';

jest.mock('../../../../src/shared/utils/jwt.util');

function makeUser(overrides: Partial<Record<string, unknown>> = {}): User {
  return new User(
    'user-1',
    'Juan',
    'Perez',
    null,
    'juan@example.com',
    'hashed',
    null,
    (overrides.status as boolean) ?? true,
    (overrides.rol as UserRole) ?? UserRole.OWNER,
    'org-1',
    (overrides.accountStatus as UserAccountStatus) ?? UserAccountStatus.ACTIVE,
    (overrides.tokenVersion as number) ?? 0,
    null,
    false,
    new Date(),
    new Date()
  );
}

function makeBranch(status: 'active' | 'disabled' = 'active'): Branch {
  const now = new Date();
  return new Branch(
    'branch-1',
    'org-1',
    'Tacos El Rey',
    'CDMX',
    'CDMX',
    'Reforma',
    '123',
    '5512345678',
    null,
    null,
    null,
    null,
    null,
    null,
    'America/Mexico_City',
    'MXN',
    status,
    now,
    now,
    null,
    'tacos-el-rey'
  );
}

describe('SwitchBranchUseCase', () => {
  let useCase: SwitchBranchUseCase;
  let userRepository: jest.Mocked<IUserRepository>;
  let branchRepository: jest.Mocked<IBranchRepository>;
  let userBranchAccessRepository: jest.Mocked<IUserBranchAccessRepository>;
  let organizationRepository: jest.Mocked<IOrganizationRepository>;

  const currentUser = {
    sub: 'user-1',
    email: 'juan@example.com',
    rol: 'OWNER',
    org: 'org-1',
    tokenVersion: 0,
    emailVerified: false,
    mustChangePassword: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    userRepository = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      reactivate: jest.fn(),
      markForPasswordReset: jest.fn(),
      markEmailVerified: jest.fn(),
      changePasswordAndClearFlag: jest.fn(),
      findAll: jest.fn(),
    } as unknown as jest.Mocked<IUserRepository>;

    branchRepository = {
      findById: jest.fn(),
      findBySlug: jest.fn(),
      findByIdAndOrganizationId: jest.fn(),
      findAllIdsByOrganizationId: jest.fn(),
      findManyByOrganizationId: jest.fn(),
      findManyForList: jest.fn(),
      countActiveByOrganizationId: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    };

    userBranchAccessRepository = {
      findBranchIdsByUserId: jest.fn(),
    } as unknown as jest.Mocked<IUserBranchAccessRepository>;

    organizationRepository = {
      findById: jest.fn(),
      findFirstActive: jest.fn(),
      findByIdIncludingDeleted: jest.fn(),
      close: jest.fn(),
      reactivate: jest.fn(),
    } as unknown as jest.Mocked<IOrganizationRepository>;

    useCase = new SwitchBranchUseCase(
      userRepository,
      branchRepository,
      userBranchAccessRepository,
      organizationRepository
    );

    (JwtUtil.generateToken as jest.Mock).mockReturnValue('new-token');
    userRepository.findById.mockResolvedValue(makeUser());
    organizationRepository.findById.mockResolvedValue({ id: 'org-1', plan: OrganizationPlan.FREE, status: 'ACTIVE' } as any);
    branchRepository.findByIdAndOrganizationId.mockResolvedValue(makeBranch());
  });

  it('cambia de sucursal y genera un token con el nuevo branch (OWNER)', async () => {
    const result = await useCase.execute({ branchId: 'branch-1', currentUser });

    expect(userBranchAccessRepository.findBranchIdsByUserId).not.toHaveBeenCalled();
    expect(JwtUtil.generateToken).toHaveBeenCalledWith(
      expect.objectContaining({ sub: 'user-1', org: 'org-1', branch: 'branch-1', rol: 'OWNER' }),
      '8h'
    );
    expect(result).toEqual({ token: 'new-token', branch: { id: 'branch-1', name: 'Tacos El Rey' } });
  });

  it('valida acceso a través de user_branch_access para roles no owner/admin', async () => {
    userRepository.findById.mockResolvedValue(makeUser({ rol: UserRole.WAITER }));
    userBranchAccessRepository.findBranchIdsByUserId.mockResolvedValue(['branch-1']);

    await useCase.execute({ branchId: 'branch-1', currentUser });

    expect(userBranchAccessRepository.findBranchIdsByUserId).toHaveBeenCalledWith('user-1');
  });

  it('lanza BRANCH_FORBIDDEN si el rol no tiene acceso asignado al branch', async () => {
    userRepository.findById.mockResolvedValue(makeUser({ rol: UserRole.WAITER }));
    userBranchAccessRepository.findBranchIdsByUserId.mockResolvedValue(['branch-otra']);

    await expect(useCase.execute({ branchId: 'branch-1', currentUser })).rejects.toMatchObject({
      code: 'BRANCH_FORBIDDEN',
    });
    expect(JwtUtil.generateToken).not.toHaveBeenCalled();
  });

  it('lanza USER_NOT_FOUND si el usuario no existe', async () => {
    userRepository.findById.mockResolvedValue(null);

    await expect(useCase.execute({ branchId: 'branch-1', currentUser })).rejects.toMatchObject({
      code: 'USER_NOT_FOUND',
    });
  });

  it('lanza ACCOUNT_DISABLED si la cuenta está deshabilitada', async () => {
    userRepository.findById.mockResolvedValue(makeUser({ accountStatus: UserAccountStatus.DISABLED }));

    await expect(useCase.execute({ branchId: 'branch-1', currentUser })).rejects.toMatchObject({
      code: 'ACCOUNT_DISABLED',
    });
  });

  it('lanza ORGANIZATION_INACTIVE si la org no existe o no está activa', async () => {
    organizationRepository.findById.mockResolvedValue(null);

    await expect(useCase.execute({ branchId: 'branch-1', currentUser })).rejects.toMatchObject({
      code: 'ORGANIZATION_INACTIVE',
    });
  });

  it('lanza BRANCH_NOT_FOUND si el branch no pertenece a la org', async () => {
    branchRepository.findByIdAndOrganizationId.mockResolvedValue(null);

    await expect(useCase.execute({ branchId: 'branch-1', currentUser })).rejects.toMatchObject({
      code: 'BRANCH_NOT_FOUND',
    });
  });

  it('lanza BRANCH_DISABLED si el branch está deshabilitado', async () => {
    branchRepository.findByIdAndOrganizationId.mockResolvedValue(makeBranch('disabled'));

    await expect(useCase.execute({ branchId: 'branch-1', currentUser })).rejects.toMatchObject({
      code: 'BRANCH_DISABLED',
    });
  });
});
