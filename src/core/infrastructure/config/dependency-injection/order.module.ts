import { container } from 'tsyringe';
import { OrderRepository } from '../../database/repositories/order.repository';
import { IOrderRepository } from '../../../domain/interfaces/order-repository.interface';
import { PayOrderUseCase } from '../../../application/use-cases/orders/pay-order.use-case';
import { CreatePublicOrderUseCase } from '../../../application/use-cases/orders/create-public-order.use-case';
import { GetPublicOrderStatusUseCase } from '../../../application/use-cases/orders/get-public-order-status.use-case';
import { UpdateDeliveryStatusUseCase } from '../../../application/use-cases/orders/update-delivery-status.use-case';
import { prismaClient } from './prisma.module';

container.register<IOrderRepository>('IOrderRepository', {
  useFactory: () => new OrderRepository(prismaClient),
});

container.register(PayOrderUseCase, PayOrderUseCase);
container.register(CreatePublicOrderUseCase, CreatePublicOrderUseCase);
container.register(GetPublicOrderStatusUseCase, GetPublicOrderStatusUseCase);
container.register(UpdateDeliveryStatusUseCase, UpdateDeliveryStatusUseCase);
