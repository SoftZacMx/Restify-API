import { inject, injectable } from 'tsyringe';
import { IProductRepository } from '../../../domain/interfaces/product-repository.interface';
import { IFileStorage } from '../../../domain/interfaces/file-storage.interface';
import { UpdateProductInput } from '../../dto/product.dto';
import { AppError } from '../../../../shared/errors';
import { logger } from '../../../../shared/utils/logger';

export interface UpdateProductResult {
  id: string;
  name: string;
  description: string | null;
  registrationDate: Date;
  status: boolean;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  imageUrl: string | null;
  imageKey: string | null;
}

@injectable()
export class UpdateProductUseCase {
  constructor(
    @inject('IProductRepository') private readonly productRepository: IProductRepository,
    @inject('IFileStorage') private readonly fileStorage: IFileStorage
  ) {}

  async execute(productId: string, input: UpdateProductInput): Promise<UpdateProductResult> {
    // Check if product exists
    const existingProduct = await this.productRepository.findById(productId);
    if (!existingProduct) {
      throw new AppError('PRODUCT_NOT_FOUND');
    }

    const previousImageKey = existingProduct.imageKey;

    // Prepare update data
    const updateData: any = {};

    if (input.name !== undefined) updateData.name = input.name;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.status !== undefined) updateData.status = input.status;
    if (input.imageUrl !== undefined) updateData.imageUrl = input.imageUrl;
    if (input.imageKey !== undefined) updateData.imageKey = input.imageKey;

    // Update product
    const product = await this.productRepository.update(productId, updateData);

    // Si la imagen cambió, borrar la anterior del storage (best-effort: no rompe el update).
    if (previousImageKey && previousImageKey !== product.imageKey) {
      await this.deletePreviousImage(previousImageKey);
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
      imageUrl: product.imageUrl,
      imageKey: product.imageKey,
    };
  }

  private async deletePreviousImage(key: string): Promise<void> {
    try {
      await this.fileStorage.delete(key);
    } catch (error) {
      logger.error({ err: error, key }, '[Product] No se pudo borrar la imagen anterior en storage');
    }
  }
}

