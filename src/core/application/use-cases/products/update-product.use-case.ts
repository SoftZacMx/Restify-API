import { inject, injectable } from 'tsyringe';
import { IProductRepository } from '../../../domain/interfaces/product-repository.interface';
import { UpdateProductInput } from '../../dto/product.dto';
import { AppError } from '../../../../shared/errors';

export interface UpdateProductResult {
  id: string;
  name: string;
  description: string | null;
  registrationDate: Date;
  status: boolean;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

@injectable()
export class UpdateProductUseCase {
  constructor(
    @inject('IProductRepository') private readonly productRepository: IProductRepository
  ) {}

  async execute(productId: string, input: UpdateProductInput): Promise<UpdateProductResult> {
    // Check if product exists
    const existingProduct = await this.productRepository.findById(productId);
    if (!existingProduct) {
      throw new AppError('PRODUCT_NOT_FOUND');
    }

    // Prepare update data
    const updateData: any = {};

    if (input.name !== undefined) updateData.name = input.name;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.status !== undefined) updateData.status = input.status;

    // Update product
    const product = await this.productRepository.update(productId, updateData);

    return {
      id: product.id,
      name: product.name,
      description: product.description,
      registrationDate: product.registrationDate,
      status: product.status,
      userId: product.userId,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };
  }
}

