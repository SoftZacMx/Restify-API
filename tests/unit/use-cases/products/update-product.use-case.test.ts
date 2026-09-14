import { UpdateProductUseCase } from '../../../../src/core/application/use-cases/products/update-product.use-case';
import { IProductRepository } from '../../../../src/core/domain/interfaces/product-repository.interface';
import { IFileStorage } from '../../../../src/core/domain/interfaces/file-storage.interface';
import { Product } from '../../../../src/core/domain/entities/product.entity';
import { AppError } from '../../../../src/shared/errors';

describe('UpdateProductUseCase', () => {
  let updateProductUseCase: UpdateProductUseCase;
  let mockProductRepository: jest.Mocked<IProductRepository>;
  let mockFileStorage: jest.Mocked<IFileStorage>;

  beforeEach(() => {
    mockProductRepository = {
      findById: jest.fn(),
      findByIds: jest.fn(),
      findAll: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    mockFileStorage = {
      upload: jest.fn(),
      delete: jest.fn(),
    };

    updateProductUseCase = new UpdateProductUseCase(mockProductRepository, mockFileStorage);
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

    const productWithOldImage = new Product(
      '123', 'Original Product', 'desc', new Date(), true, '456', new Date(), new Date(),
      false, null, null, 'https://cdn/old.webp', 'branches/b/products/old.webp'
    );

    it('should delete the previous image when the image changes', async () => {
      mockProductRepository.findById.mockResolvedValue(productWithOldImage);
      mockProductRepository.update.mockResolvedValue({
        ...productWithOldImage,
        imageUrl: 'https://cdn/new.webp',
        imageKey: 'branches/b/products/new.webp',
      } as Product);

      await updateProductUseCase.execute(productId, {
        imageUrl: 'https://cdn/new.webp',
        imageKey: 'branches/b/products/new.webp',
      });

      expect(mockFileStorage.delete).toHaveBeenCalledWith('branches/b/products/old.webp');
    });

    it('should not delete any image when the image does not change', async () => {
      mockProductRepository.findById.mockResolvedValue(productWithOldImage);
      mockProductRepository.update.mockResolvedValue({
        ...productWithOldImage,
        name: 'Renamed',
      } as Product);

      await updateProductUseCase.execute(productId, { name: 'Renamed' });

      expect(mockFileStorage.delete).not.toHaveBeenCalled();
    });

    it('should not fail the update when storage.delete throws (best-effort)', async () => {
      mockProductRepository.findById.mockResolvedValue(productWithOldImage);
      mockProductRepository.update.mockResolvedValue({
        ...productWithOldImage,
        imageKey: 'branches/b/products/new.webp',
      } as Product);
      mockFileStorage.delete.mockRejectedValue(new Error('S3 down'));

      await expect(
        updateProductUseCase.execute(productId, { imageKey: 'branches/b/products/new.webp' })
      ).resolves.toBeDefined();
    });
  });
});

