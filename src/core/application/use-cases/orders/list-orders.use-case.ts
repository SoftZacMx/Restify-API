import { inject, injectable } from 'tsyringe';
import { IOrderRepository } from '../../../domain/interfaces/order-repository.interface';
import { ListOrdersInput } from '../../dto/order.dto';

export interface ListOrdersResult {
  id: string;
  date: Date;
  status: boolean;
  paymentMethod: number | null;
  total: number;
  subtotal: number;
  iva: number;
  delivered: boolean;
  tableId: string | null;
  tip: number;
  origin: string;
  client: string | null;
  paymentDiffer: boolean;
  note: string | null;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

@injectable()
export class ListOrdersUseCase {
  constructor(
    @inject('IOrderRepository') private readonly orderRepository: IOrderRepository
  ) {}

  async execute(input?: ListOrdersInput): Promise<ListOrdersResult[]> {
    const filters = input
      ? {
          status: input.status,
          userId: input.userId,
          tableId: input.tableId,
          paymentMethod: input.paymentMethod,
          origin: input.origin,
          dateFrom: input.dateFrom ? new Date(input.dateFrom) : undefined,
          dateTo: input.dateTo ? new Date(input.dateTo) : undefined,
        }
      : undefined;

    const orders = await this.orderRepository.findAll(filters);

    return orders.map((order) => ({
      id: order.id,
      date: order.date,
      status: order.status,
      paymentMethod: order.paymentMethod,
      total: order.total,
      subtotal: order.subtotal,
      iva: order.iva,
      delivered: order.delivered,
      tableId: order.tableId,
      tip: order.tip,
      origin: order.origin,
      client: order.client,
      paymentDiffer: order.paymentDiffer,
      note: order.note,
      userId: order.userId,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    }));
  }
}

