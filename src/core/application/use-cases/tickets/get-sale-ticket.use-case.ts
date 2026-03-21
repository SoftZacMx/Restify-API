import { inject, injectable } from 'tsyringe';
import { IOrderRepository } from '../../../domain/interfaces/order-repository.interface';
import { ITableRepository } from '../../../domain/interfaces/table-repository.interface';
import { IProductRepository } from '../../../domain/interfaces/product-repository.interface';
import { IMenuItemRepository } from '../../../domain/interfaces/menu-item-repository.interface';
import { ICompanyRepository } from '../../../domain/interfaces/company-repository.interface';
import {
  SaleTicketResponse,
  SaleTicketOrderItem,
  SaleTicketExtraItem,
} from '../../dto/ticket.dto';
import { mergeTicketPrintConfig } from '../../dto/ticket-print-config';
import { AppError } from '../../../../shared/errors';

const PAYMENT_METHOD_LABELS: Record<number, string> = {
  1: 'Efectivo',
  2: 'Transferencia',
  3: 'Tarjeta',
};

function paymentMethodLabel(paymentMethod: number | null): string {
  if (paymentMethod === null) return 'Pago dividido';
  return PAYMENT_METHOD_LABELS[paymentMethod] ?? 'Otro';
}

@injectable()
export class GetSaleTicketUseCase {
  constructor(
    @inject('IOrderRepository') private readonly orderRepository: IOrderRepository,
    @inject('ITableRepository') private readonly tableRepository: ITableRepository,
    @inject('IProductRepository') private readonly productRepository: IProductRepository,
    @inject('IMenuItemRepository') private readonly menuItemRepository: IMenuItemRepository,
    @inject('ICompanyRepository') private readonly companyRepository: ICompanyRepository
  ) {}

  async execute(orderId: string): Promise<SaleTicketResponse> {
    const [order, company] = await Promise.all([
      this.orderRepository.findById(orderId),
      this.companyRepository.findFirst(),
    ]);
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

    const items: SaleTicketOrderItem[] = orderItems.map((item) => {
      const name =
        item.productId !== null
          ? productNames.get(item.productId) ?? 'Producto'
          : item.menuItemId !== null
            ? menuItemNames.get(item.menuItemId) ?? 'Ítem'
            : 'Ítem';
      const itemPrice = item.price;
      const itemExtras: SaleTicketExtraItem[] = (extrasByItemId[item.id] ?? []).map((e) => ({
        name: menuItemNames.get(e.extraId) ?? 'Extra',
        quantity: e.quantity,
        price: e.price,
      }));
      const extrasTotal = itemExtras.reduce((sum, ex) => sum + ex.price * ex.quantity, 0);
      const lineTotal = itemPrice * item.quantity + extrasTotal;

      return {
        name,
        quantity: item.quantity,
        price: itemPrice,
        lineTotal,
        extras: itemExtras,
        note: item.note ?? undefined,
      };
    });

    const tableName = table ? table.name : null;
    const paymentMethod = paymentMethodLabel(order.paymentMethod);
    const dateFormatted = new Date(order.date).toLocaleString('es-MX', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const lines: string[] = [];
    lines.push('--- TICKET ---');
    lines.push(`Fecha: ${dateFormatted}`);
    lines.push(tableName !== null ? `Mesa: ${tableName}` : 'Para llevar');
    if (order.client?.trim()) lines.push(`Cliente: ${order.client.trim()}`);
    if (order.note?.trim()) lines.push(`Nota: ${order.note.trim()}`);
    lines.push('');
    for (const it of items) {
      lines.push(`${it.quantity}  ${it.name}  ${it.lineTotal.toFixed(2)}`);
      for (const ex of it.extras) {
        const exTotal = ex.price * ex.quantity;
        lines.push(`    + ${ex.name} (${ex.quantity})  ${exTotal.toFixed(2)}`);
      }
      if (it.note?.trim()) lines.push(`    Nota: ${it.note.trim()}`);
    }
    lines.push('');
    lines.push(`Subtotal:    ${order.subtotal.toFixed(2)}`);
    lines.push(`IVA:         ${order.iva.toFixed(2)}`);
    lines.push(`Propina:     ${order.tip.toFixed(2)}`);
    lines.push(`TOTAL:       ${order.total.toFixed(2)}`);
    lines.push(`Método:      ${paymentMethod}`);
    lines.push(`Entregado:   ${order.delivered ? 'Sí' : 'No'}`);

    return {
      companyName: company?.name ?? 'Restify',
      orderId: order.id,
      date: order.date.toISOString(),
      origin: order.origin,
      tableName,
      client: order.client,
      note: order.note,
      items,
      subtotal: order.subtotal,
      iva: order.iva,
      tip: order.tip,
      total: order.total,
      paymentMethod,
      delivered: order.delivered,
      lines,
      printConfig: mergeTicketPrintConfig(company?.ticketConfig),
    };
  }
}
