import { UpdateProductUseCase } from '../../../../src/core/application/use-cases/products/update-product.use-case';
import { IProductRepository } from '../../../../src/core/domain/interfaces/product-repository.interface';
import { Product } from '../../../../src/core/domain/entities/product.entity';
import { AppError } from '../../../../src/shared/errors';

describe('UpdateProductUseCase', () => {
  let updateProductUseCase: UpdateProductUseCase;
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

    updateProductUseCase = new UpdateProductUseCase(mockProductRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    const productId = '123';
    const existingProduct = new Product(
      '123',
      'Original Product',
      'Original description',
      new Date(),
      true,
      '456',
      new Date(),
      new Date()
    );

    it('should update product successfully', async () => {
      mockProductRepository.findById.mockResolvedValue(existingProduct);
      mockProductRepository.update.mockResolvedValue({
        ...existingProduct,
        name: 'Updated Product',
      } as Product);

      const result = await updateProductUseCase.execute(productId, { name: 'Updated Product' });

      expect(result.name).toBe('Updated Product');
      expect(mockProductRepository.findById).toHaveBeenCalledWith(productId);
      expect(mockProductRepository.update).toHaveBeenCalled();
    });

    it('should throw error when product not found', async () => {
      mockProductRepository.findById.mockResolvedValue(null);

      try {
        await updateProductUseCase.execute(productId, { name: 'Updated Product' });
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).code).toBe('PRODUCT_NOT_FOUND');
      }
    });

    it('should update status successfully', async () => {
      mockProductRepository.findById.mockResolvedValue(existingProduct);
      mockProductRepository.update.mockResolvedValue({
        ...existingProduct,
        status: false,
      } as Product);

      const result = await updateProductUseCase.execute(productId, { status: false });

      expect(result.status).toBe(false);
      expect(mockProductRepository.update).toHaveBeenCalled();
    });
  });
});

