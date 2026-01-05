import { inject, injectable } from 'tsyringe';
import { IProductRepository } from '../../../domain/interfaces/product-repository.interface';
import { DeleteProductInput } from '../../dto/product.dto';
import { AppError } from '../../../../shared/errors';

@injectable()
export class DeleteProductUseCase {
  constructor(
    @inject('IProductRepository') private readonly productRepository: IProductRepository
  ) {}

  async execute(input: DeleteProductInput): Promise<void> {
    // Check if product exists
    const product = await this.productRepository.findById(input.product_id);
    if (!product) {
      throw new AppError('PRODUCT_NOT_FOUND');
    }

    // Delete product
    await this.productRepository.delete(input.product_id);
  }
}

