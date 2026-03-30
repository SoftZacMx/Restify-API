/// <reference types="jest" />

import { UserRepository } from '../../../src/core/infrastructure/database/repositories/user.repository';
import { User } from '../../../src/core/domain/entities/user.entity';
import { UserRole } from '@prisma/client';

// Mock Prisma Client
const mockPrismaClient = {
  user: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

describe('UserRepository', () => {
  let repository: UserRepository;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    repository = new UserRepository(mockPrismaClient as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findByEmail', () => {
    it('should return a user when found by email', async () => {
      const mockUser = {
        id: '123',
        name: 'John',
        last_name: 'Doe',
        second_last_name: null,
        email: 'john@example.com',
        password: 'hashed_password',
        phone: null,
        status: true,
        rol: UserRole.WAITER,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaClient.user.findUnique.mockResolvedValue(mockUser);

      const result = await repository.findByEmail('john@example.com');

      expect(result).toBeInstanceOf(User);
      expect(result?.email).toBe('john@example.com');
      expect(mockPrismaClient.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'john@example.com' },
      });
    });

    it('should return null when user not found', async () => {
      mockPrismaClient.user.findUnique.mockResolvedValue(null);

      const result = await repository.findByEmail('notfound@example.com');

      expect(result).toBeNull();
    });
  });

  describe('findById', () => {
    it('should return a user when found by id', async () => {
      const mockUser = {
        id: '123',
        name: 'John',
        last_name: 'Doe',
        second_last_name: null,
        email: 'john@example.com',
        password: 'hashed_password',
        phone: null,
        status: true,
        rol: UserRole.WAITER,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaClient.user.findUnique.mockResolvedValue(mockUser);

      const result = await repository.findById('123');

      expect(result).toBeInstanceOf(User);
      expect(result?.id).toBe('123');
    });
  });

  describe('create', () => {
    it('should create a new user', async () => {
      const userData = {
        name: 'John',
        last_name: 'Doe',
        email: 'john@example.com',
        password: 'hashed_password',
        rol: UserRole.WAITER,
      };

      const mockCreatedUser = {
        id: '123',
        ...userData,
        second_last_name: null,
        phone: null,
        status: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaClient.user.create.mockResolvedValue(mockCreatedUser);

      const result = await repository.create(userData);

      expect(result).toBeInstanceOf(User);
      expect(result.name).toBe('John');
      expect(mockPrismaClient.user.create).toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should update user data', async () => {
      const updatedData = {
        name: 'Jane',
        status: false,
      };

      const mockUpdatedUser = {
        id: '123',
        name: 'Jane',
        last_name: 'Doe',
        second_last_name: null,
        email: 'john@example.com',
        password: 'hashed_password',
        phone: null,
        status: false,
        rol: UserRole.WAITER,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaClient.user.update.mockResolvedValue(mockUpdatedUser);

      const result = await repository.update('123', updatedData);

      expect(result).toBeInstanceOf(User);
      expect(result.name).toBe('Jane');
      expect(result.status).toBe(false);
    });
  });

  describe('delete', () => {
    it('should soft delete a user by setting status to false', async () => {
      const mockUpdatedUser = {
        id: '123',
        name: 'John',
        last_name: 'Doe',
        second_last_name: null,
        email: 'john@example.com',
        password: 'hashed_password',
        phone: null,
        status: false,
        rol: UserRole.WAITER,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaClient.user.update.mockResolvedValue(mockUpdatedUser);

      await repository.delete('123');

      expect(mockPrismaClient.user.update).toHaveBeenCalledWith({
        where: { id: '123' },
        data: { status: false },
      });
    });
  });
});

