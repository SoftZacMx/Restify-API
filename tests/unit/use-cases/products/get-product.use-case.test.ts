import { GetProductUseCase } from '../../../../src/core/application/use-cases/products/get-product.use-case';
import { IProductRepository } from '../../../../src/core/domain/interfaces/product-repository.interface';
import { Product } from '../../../../src/core/domain/entities/product.entity';
import { AppError } from '../../../../src/shared/errors';

describe('GetProductUseCase', () => {
  let getProductUseCase: GetProductUseCase;
  let mockProductRepository: jest.Mocked<IProductRepository>;

  beforeEach(() => {
    mockProductRepository = {
      findById: jest.fn(),
      findByIds: jest.fn(),
      findAll: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    getProductUseCase = new GetProductUseCase(mockProductRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    const validInput = {
      product_id: '123',
    };

    it('should return product data when product exists', async () => {
      const mockProduct = new Product(
        '123',
        'Test Product',
        'Test description',
        new Date(),
        true,
        '456',
        new Date(),
        new Date()
      );

      mockProductRepository.findById.mockResolvedValue(mockProduct);

      const result = await getProductUseCase.execute(validInput);

      expect(result).toHaveProperty('id');
      expect(result.id).toBe('123');
      expect(result.name).toBe('Test Product');
      expect(mockProductRepository.findById).toHaveBeenCalledWith('123');
    });

    it('should throw error when product not found', async () => {
      mockProductRepository.findById.mockResolvedValue(null);

      try {
        await getProductUseCase.execute(validInput);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).code).toBe('PRODUCT_NOT_FOUND');
      }
    });
  });
});

