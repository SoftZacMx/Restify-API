import { ListProductsUseCase } from '../../../../src/core/application/use-cases/products/list-products.use-case';
import { IProductRepository } from '../../../../src/core/domain/interfaces/product-repository.interface';
import { Product } from '../../../../src/core/domain/entities/product.entity';

describe('ListProductsUseCase', () => {
  let listProductsUseCase: ListProductsUseCase;
  let mockProductRepository: jest.Mocked<IProductRepository>;

  beforeEach(() => {
    mockProductRepository = {
      findById: jest.fn(),
      findAll: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    listProductsUseCase = new ListProductsUseCase(mockProductRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('should return all products when no filters provided', async () => {
      const mockProducts = [
        new Product('1', 'Product 1', 'Description 1', new Date(), true, '123', new Date(), new Date()),
        new Product('2', 'Product 2', 'Description 2', new Date(), true, '123', new Date(), new Date()),
      ];

      mockProductRepository.findAll.mockResolvedValue(mockProducts);

      const result = await listProductsUseCase.execute();

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Product 1');
      expect(result[1].name).toBe('Product 2');
      expect(mockProductRepository.findAll).toHaveBeenCalledWith(undefined);
    });

    it('should return filtered products by status', async () => {
      const mockProducts = [
        new Product('1', 'Product 1', null, new Date(), true, '123', new Date(), new Date()),
      ];

      mockProductRepository.findAll.mockResolvedValue(mockProducts);

      const result = await listProductsUseCase.execute({ status: true });

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe(true);
      expect(mockProductRepository.findAll).toHaveBeenCalledWith({
        status: true,
        userId: undefined,
        search: undefined,
      });
    });

    it('should return filtered products by userId', async () => {
      const mockProducts = [
        new Product('1', 'Product 1', null, new Date(), true, '123', new Date(), new Date()),
      ];

      mockProductRepository.findAll.mockResolvedValue(mockProducts);

      const result = await listProductsUseCase.execute({ userId: '123' });

      expect(result).toHaveLength(1);
      expect(result[0].userId).toBe('123');
      expect(mockProductRepository.findAll).toHaveBeenCalledWith({
        status: undefined,
        userId: '123',
        search: undefined,
      });
    });

    it('should return filtered products by search', async () => {
      const mockProducts = [
        new Product('1', 'Test Product', null, new Date(), true, '123', new Date(), new Date()),
      ];

      mockProductRepository.findAll.mockResolvedValue(mockProducts);

      const result = await listProductsUseCase.execute({ search: 'Test' });

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Test Product');
      expect(mockProductRepository.findAll).toHaveBeenCalledWith({
        status: undefined,
        userId: undefined,
        search: 'Test',
      });
    });
  });
});

