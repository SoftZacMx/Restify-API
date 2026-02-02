import { inject, injectable } from 'tsyringe';
import { IOrderRepository } from '../../../domain/interfaces/order-repository.interface';
import { ITableRepository } from '../../../domain/interfaces/table-repository.interface';
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
  /** Mesa asociada (incluida cuando la orden tiene tableId). Para mostrar "Mesa N" en la vista. */
  table?: {
    id: string;
    numberTable: number;
    status: boolean;
    availabilityStatus: boolean;
  };
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
    productId: string | null;
    menuItemId: string | null;
    note: string | null;
    createdAt: Date;
    updatedAt: Date;
    extras?: Array<{
      id: string;
      extraId: string;
      quantity: number;
      price: number;
      createdAt: Date;
      updatedAt: Date;
    }>;
  }>;
}

@injectable()
export class GetOrderUseCase {
  constructor(
    @inject('IOrderRepository') private readonly orderRepository: IOrderRepository,
    @inject('ITableRepository') private readonly tableRepository: ITableRepository
  ) {}

  async execute(input: GetOrderInput): Promise<GetOrderResult> {
    const order = await this.orderRepository.findById(input.order_id);

    if (!order) {
      throw new AppError('ORDER_NOT_FOUND');
    }

    // Get order items
    const orderItems = await this.orderRepository.findOrderItemsByOrderId(order.id);
    
    // Get all extras for this order (optimized query with orderId)
    const allExtras = await this.orderRepository.findOrderItemExtrasByOrderId(order.id);
    
    // Group extras by orderItemId
    const extrasByItemId = allExtras.reduce((acc, extra) => {
      if (!acc[extra.orderItemId]) {
        acc[extra.orderItemId] = [];
      }
      acc[extra.orderItemId].push(extra);
      return acc;
    }, {} as Record<string, typeof allExtras>);

    let table: GetOrderResult['table'];
    if (order.tableId) {
      const tableEntity = await this.tableRepository.findById(order.tableId);
      if (tableEntity) {
        table = {
          id: tableEntity.id,
          numberTable: tableEntity.numberTable,
          status: tableEntity.status,
          availabilityStatus: tableEntity.availabilityStatus,
        };
      }
    }

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
      table,
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
        menuItemId: item.menuItemId,
        note: item.note,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        extras: (extrasByItemId[item.id] || []).map((extra) => ({
          id: extra.id,
          extraId: extra.extraId,
          quantity: extra.quantity,
          price: extra.price,
          createdAt: extra.createdAt,
          updatedAt: extra.updatedAt,
        })),
      })),
    };
  }
}

