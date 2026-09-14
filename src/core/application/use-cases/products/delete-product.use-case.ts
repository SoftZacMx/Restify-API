import { inject, injectable } from 'tsyringe';
import { IProductRepository } from '../../../domain/interfaces/product-repository.interface';
import { IFileStorage } from '../../../domain/interfaces/file-storage.interface';
import { DeleteProductInput } from '../../dto/product.dto';
import { AppError } from '../../../../shared/errors';
import { logger } from '../../../../shared/utils/logger';

@injectable()
export class DeleteProductUseCase {
  constructor(
    @inject('IProductRepository') private readonly productRepository: IProductRepository,
    @inject('IFileStorage') private readonly fileStorage: IFileStorage
  ) {}

  async execute(input: DeleteProductInput): Promise<void> {
    // Check if product exists
    const product = await this.productRepository.findById(input.product_id);
    if (!product) {
      throw new AppError('PRODUCT_NOT_FOUND');
    }

    // Delete product
    await this.productRepository.delete(input.product_id);

    // Borrar la imagen del storage (best-effort: no rompe el borrado del producto).
    if (product.imageKey) {
      try {
        await this.fileStorage.delete(product.imageKey);
      } catch (error) {
        logger.error(
          { err: error, key: product.imageKey },
          '[Product] No se pudo borrar la imagen en storage'
        );
      }
    }
  }
}

