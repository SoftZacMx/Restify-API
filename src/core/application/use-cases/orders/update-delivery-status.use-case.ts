import { inject, injectable } from 'tsyringe';
import { IOrderRepository } from '../../../domain/interfaces/order-repository.interface';
import { AppError } from '../../../../shared/errors';

export type DeliveryStatus = 'PREPARING' | 'READY' | 'ON_THE_WAY' | 'DELIVERED';

export interface UpdateDeliveryStatusResult {
  id: string;
  origin: string;
  delivered: boolean;
  deliveryStatus: DeliveryStatus;
}

@injectable()
export class UpdateDeliveryStatusUseCase {
  constructor(
    @inject('IOrderRepository') private readonly orderRepository: IOrderRepository
  ) {}

  async execute(orderId: string, input: { status: DeliveryStatus }): Promise<UpdateDeliveryStatusResult> {
    const order = await this.orderRepository.findById(orderId);
    if (!order) {
      throw new AppError('ORDER_NOT_FOUND');
    }

    if (order.origin !== 'online-delivery' && order.origin !== 'online-pickup') {
      throw new AppError('VALIDATION_ERROR', 'Delivery status can only be updated for online orders');
    }

    if (order.delivered) {
      throw new AppError('ORDER_ALREADY_DELIVERED');
    }

    const delivered = input.status === 'DELIVERED';

    await this.orderRepository.update(orderId, {
      delivered,
      deliveryStatus: input.status,
    });

    return {
      id: order.id,
      origin: order.origin,
      delivered,
      deliveryStatus: input.status,
    };
  }
}
