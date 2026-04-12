import { inject, injectable } from 'tsyringe';
import { IOrderRepository } from '../../../domain/interfaces/order-repository.interface';
import { ITableRepository } from '../../../domain/interfaces/table-repository.interface';
import { IMenuItemRepository } from '../../../domain/interfaces/menu-item-repository.interface';
import { IProductRepository } from '../../../domain/interfaces/product-repository.interface';
import { GetOrderInput } from '../../dto/order.dto';
import { AppError } from '../../../../shared/errors';

const nameRef = (id: string, name: string) => ({ id, name });

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
    name: string;
    status: boolean;
    availabilityStatus: boolean;
  };
  tip: number;
  origin: string;
  client: string | null;
  paymentDiffer: boolean;
  note: string | null;
  userId: string | null;
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
    menuItem?: { id: string; name: string };
    product?: { id: string; name: string };
    extras?: Array<{
      id: string;
      extraId: string;
      quantity: number;
      price: number;
      createdAt: Date;
      updatedAt: Date;
      extra?: { id: string; name: string };
    }>;
  }>;
}

@injectable()
export class GetOrderUseCase {
  constructor(
    @inject('IOrderRepository') private readonly orderRepository: IOrderRepository,
    @inject('ITableRepository') private readonly tableRepository: ITableRepository,
    @inject('IMenuItemRepository') private readonly menuItemRepository: IMenuItemRepository,
    @inject('IProductRepository') private readonly productRepository: IProductRepository
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

    // Collect menuItem ids (items + extras) and product ids for names
    const menuItemIds = new Set<string>();
    const productIds = new Set<string>();
    for (const item of orderItems) {
      if (item.menuItemId) menuItemIds.add(item.menuItemId);
      if (item.productId) productIds.add(item.productId);
    }
    for (const extra of allExtras) {
      menuItemIds.add(extra.extraId);
    }
    const [menuItems = [], products = []] = await Promise.all([
      this.menuItemRepository.findByIds([...menuItemIds]),
      this.productRepository.findByIds([...productIds]),
    ]);
    const menuItemMap = new Map(menuItems.map((m) => [m.id, nameRef(m.id, m.name)]));
    const productMap = new Map(products.map((p) => [p.id, nameRef(p.id, p.name)]));

    let table: GetOrderResult['table'];
    if (order.tableId) {
      const tableEntity = await this.tableRepository.findById(order.tableId);
      if (tableEntity) {
        table = {
          id: tableEntity.id,
          name: tableEntity.name,
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
      orderItems: orderItems.map((item) => {
        const menuItem = item.menuItemId ? menuItemMap.get(item.menuItemId) : undefined;
        const product = item.productId ? productMap.get(item.productId) : undefined;
        return {
          id: item.id,
          quantity: item.quantity,
          price: item.price,
          productId: item.productId,
          menuItemId: item.menuItemId,
          note: item.note,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
          ...(menuItem && { menuItem }),
          ...(product && { product }),
          extras: (extrasByItemId[item.id] || []).map((extra) => {
            const extraInfo = menuItemMap.get(extra.extraId);
            return {
              id: extra.id,
              extraId: extra.extraId,
              quantity: extra.quantity,
              price: extra.price,
              createdAt: extra.createdAt,
              updatedAt: extra.updatedAt,
              ...(extraInfo && { extra: extraInfo }),
            };
          }),
        };
      }),
    };
  }
}

