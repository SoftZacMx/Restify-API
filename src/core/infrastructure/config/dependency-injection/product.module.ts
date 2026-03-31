import { container } from 'tsyringe';
import { ProductRepository } from '../../database/repositories/product.repository';
import { IProductRepository } from '../../../domain/interfaces/product-repository.interface';
import { prismaClient } from './prisma.module';

container.register<IProductRepository>('IProductRepository', {
  useFactory: () => new ProductRepository(prismaClient),
});
