import { inject, injectable } from 'tsyringe';
import { IOrderRepository } from '../../../domain/interfaces/order-repository.interface';
import { PrismaService } from '../../../infrastructure/config/prisma.config';
import { StockService } from '../../services/stock.service';
import { AppError } from '../../../../shared/errors';

export interface DeleteOrderUseCaseInput {
  order_id: string;
  /** Usuario que ejecuta el borrado — autoría de los SALE_REVERSAL. Null si el delete es del sistema. */
  userId: string | null;
}

@injectable()
export class DeleteOrderUseCase {
  constructor(
    @inject('IOrderRepository') private readonly orderRepository: IOrderRepository,
    @inject(PrismaService) private readonly prismaService: PrismaService,
    @inject(StockService) private readonly stockService: StockService,
  ) {}

  async execute(input: DeleteOrderUseCaseInput): Promise<void> {
    const order = await this.orderRepository.findById(input.order_id);
    if (!order) {
      throw new AppError('ORDER_NOT_FOUND');
    }

    // Lookup de items fuera de la transacción — solo lectura, no necesita locking.
    const items = await this.orderRepository.findOrderItemsByOrderId(input.order_id);

    const prisma = this.prismaService.getClient();
    await prisma.$transaction(async (tx) => {
      // Revertir stock por TODOS los OrderItems en una sola pasada (Fase 4.2).
      // Mientras los OrderItems siguen vivos, los SALE originales tienen orderItemId válido.
      // Tras el cascade de delete, la FK queda en null pero el ledger persiste.
      await this.stockService.reverseSalesBatch(
        items.map((i) => i.id),
        input.userId,
        'order cancelled',
        tx
      );

      // Liberar mesa si aplica.
      if (order.tableId && order.origin.toLowerCase() === 'local') {
        await tx.table.update({
          where: { id: order.tableId },
          data: { availabilityStatus: true },
        });
      }

      // Cascade DB borra orderItems + orderItemExtras.
      await tx.order.delete({ where: { id: input.order_id } });
    });
  }
}
