import { CreateTableUseCase } from '../../../../src/core/application/use-cases/tables/create-table.use-case';
import { ITableRepository } from '../../../../src/core/domain/interfaces/table-repository.interface';
import { IUserRepository } from '../../../../src/core/domain/interfaces/user-repository.interface';
import { Table } from '../../../../src/core/domain/entities/table.entity';
import { User } from '../../../../src/core/domain/entities/user.entity';
import { UserRole } from '@prisma/client';
import { AppError } from '../../../../src/shared/errors';

describe('CreateTableUseCase', () => {
  let createTableUseCase: CreateTableUseCase;
  let mockTableRepository: jest.Mocked<ITableRepository>;
  let mockUserRepository: jest.Mocked<IUserRepository>;

  beforeEach(() => {
    mockTableRepository = {
      findById: jest.fn(),
      findByNumberTable: jest.fn(),
      findAll: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    mockUserRepository = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findAll: jest.fn(),
    };

    createTableUseCase = new CreateTableUseCase(
      mockTableRepository,
      mockUserRepository
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    const validInput = {
      numberTable: 1,
      status: true,
      availabilityStatus: true,
      userId: '123',
    };

    it('should create a new table successfully', async () => {
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
        new Date(),
        new Date()
      );

      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockTableRepository.findByNumberTable.mockResolvedValue(null);

      const mockCreatedTable = new Table(
        '456',
        1,
        '123',
        true,
        true,
        new Date(),
        new Date()
      );

      mockTableRepository.create.mockResolvedValue(mockCreatedTable);

      const result = await createTableUseCase.execute(validInput);

      expect(result).toHaveProperty('id');
      expect(result.numberTable).toBe(1);
      expect(result.status).toBe(true);
      expect(result.availabilityStatus).toBe(true);
      expect(mockUserRepository.findById).toHaveBeenCalledWith('123');
      expect(mockTableRepository.findByNumberTable).toHaveBeenCalledWith(1);
      expect(mockTableRepository.create).toHaveBeenCalled();
    });

    it('should throw error when user not found', async () => {
      mockUserRepository.findById.mockResolvedValue(null);

      try {
        await createTableUseCase.execute(validInput);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).code).toBe('USER_NOT_FOUND');
      }
    });

    it('should throw error when table number already exists', async () => {
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
        new Date(),
        new Date()
      );

      const existingTable = new Table(
        '456',
        1,
        '123',
        true,
        true,
        new Date(),
        new Date()
      );

      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockTableRepository.findByNumberTable.mockResolvedValue(existingTable);

      try {
        await createTableUseCase.execute(validInput);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).code).toBe('VALIDATION_ERROR');
      }
    });
  });
});

