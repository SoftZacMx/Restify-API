import { CreateUserUseCase } from '../../../../src/core/application/use-cases/users/create-user.use-case';
import { IUserRepository } from '../../../../src/core/domain/interfaces/user-repository.interface';
import { IBranchRepository } from '../../../../src/core/domain/interfaces/branch-repository.interface';
import { IUserBranchAccessRepository } from '../../../../src/core/domain/interfaces/user-branch-access-repository.interface';
import { User } from '../../../../src/core/domain/entities/user.entity';
import { BcryptUtil } from '../../../../src/shared/utils/bcrypt.util';
import { UserRole, UserAccountStatus } from '@prisma/client';
import { AppError } from '../../../../src/shared/errors';
import { runWithTenant } from '../../../../src/core/infrastructure/tenant/tenant-context';

jest.mock('../../../../src/shared/utils/bcrypt.util');

const ORG_ID = 'org-1';

function buildUser(overrides: Partial<User> = {}): User {
  return new User(
    overrides.id ?? '123',
    overrides.name ?? 'John',
    overrides.last_name ?? 'Doe',
    overrides.second_last_name ?? null,
    overrides.email ?? 'john@example.com',
    overrides.password ?? 'hashed_password',
    overrides.phone ?? null,
    overrides.status ?? true,
    overrides.rol ?? UserRole.WAITER,
    overrides.organizationId ?? ORG_ID,
    overrides.accountStatus ?? UserAccountStatus.ACTIVE,
    overrides.tokenVersion ?? 0,
    overrides.emailVerifiedAt ?? null,
    overrides.mustChangePassword ?? false,
    overrides.createdAt ?? new Date(),
    overrides.updatedAt ?? new Date()
  );
}

describe('CreateUserUseCase', () => {
  let createUserUseCase: CreateUserUseCase;
  let mockUserRepository: jest.Mocked<IUserRepository>;
  let mockBranchRepository: jest.Mocked<IBranchRepository>;
  let mockUserBranchAccessRepository: jest.Mocked<IUserBranchAccessRepository>;

  // Ejecuta el caso de uso dentro de un contexto de tenant (necesario para getOrganizationId).
  const run = (input: Parameters<CreateUserUseCase['execute']>[0]) =>
    runWithTenant({ organizationId: ORG_ID }, () => createUserUseCase.execute(input));

  beforeEach(() => {
    mockUserRepository = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findAll: jest.fn(),
      reactivate: jest.fn(),
    } as unknown as jest.Mocked<IUserRepository>;

    mockBranchRepository = {
      findAllIdsByOrganizationId: jest.fn(),
    } as unknown as jest.Mocked<IBranchRepository>;

    mockUserBranchAccessRepository = {
      findByUserId: jest.fn(),
      findBranchIdsByUserId: jest.fn(),
      countByBranchId: jest.fn(),
      replaceForUser: jest.fn(),
      deleteByUserId: jest.fn(),
    } as unknown as jest.Mocked<IUserBranchAccessRepository>;

    createUserUseCase = new CreateUserUseCase(
      mockUserRepository,
      mockBranchRepository,
      mockUserBranchAccessRepository
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    const validInput = {
      name: 'John',
      last_name: 'Doe',
      second_last_name: 'Smith',
      email: 'john@example.com',
      password: 'password123',
      phone: '+1234567890',
      status: true,
      rol: UserRole.WAITER,
    };

    it('should create a new user successfully', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(null);
      (BcryptUtil.hash as jest.Mock).mockResolvedValue('hashed_password');
      mockUserRepository.create.mockResolvedValue(buildUser());

      const result = await run(validInput);

      expect(result).toHaveProperty('id');
      expect(result.email).toBe('john@example.com');
      expect(result.name).toBe('John');
      expect(result.rol).toBe(UserRole.WAITER);
      expect(mockUserRepository.findByEmail).toHaveBeenCalledWith('john@example.com');
      expect(BcryptUtil.hash).toHaveBeenCalledWith('password123');
      expect(mockUserRepository.create).toHaveBeenCalled();
    });

    it('should throw error when email already exists', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(buildUser({ name: 'Existing' }));

      try {
        await run(validInput);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).code).toBe('VALIDATION_ERROR');
      }
    });

    it('should hash password before creating user', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(null);
      (BcryptUtil.hash as jest.Mock).mockResolvedValue('hashed_password');
      mockUserRepository.create.mockResolvedValue(buildUser());

      await run(validInput);

      expect(BcryptUtil.hash).toHaveBeenCalledWith('password123');
      expect(mockUserRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ password: 'hashed_password' })
      );
    });

    it('should not return password in result', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(null);
      (BcryptUtil.hash as jest.Mock).mockResolvedValue('hashed_password');
      mockUserRepository.create.mockResolvedValue(buildUser());

      const result = await run(validInput);

      expect(result).not.toHaveProperty('password');
    });
  });

  // Fase 4.1.B — branchIds en gestión de usuarios
  describe('branchIds (4.1.B)', () => {
    it('should create a waiter with 2 branches → 2 UserBranchAccess rows', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(null);
      (BcryptUtil.hash as jest.Mock).mockResolvedValue('hashed_password');
      mockUserRepository.create.mockResolvedValue(buildUser());
      mockBranchRepository.findAllIdsByOrganizationId.mockResolvedValue(['b1', 'b2', 'b3']);

      const result = await run({
        name: 'John',
        last_name: 'Doe',
        email: 'john@example.com',
        password: 'password123',
        rol: UserRole.WAITER,
        branchIds: ['b1', 'b2'],
      });

      expect(mockUserBranchAccessRepository.replaceForUser).toHaveBeenCalledWith('123', ['b1', 'b2']);
      expect(result.branchIds).toEqual(['b1', 'b2']);
    });

    it('should reject a branchId from another org with BRANCH_NOT_FOUND', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(null);
      (BcryptUtil.hash as jest.Mock).mockResolvedValue('hashed_password');
      mockBranchRepository.findAllIdsByOrganizationId.mockResolvedValue(['b1', 'b2']);

      try {
        await run({
          name: 'John',
          last_name: 'Doe',
          email: 'john@example.com',
          password: 'password123',
          rol: UserRole.WAITER,
          branchIds: ['b1', 'foreign-branch'],
        });
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).code).toBe('BRANCH_NOT_FOUND');
      }

      // No debe persistir accesos si alguna sucursal es inválida.
      expect(mockUserBranchAccessRepository.replaceForUser).not.toHaveBeenCalled();
    });

    it('should ignore branchIds for org-wide roles (ADMIN)', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(null);
      (BcryptUtil.hash as jest.Mock).mockResolvedValue('hashed_password');
      mockUserRepository.create.mockResolvedValue(buildUser({ rol: UserRole.ADMIN }));

      const result = await run({
        name: 'Ada',
        last_name: 'Admin',
        email: 'ada@example.com',
        password: 'password123',
        rol: UserRole.ADMIN,
        branchIds: ['b1', 'b2'],
      });

      expect(result.branchIds).toEqual([]);
      expect(mockUserBranchAccessRepository.replaceForUser).not.toHaveBeenCalled();
      expect(mockBranchRepository.findAllIdsByOrganizationId).not.toHaveBeenCalled();
    });
  });
});
