import { inject, injectable } from 'tsyringe';
import { IOrderRepository } from '../../../domain/interfaces/order-repository.interface';
import { GetOrderInput } from '../../dto/order.dto';
import { AppError } from '../../../../shared/errors';

export interface GetOrderResult {
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
  orderItems?: Array<{
    id: string;
    quantity: number;
    price: number;
    productId: string;
    createdAt: Date;
    updatedAt: Date;
  }>;
  orderMenuItems?: Array<{
    id: string;
    menuItemId: string;
    amount: number;
    unitPrice: number;
    note: string | null;
    createdAt: Date;
    updatedAt: Date;
  }>;
}

@injectable()
export class GetOrderUseCase {
  constructor(
    @inject('IOrderRepository') private readonly orderRepository: IOrderRepository
  ) {}

  async execute(input: GetOrderInput): Promise<GetOrderResult> {
    const order = await this.orderRepository.findById(input.order_id);

    if (!order) {
      throw new AppError('ORDER_NOT_FOUND');
    }

    // Get order items and menu items
    const orderItems = await this.orderRepository.findOrderItemsByOrderId(order.id);
    const orderMenuItems = await this.orderRepository.findOrderMenuItemsByOrderId(order.id);

    return {
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
      orderItems: orderItems.map((item) => ({
        id: item.id,
        quantity: item.quantity,
        price: item.price,
        productId: item.productId,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
      orderMenuItems: orderMenuItems.map((item) => ({
        id: item.id,
        menuItemId: item.menuItemId,
        amount: item.amount,
        unitPrice: item.unitPrice,
        note: item.note,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
    };
  }
}

