import { container } from 'tsyringe';
import { TableRepository } from '../../database/repositories/table.repository';
import { ITableRepository } from '../../../domain/interfaces/table-repository.interface';
import { prismaClient } from './prisma.module';

container.register<ITableRepository>('ITableRepository', {
  useFactory: () => new TableRepository(prismaClient),
});
