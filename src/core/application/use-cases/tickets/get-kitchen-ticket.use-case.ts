import { inject, injectable } from 'tsyringe';
import { IOrderRepository } from '../../../domain/interfaces/order-repository.interface';
import { ITableRepository } from '../../../domain/interfaces/table-repository.interface';
import { IProductRepository } from '../../../domain/interfaces/product-repository.interface';
import { IMenuItemRepository } from '../../../domain/interfaces/menu-item-repository.interface';
import {
  KitchenTicketResponse,
  KitchenTicketOrderItem,
  KitchenTicketExtraItem,
} from '../../dto/ticket.dto';
import { AppError } from '../../../../shared/errors';

@injectable()
export class GetKitchenTicketUseCase {
  constructor(
    @inject('IOrderRepository') private readonly orderRepository: IOrderRepository,
    @inject('ITableRepository') private readonly tableRepository: ITableRepository,
    @inject('IProductRepository') private readonly productRepository: IProductRepository,
    @inject('IMenuItemRepository') private readonly menuItemRepository: IMenuItemRepository
  ) {}

  async execute(orderId: string): Promise<KitchenTicketResponse> {
    const order = await this.orderRepository.findById(orderId);
    if (!order) {
      throw new AppError('ORDER_NOT_FOUND');
    }

    const [orderItems, allExtras, table] = await Promise.all([
      this.orderRepository.findOrderItemsByOrderId(orderId),
      this.orderRepository.findOrderItemExtrasByOrderId(orderId),
      order.tableId ? this.tableRepository.findById(order.tableId) : Promise.resolve(null),
    ]);

    const productIds = [...new Set(orderItems.map((i) => i.productId).filter(Boolean) as string[])];
    const menuItemIds = [...new Set(orderItems.map((i) => i.menuItemId).filter(Boolean) as string[])];
    const extraIds = [...new Set(allExtras.map((e) => e.extraId))];
    const allMenuItemIds = [...new Set([...menuItemIds, ...extraIds])];

    const [products, menuItems] = await Promise.all([
      productIds.length > 0 ? this.productRepository.findByIds(productIds) : Promise.resolve([]),
      Promise.all(allMenuItemIds.map((id) => this.menuItemRepository.findById(id))),
    ]);

    const productNames = new Map(products.map((p) => [p.id, p.name]));
    const menuItemNames = new Map(
      menuItems.filter((m): m is NonNullable<typeof m> => m != null).map((m) => [m.id, m.name])
    );

    const extrasByItemId = allExtras.reduce<Record<string, typeof allExtras>>((acc, e) => {
      if (!acc[e.orderItemId]) acc[e.orderItemId] = [];
      acc[e.orderItemId].push(e);
      return acc;
    }, {});

    const items: KitchenTicketOrderItem[] = orderItems.map((item) => {
      const name =
        item.productId !== null
          ? productNames.get(item.productId) ?? 'Producto'
          : item.menuItemId !== null
            ? menuItemNames.get(item.menuItemId) ?? 'Ítem'
            : 'Ítem';
      const extras: KitchenTicketExtraItem[] = (extrasByItemId[item.id] ?? []).map((e) => ({
        name: menuItemNames.get(e.extraId) ?? 'Extra',
        quantity: e.quantity,
      }));
      return {
        name,
        quantity: item.quantity,
        extras,
        note: item.note ?? undefined,
      };
    });

    const tableName = table ? table.name : null;

    const lines: string[] = [];
    lines.push('--- COCINA ---');
    lines.push(tableName !== null ? `Mesa: ${tableName}` : 'Sin mesa');
    lines.push(`Orden: ${order.id.slice(0, 8)}`);
    lines.push('');
    for (const it of items) {
      lines.push(`${it.quantity}x ${it.name}`);
      for (const ex of it.extras) {
        lines.push(`   + ${ex.name} (${ex.quantity})`);
      }
      if (it.note?.trim()) {
        lines.push(`   Nota: ${it.note.trim()}`);
      }
    }

    return {
      orderId: order.id,
      tableName,
      items,
      lines,
    };
  }
}
