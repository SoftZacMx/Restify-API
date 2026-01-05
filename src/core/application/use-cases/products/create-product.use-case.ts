import { inject, injectable } from 'tsyringe';
import { IProductRepository } from '../../../domain/interfaces/product-repository.interface';
import { IUserRepository } from '../../../domain/interfaces/user-repository.interface';
import { CreateProductInput } from '../../dto/product.dto';
import { AppError } from '../../../../shared/errors';

export interface CreateProductResult {
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
export class CreateProductUseCase {
  constructor(
    @inject('IProductRepository') private readonly productRepository: IProductRepository,
    @inject('IUserRepository') private readonly userRepository: IUserRepository
  ) {}

  async execute(input: CreateProductInput): Promise<CreateProductResult> {
    // Verify that user exists
    const user = await this.userRepository.findById(input.userId);
    if (!user) {
      throw new AppError('USER_NOT_FOUND');
    }

    // Create product
    const product = await this.productRepository.create({
      name: input.name,
      description: input.description || null,
      status: input.status ?? true,
      userId: input.userId,
    });

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

