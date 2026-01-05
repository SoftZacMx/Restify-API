import { ListUsersUseCase } from '../../../../src/core/application/use-cases/users/list-users.use-case';
import { IUserRepository } from '../../../../src/core/domain/interfaces/user-repository.interface';
import { User } from '../../../../src/core/domain/entities/user.entity';
import { UserRole } from '@prisma/client';

describe('ListUsersUseCase', () => {
  let listUsersUseCase: ListUsersUseCase;
  let mockUserRepository: jest.Mocked<IUserRepository>;

  beforeEach(() => {
    mockUserRepository = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findAll: jest.fn(),
    };

    listUsersUseCase = new ListUsersUseCase(mockUserRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('should return all users when no filters provided', async () => {
      const mockUsers = [
        new User('1', 'John', 'Doe', null, 'john@example.com', 'hash1', null, true, UserRole.WAITER, new Date(), new Date()),
        new User('2', 'Jane', 'Smith', null, 'jane@example.com', 'hash2', null, true, UserRole.MANAGER, new Date(), new Date()),
      ];

      mockUserRepository.findAll.mockResolvedValue(mockUsers);

      const result = await listUsersUseCase.execute();

      expect(result).toHaveLength(2);
      expect(result[0].email).toBe('john@example.com');
      expect(result[1].email).toBe('jane@example.com');
      expect(mockUserRepository.findAll).toHaveBeenCalledWith(undefined);
    });

    it('should return filtered users by role', async () => {
      const mockUsers = [
        new User('1', 'John', 'Doe', null, 'john@example.com', 'hash1', null, true, UserRole.WAITER, new Date(), new Date()),
      ];

      mockUserRepository.findAll.mockResolvedValue(mockUsers);

      const result = await listUsersUseCase.execute({ rol: UserRole.WAITER });

      expect(result).toHaveLength(1);
      expect(result[0].rol).toBe(UserRole.WAITER);
      expect(mockUserRepository.findAll).toHaveBeenCalledWith({
        rol: UserRole.WAITER,
        status: undefined,
        email: undefined,
      });
    });

    it('should return filtered users by status', async () => {
      const mockUsers = [
        new User('1', 'John', 'Doe', null, 'john@example.com', 'hash1', null, true, UserRole.WAITER, new Date(), new Date()),
      ];

      mockUserRepository.findAll.mockResolvedValue(mockUsers);

      const result = await listUsersUseCase.execute({ status: true });

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe(true);
      expect(mockUserRepository.findAll).toHaveBeenCalledWith({
        rol: undefined,
        status: true,
        email: undefined,
      });
    });

    it('should not return passwords in results', async () => {
      const mockUsers = [
        new User('1', 'John', 'Doe', null, 'john@example.com', 'hash1', null, true, UserRole.WAITER, new Date(), new Date()),
      ];

      mockUserRepository.findAll.mockResolvedValue(mockUsers);

      const result = await listUsersUseCase.execute();

      expect(result[0]).not.toHaveProperty('password');
    });
  });
});

