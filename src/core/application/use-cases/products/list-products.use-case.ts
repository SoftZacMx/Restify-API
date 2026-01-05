import { inject, injectable } from 'tsyringe';
import { IProductRepository } from '../../../domain/interfaces/product-repository.interface';
import { ListProductsInput } from '../../dto/product.dto';

export interface ListProductsResult {
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
export class ListProductsUseCase {
  constructor(
    @inject('IProductRepository') private readonly productRepository: IProductRepository
  ) {}

  async execute(input?: ListProductsInput): Promise<ListProductsResult[]> {
    const filters = input
      ? {
          status: input.status,
          userId: input.userId,
          search: input.search,
        }
      : undefined;

    const products = await this.productRepository.findAll(filters);

    return products.map((product) => ({
      id: product.id,
      name: product.name,
      description: product.description,
      registrationDate: product.registrationDate,
      status: product.status,
      userId: product.userId,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    }));
  }
}

