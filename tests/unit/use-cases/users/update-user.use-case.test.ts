import { UpdateUserUseCase } from '../../../../src/core/application/use-cases/users/update-user.use-case';
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
    overrides.password ?? 'old_hash',
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

describe('UpdateUserUseCase', () => {
  let updateUserUseCase: UpdateUserUseCase;
  let mockUserRepository: jest.Mocked<IUserRepository>;
  let mockBranchRepository: jest.Mocked<IBranchRepository>;
  let mockUserBranchAccessRepository: jest.Mocked<IUserBranchAccessRepository>;

  const run = (userId: string, input: Parameters<UpdateUserUseCase['execute']>[1]) =>
    runWithTenant({ organizationId: ORG_ID }, () => updateUserUseCase.execute(userId, input));

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
      findBranchIdsByUserId: jest.fn().mockResolvedValue([]),
      countByBranchId: jest.fn(),
      replaceForUser: jest.fn(),
      deleteByUserId: jest.fn(),
    } as unknown as jest.Mocked<IUserBranchAccessRepository>;

    updateUserUseCase = new UpdateUserUseCase(
      mockUserRepository,
      mockBranchRepository,
      mockUserBranchAccessRepository
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    const userId = '123';

    it('should update user successfully', async () => {
      const existingUser = buildUser();
      mockUserRepository.findById.mockResolvedValue(existingUser);
      mockUserRepository.update.mockResolvedValue(buildUser({ name: 'Jane' }));

      const result = await run(userId, { name: 'Jane' });

      expect(result.name).toBe('Jane');
      expect(mockUserRepository.findById).toHaveBeenCalledWith(userId);
      expect(mockUserRepository.update).toHaveBeenCalled();
    });

    it('should throw error when user not found', async () => {
      mockUserRepository.findById.mockResolvedValue(null);

      try {
        await run(userId, { name: 'Jane' });
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).code).toBe('USER_NOT_FOUND');
      }
    });

    it('should hash password when password is provided', async () => {
      const existingUser = buildUser();
      mockUserRepository.findById.mockResolvedValue(existingUser);
      (BcryptUtil.hash as jest.Mock).mockResolvedValue('new_hashed_password');
      mockUserRepository.update.mockResolvedValue(existingUser);

      await run(userId, { password: 'newPassword123' });

      expect(BcryptUtil.hash).toHaveBeenCalledWith('newPassword123');
      expect(mockUserRepository.update).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({ password: 'new_hashed_password' })
      );
    });

    it('should throw error when new email already exists', async () => {
      mockUserRepository.findById.mockResolvedValue(buildUser());
      mockUserRepository.findByEmail.mockResolvedValue(
        buildUser({ id: '456', email: 'other@example.com' })
      );

      try {
        await run(userId, { email: 'other@example.com' });
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).code).toBe('VALIDATION_ERROR');
      }
    });

    it('should allow updating to same email', async () => {
      const existingUser = buildUser();
      mockUserRepository.findById.mockResolvedValue(existingUser);
      mockUserRepository.update.mockResolvedValue(existingUser);

      await run(userId, { email: 'john@example.com' });

      expect(mockUserRepository.findByEmail).not.toHaveBeenCalled();
      expect(mockUserRepository.update).toHaveBeenCalled();
    });

    it('should not return password in result', async () => {
      const existingUser = buildUser();
      mockUserRepository.findById.mockResolvedValue(existingUser);
      mockUserRepository.update.mockResolvedValue(existingUser);

      const result = await run(userId, { name: 'Jane' });

      expect(result).not.toHaveProperty('password');
    });
  });

  // Fase 4.1.B — branchIds en gestión de usuarios
  describe('branchIds (4.1.B)', () => {
    const userId = '123';

    it('should replace branch access set when branchIds provided', async () => {
      const existingUser = buildUser({ rol: UserRole.WAITER });
      mockUserRepository.findById.mockResolvedValue(existingUser);
      mockUserRepository.update.mockResolvedValue(existingUser);
      mockBranchRepository.findAllIdsByOrganizationId.mockResolvedValue(['b1', 'b2', 'b3']);
      mockUserBranchAccessRepository.findBranchIdsByUserId.mockResolvedValue(['b3']);

      const result = await run(userId, { branchIds: ['b3'] });

      expect(mockUserBranchAccessRepository.replaceForUser).toHaveBeenCalledWith('123', ['b3']);
      expect(result.branchIds).toEqual(['b3']);
    });

    it('should reject a branchId from another org with BRANCH_NOT_FOUND', async () => {
      mockUserRepository.findById.mockResolvedValue(buildUser({ rol: UserRole.WAITER }));
      mockUserRepository.update.mockResolvedValue(buildUser({ rol: UserRole.WAITER }));
      mockBranchRepository.findAllIdsByOrganizationId.mockResolvedValue(['b1', 'b2']);

      try {
        await run(userId, { branchIds: ['foreign-branch'] });
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).code).toBe('BRANCH_NOT_FOUND');
      }

      expect(mockUserBranchAccessRepository.replaceForUser).not.toHaveBeenCalled();
    });

    it('should clear branch access when role is org-wide (ADMIN)', async () => {
      const existingUser = buildUser({ rol: UserRole.ADMIN });
      mockUserRepository.findById.mockResolvedValue(existingUser);
      mockUserRepository.update.mockResolvedValue(existingUser);

      await run(userId, { branchIds: ['b1', 'b2'] });

      expect(mockUserBranchAccessRepository.replaceForUser).toHaveBeenCalledWith('123', []);
      expect(mockBranchRepository.findAllIdsByOrganizationId).not.toHaveBeenCalled();
    });

    it('should not touch branch access when branchIds is omitted', async () => {
      const existingUser = buildUser();
      mockUserRepository.findById.mockResolvedValue(existingUser);
      mockUserRepository.update.mockResolvedValue(existingUser);

      await run(userId, { name: 'Jane' });

      expect(mockUserBranchAccessRepository.replaceForUser).not.toHaveBeenCalled();
    });
  });
});
