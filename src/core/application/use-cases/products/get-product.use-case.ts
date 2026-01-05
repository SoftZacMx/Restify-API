import { inject, injectable } from 'tsyringe';
import { IProductRepository } from '../../../domain/interfaces/product-repository.interface';
import { GetProductInput } from '../../dto/product.dto';
import { AppError } from '../../../../shared/errors';

export interface GetProductResult {
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
export class GetProductUseCase {
  constructor(
    @inject('IProductRepository') private readonly productRepository: IProductRepository
  ) {}

  async execute(input: GetProductInput): Promise<GetProductResult> {
    const product = await this.productRepository.findById(input.product_id);

    if (!product) {
      throw new AppError('PRODUCT_NOT_FOUND');
    }

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

