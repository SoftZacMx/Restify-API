import { LoginUseCase } from '../../../../src/core/application/use-cases/auth/login.use-case';
import { IUserRepository } from '../../../../src/core/domain/interfaces/user-repository.interface';
import { IOrganizationRepository } from '../../../../src/core/domain/interfaces/organization-repository.interface';
import { IBranchRepository } from '../../../../src/core/domain/interfaces/branch-repository.interface';
import { IUserBranchAccessRepository } from '../../../../src/core/domain/interfaces/user-branch-access-repository.interface';
import { User } from '../../../../src/core/domain/entities/user.entity';
import { BcryptUtil } from '../../../../src/shared/utils/bcrypt.util';
import { JwtUtil } from '../../../../src/shared/utils/jwt.util';
import { UserRole, UserAccountStatus, OrganizationPlan } from '@prisma/client';
import { AppError } from '../../../../src/shared/errors';

// Mock dependencies
jest.mock('../../../../src/shared/utils/bcrypt.util');
jest.mock('../../../../src/shared/utils/jwt.util');

describe('LoginUseCase', () => {
  let loginUseCase: LoginUseCase;
  let mockUserRepository: jest.Mocked<IUserRepository>;
  let mockOrganizationRepository: jest.Mocked<IOrganizationRepository>;
  let mockBranchRepository: jest.Mocked<IBranchRepository>;
  let mockUserBranchAccessRepository: jest.Mocked<IUserBranchAccessRepository>;

  beforeEach(() => {
    mockUserRepository = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      reactivate: jest.fn(),
      markForPasswordReset: jest.fn(),
      markEmailVerified: jest.fn(),

      changePasswordAndClearFlag: jest.fn(),      changePasswordAndRevokeSessions: jest.fn(),      findAll: jest.fn(),
    } as unknown as jest.Mocked<IUserRepository>;

    mockOrganizationRepository = {
      findById: jest.fn().mockResolvedValue({
        id: 'org-1',
        name: 'Acme',
        plan: OrganizationPlan.FREE,
        status: 'ACTIVE',
      }),
      findFirstActive: jest.fn(),
    } as unknown as jest.Mocked<IOrganizationRepository>;

    mockBranchRepository = {
      findAllIdsByOrganizationId: jest.fn().mockResolvedValue([]),
      findManyForList: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<IBranchRepository>;

    mockUserBranchAccessRepository = {
      findBranchIdsByUserId: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<IUserBranchAccessRepository>;

    loginUseCase = new LoginUseCase(
      mockUserRepository,
      mockOrganizationRepository,
      mockBranchRepository,
      mockUserBranchAccessRepository
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    const validInput = {
      email: 'john@example.com',
      password: 'password123',
    };

    it('should return token and user data on successful login', async () => {
      const mockUser = new User(
        '123',
        'John',
        'Doe',
        null,
        'john@example.com',
        'hashed_password',
        null,
        true,
        UserRole.WAITER,
        'org-1',
        UserAccountStatus.ACTIVE,
        0,
        new Date(),
        false,
        new Date(),
        new Date()
      );

      mockUserRepository.findByEmail.mockResolvedValue(mockUser);
      (BcryptUtil.compare as jest.Mock).mockResolvedValue(true);
      (JwtUtil.generateToken as jest.Mock).mockReturnValue('jwt_token_here');

      const result = await loginUseCase.execute(validInput);

      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('user');
      expect(result.token).toBe('jwt_token_here');
      expect(result.user.id).toBe('123');
      expect(result.user.name).toBe('John');
      expect(mockUserRepository.findByEmail).toHaveBeenCalledWith('john@example.com');
      expect(BcryptUtil.compare).toHaveBeenCalledWith('password123', 'hashed_password');
    });

    it('should throw error when user not found', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(null);

      try {
        await loginUseCase.execute(validInput);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).code).toBe('INVALID_CREDENTIALS');
      }
    });

    it('should throw error when user is not active', async () => {
      const inactiveUser = new User(
        '123',
        'John',
        'Doe',
        null,
        'john@example.com',
        'hashed_password',
        null,
        false, // inactive
        UserRole.WAITER,
        'org-1',
        UserAccountStatus.ACTIVE,
        0,
        new Date(),
        false,
        new Date(),
        new Date()
      );

      mockUserRepository.findByEmail.mockResolvedValue(inactiveUser);

      try {
        await loginUseCase.execute(validInput);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).code).toBe('USER_DISABLED');
      }
    });

    it('should throw error when password is incorrect', async () => {
      const mockUser = new User(
        '123',
        'John',
        'Doe',
        null,
        'john@example.com',
        'hashed_password',
        null,
        true,
        UserRole.WAITER,
        'org-1',
        UserAccountStatus.ACTIVE,
        0,
        new Date(),
        false,
        new Date(),
        new Date()
      );

      mockUserRepository.findByEmail.mockResolvedValue(mockUser);
      (BcryptUtil.compare as jest.Mock).mockResolvedValue(false);

      try {
        await loginUseCase.execute(validInput);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).code).toBe('INVALID_CREDENTIALS');
      }
    });

    it('should throw ACCOUNT_DISABLED when account is disabled (multi-tenant)', async () => {
      const disabledAccountUser = new User(
        '123',
        'John',
        'Doe',
        null,
        'john@example.com',
        'hashed_password',
        null,
        true,
        UserRole.WAITER,
        'org-1',
        UserAccountStatus.DISABLED,
        0,
        new Date(),
        false,
        new Date(),
        new Date()
      );

      mockUserRepository.findByEmail.mockResolvedValue(disabledAccountUser);

      await expect(loginUseCase.execute(validInput)).rejects.toMatchObject({
        code: 'ACCOUNT_DISABLED',
      });
    });

    it('should throw ORGANIZATION_NOT_FOUND when organization does not exist', async () => {
      const mockUser = new User(
        '123',
        'John',
        'Doe',
        null,
        'john@example.com',
        'hashed_password',
        null,
        true,
        UserRole.WAITER,
        'org-1',
        UserAccountStatus.ACTIVE,
        0,
        new Date(),
        false,
        new Date(),
        new Date()
      );

      mockUserRepository.findByEmail.mockResolvedValue(mockUser);
      (BcryptUtil.compare as jest.Mock).mockResolvedValue(true);
      mockOrganizationRepository.findById.mockResolvedValue(null);

      await expect(loginUseCase.execute(validInput)).rejects.toMatchObject({
        code: 'ORGANIZATION_NOT_FOUND',
      });
    });

    it('should throw ORGANIZATION_INACTIVE when organization is not active', async () => {
      const mockUser = new User(
        '123',
        'John',
        'Doe',
        null,
        'john@example.com',
        'hashed_password',
        null,
        true,
        UserRole.WAITER,
        'org-1',
        UserAccountStatus.ACTIVE,
        0,
        new Date(),
        false,
        new Date(),
        new Date()
      );

      mockUserRepository.findByEmail.mockResolvedValue(mockUser);
      (BcryptUtil.compare as jest.Mock).mockResolvedValue(true);
      mockOrganizationRepository.findById.mockResolvedValue({
        id: 'org-1',
        name: 'Acme',
        plan: OrganizationPlan.FREE,
        status: 'CANCELLED',
        deletedAt: null,
      });

      await expect(loginUseCase.execute(validInput)).rejects.toMatchObject({
        code: 'ORGANIZATION_INACTIVE',
      });
    });

    it('should return all branches and first branch as initial for Owner/Admin', async () => {
      const ownerUser = new User(
        '123',
        'John',
        'Doe',
        null,
        'john@example.com',
        'hashed_password',
        null,
        true,
        UserRole.OWNER,
        'org-1',
        UserAccountStatus.ACTIVE,
        0,
        new Date(),
        false,
        new Date(),
        new Date()
      );

      mockUserRepository.findByEmail.mockResolvedValue(ownerUser);
      (BcryptUtil.compare as jest.Mock).mockResolvedValue(true);
      (JwtUtil.generateToken as jest.Mock).mockReturnValue('jwt_token_here');
      mockBranchRepository.findAllIdsByOrganizationId.mockResolvedValue(['branch-1', 'branch-2']);
      mockBranchRepository.findManyForList.mockResolvedValue([
        { id: 'branch-1', name: 'Sucursal 1' },
        { id: 'branch-2', name: 'Sucursal 2' },
      ] as any);

      const result = await loginUseCase.execute(validInput);

      expect(result.branches).toEqual([
        { id: 'branch-1', name: 'Sucursal 1' },
        { id: 'branch-2', name: 'Sucursal 2' },
      ]);
      expect(mockUserBranchAccessRepository.findBranchIdsByUserId).not.toHaveBeenCalled();
      expect(JwtUtil.generateToken).toHaveBeenCalledWith(
        expect.objectContaining({ branch: 'branch-1' }),
        '8h'
      );
      expect(result.user.organizationName).toBe('Acme');
    });

    it('should not include branches when Owner has no branches', async () => {
      const ownerUser = new User(
        '123',
        'John',
        'Doe',
        null,
        'john@example.com',
        'hashed_password',
        null,
        true,
        UserRole.ADMIN,
        'org-1',
        UserAccountStatus.ACTIVE,
        0,
        new Date(),
        false,
        new Date(),
        new Date()
      );

      mockUserRepository.findByEmail.mockResolvedValue(ownerUser);
      (BcryptUtil.compare as jest.Mock).mockResolvedValue(true);
      (JwtUtil.generateToken as jest.Mock).mockReturnValue('jwt_token_here');
      mockBranchRepository.findAllIdsByOrganizationId.mockResolvedValue([]);

      const result = await loginUseCase.execute(validInput);

      expect(result.branches).toBeUndefined();
      expect(JwtUtil.generateToken).toHaveBeenCalledWith(
        expect.objectContaining({ branch: undefined }),
        '8h'
      );
    });

    it('should return assigned branches and first assigned as initial for non-owner roles', async () => {
      const managerUser = new User(
        '123',
        'John',
        'Doe',
        null,
        'john@example.com',
        'hashed_password',
        null,
        true,
        UserRole.MANAGER,
        'org-1',
        UserAccountStatus.ACTIVE,
        0,
        new Date(),
        false,
        new Date(),
        new Date()
      );

      mockUserRepository.findByEmail.mockResolvedValue(managerUser);
      (BcryptUtil.compare as jest.Mock).mockResolvedValue(true);
      (JwtUtil.generateToken as jest.Mock).mockReturnValue('jwt_token_here');
      mockUserBranchAccessRepository.findBranchIdsByUserId.mockResolvedValue(['branch-9']);
      mockBranchRepository.findManyForList.mockResolvedValue([
        { id: 'branch-9', name: 'Sucursal 9' },
      ] as any);

      const result = await loginUseCase.execute(validInput);

      expect(result.branches).toEqual([{ id: 'branch-9', name: 'Sucursal 9' }]);
      expect(mockBranchRepository.findAllIdsByOrganizationId).not.toHaveBeenCalled();
      expect(JwtUtil.generateToken).toHaveBeenCalledWith(
        expect.objectContaining({ branch: 'branch-9' }),
        '8h'
      );
    });

    it('should not include branches when non-owner role has no assigned branches', async () => {
      const waiterUser = new User(
        '123',
        'John',
        'Doe',
        null,
        'john@example.com',
        'hashed_password',
        null,
        true,
        UserRole.WAITER,
        'org-1',
        UserAccountStatus.ACTIVE,
        0,
        new Date(),
        false,
        new Date(),
        new Date()
      );

      mockUserRepository.findByEmail.mockResolvedValue(waiterUser);
      (BcryptUtil.compare as jest.Mock).mockResolvedValue(true);
      (JwtUtil.generateToken as jest.Mock).mockReturnValue('jwt_token_here');
      mockUserBranchAccessRepository.findBranchIdsByUserId.mockResolvedValue([]);

      const result = await loginUseCase.execute(validInput);

      expect(result.branches).toBeUndefined();
    });
  });
});

