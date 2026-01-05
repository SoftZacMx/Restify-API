import { CreateProductUseCase } from '../../../../src/core/application/use-cases/products/create-product.use-case';
import { IProductRepository } from '../../../../src/core/domain/interfaces/product-repository.interface';
import { IUserRepository } from '../../../../src/core/domain/interfaces/user-repository.interface';
import { Product } from '../../../../src/core/domain/entities/product.entity';
import { User } from '../../../../src/core/domain/entities/user.entity';
import { UserRole } from '@prisma/client';
import { AppError } from '../../../../src/shared/errors';

describe('CreateProductUseCase', () => {
  let createProductUseCase: CreateProductUseCase;
  let mockProductRepository: jest.Mocked<IProductRepository>;
  let mockUserRepository: jest.Mocked<IUserRepository>;

  beforeEach(() => {
    mockProductRepository = {
      findById: jest.fn(),
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

    createProductUseCase = new CreateProductUseCase(
      mockProductRepository,
      mockUserRepository
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    const validInput = {
      name: 'Test Product',
      description: 'Test description',
      status: true,
      userId: '123',
    };

    it('should create a new product successfully', async () => {
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

      const mockCreatedProduct = new Product(
        '456',
        'Test Product',
        'Test description',
        new Date(),
        true,
        '123',
        new Date(),
        new Date()
      );

      mockProductRepository.create.mockResolvedValue(mockCreatedProduct);

      const result = await createProductUseCase.execute(validInput);

      expect(result).toHaveProperty('id');
      expect(result.name).toBe('Test Product');
      expect(result.status).toBe(true);
      expect(mockUserRepository.findById).toHaveBeenCalledWith('123');
      expect(mockProductRepository.create).toHaveBeenCalled();
    });

    it('should throw error when user not found', async () => {
      mockUserRepository.findById.mockResolvedValue(null);

      try {
        await createProductUseCase.execute(validInput);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).code).toBe('USER_NOT_FOUND');
      }
    });

    it('should create product with null description when not provided', async () => {
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

      const mockCreatedProduct = new Product(
        '456',
        'Test Product',
        null,
        new Date(),
        true,
        '123',
        new Date(),
        new Date()
      );

      mockProductRepository.create.mockResolvedValue(mockCreatedProduct);

      const inputWithoutDescription = {
        ...validInput,
        description: undefined,
      };

      await createProductUseCase.execute(inputWithoutDescription);

      expect(mockProductRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          description: null,
        })
      );
    });
  });
});

