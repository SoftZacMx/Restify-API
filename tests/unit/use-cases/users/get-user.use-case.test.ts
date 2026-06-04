import { GetUserUseCase } from '../../../../src/core/application/use-cases/users/get-user.use-case';
import { IUserRepository } from '../../../../src/core/domain/interfaces/user-repository.interface';
import { IUserBranchAccessRepository } from '../../../../src/core/domain/interfaces/user-branch-access-repository.interface';
import { User } from '../../../../src/core/domain/entities/user.entity';
import { UserRole, UserAccountStatus } from '@prisma/client';
import { AppError } from '../../../../src/shared/errors';

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
    overrides.organizationId ?? 'org-1',
    overrides.accountStatus ?? UserAccountStatus.ACTIVE,
    overrides.tokenVersion ?? 0,
    overrides.emailVerifiedAt ?? null,
    overrides.mustChangePassword ?? false,
    overrides.createdAt ?? new Date(),
    overrides.updatedAt ?? new Date()
  );
}

describe('GetUserUseCase', () => {
  let getUserUseCase: GetUserUseCase;
  let mockUserRepository: jest.Mocked<IUserRepository>;
  let mockUserBranchAccessRepository: jest.Mocked<IUserBranchAccessRepository>;

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

    mockUserBranchAccessRepository = {
      findByUserId: jest.fn(),
      findBranchIdsByUserId: jest.fn().mockResolvedValue([]),
      countByBranchId: jest.fn(),
      replaceForUser: jest.fn(),
      deleteByUserId: jest.fn(),
    } as unknown as jest.Mocked<IUserBranchAccessRepository>;

    getUserUseCase = new GetUserUseCase(mockUserRepository, mockUserBranchAccessRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    const validInput = { user_id: '123' };

    it('should return user data when user exists', async () => {
      mockUserRepository.findById.mockResolvedValue(buildUser());

      const result = await getUserUseCase.execute(validInput);

      expect(result).toHaveProperty('id');
      expect(result.id).toBe('123');
      expect(result.email).toBe('john@example.com');
      expect(result.name).toBe('John');
      expect(result).not.toHaveProperty('password');
      expect(mockUserRepository.findById).toHaveBeenCalledWith('123');
    });

    it('should throw error when user not found', async () => {
      mockUserRepository.findById.mockResolvedValue(null);

      try {
        await getUserUseCase.execute(validInput);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).code).toBe('USER_NOT_FOUND');
      }
    });

    it('should not return password in result', async () => {
      mockUserRepository.findById.mockResolvedValue(buildUser());

      const result = await getUserUseCase.execute(validInput);

      expect(result).not.toHaveProperty('password');
    });

    // Fase 4.1.B — GET devuelve las sucursales asignadas
    it('should return the assigned branchIds', async () => {
      mockUserRepository.findById.mockResolvedValue(buildUser());
      mockUserBranchAccessRepository.findBranchIdsByUserId.mockResolvedValue(['b1', 'b2']);

      const result = await getUserUseCase.execute(validInput);

      expect(mockUserBranchAccessRepository.findBranchIdsByUserId).toHaveBeenCalledWith('123');
      expect(result.branchIds).toEqual(['b1', 'b2']);
    });
  });
});
