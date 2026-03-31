import { container } from 'tsyringe';
import { OrderRepository } from '../../database/repositories/order.repository';
import { IOrderRepository } from '../../../domain/interfaces/order-repository.interface';
import { PayOrderUseCase } from '../../../application/use-cases/orders/pay-order.use-case';
import { prismaClient } from './prisma.module';

container.register<IOrderRepository>('IOrderRepository', {
  useFactory: () => new OrderRepository(prismaClient),
});

container.register(PayOrderUseCase, PayOrderUseCase);
