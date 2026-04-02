import { inject, injectable } from 'tsyringe';
import { IOrderRepository } from '../../../domain/interfaces/order-repository.interface';
import { ITableRepository } from '../../../domain/interfaces/table-repository.interface';
import { DeleteOrderInput } from '../../dto/order.dto';
import { AppError } from '../../../../shared/errors';

@injectable()
export class DeleteOrderUseCase {
  constructor(
    @inject('IOrderRepository') private readonly orderRepository: IOrderRepository,
    @inject('ITableRepository') private readonly tableRepository: ITableRepository,
  ) {}

  async execute(input: DeleteOrderInput): Promise<void> {
    // Check if order exists
    const order = await this.orderRepository.findById(input.order_id);
    if (!order) {
      throw new AppError('ORDER_NOT_FOUND');
    }

    // Si la orden tiene mesa asignada y es Local, liberar la mesa antes de eliminar
    if (order.tableId && order.origin.toLowerCase() === 'local') {
      await this.tableRepository.update(order.tableId, { availabilityStatus: true });
    }

    // Delete order (cascade will delete order items and order item extras)
    await this.orderRepository.delete(input.order_id);
  }
}
