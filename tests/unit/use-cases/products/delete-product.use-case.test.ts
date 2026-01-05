import { DeleteProductUseCase } from '../../../../src/core/application/use-cases/products/delete-product.use-case';
import { IProductRepository } from '../../../../src/core/domain/interfaces/product-repository.interface';
import { Product } from '../../../../src/core/domain/entities/product.entity';
import { AppError } from '../../../../src/shared/errors';

describe('DeleteProductUseCase', () => {
  let deleteProductUseCase: DeleteProductUseCase;
  let mockProductRepository: jest.Mocked<IProductRepository>;

  beforeEach(() => {
    mockProductRepository = {
      findById: jest.fn(),
      findAll: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    deleteProductUseCase = new DeleteProductUseCase(mockProductRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    const validInput = {
      product_id: '123',
    };

    it('should delete product successfully', async () => {
      const mockProduct = new Product(
        '123',
        'Test Product',
        'Description',
        new Date(),
        true,
        '456',
        new Date(),
        new Date()
      );

      mockProductRepository.findById.mockResolvedValue(mockProduct);
      mockProductRepository.delete.mockResolvedValue();

      await deleteProductUseCase.execute(validInput);

      expect(mockProductRepository.findById).toHaveBeenCalledWith('123');
      expect(mockProductRepository.delete).toHaveBeenCalledWith('123');
    });

    it('should throw error when product not found', async () => {
      mockProductRepository.findById.mockResolvedValue(null);

      try {
        await deleteProductUseCase.execute(validInput);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).code).toBe('PRODUCT_NOT_FOUND');
      }
    });
  });
});

