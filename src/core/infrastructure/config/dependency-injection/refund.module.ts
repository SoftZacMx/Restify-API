import { container } from 'tsyringe';
import { RefundRepository } from '../../database/repositories/refund.repository';
import { IRefundRepository } from '../../../domain/interfaces/refund-repository.interface';
import { prismaClient } from './prisma.module';

container.register<IRefundRepository>('IRefundRepository', {
  useFactory: () => new RefundRepository(prismaClient),
});
