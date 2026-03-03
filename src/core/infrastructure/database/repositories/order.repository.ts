import { PrismaClient } from '@prisma/client';
import { IOrderRepository, OrderFilters } from '../../../domain/interfaces/order-repository.interface';
import { Order } from '../../../domain/entities/order.entity';
import { OrderItem } from '../../../domain/entities/order-item.entity';
import { OrderItemExtra } from '../../../domain/entities/order-item-extra.entity';

export class OrderRepository implements IOrderRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<Order | null> {
    const order = await this.prisma.order.findUnique({
      where: { id },
    });

    if (!order) {
      return null;
    }

    return new Order(
      order.id,
      order.date,
      order.status,
      order.paymentMethod,
      Number(order.total),
      Number(order.subtotal),
      Number(order.iva),
      order.delivered,
      order.tableId,
      Number(order.tip),
      order.origin,
      order.client,
      order.paymentDiffer,
      order.note,
      order.userId,
      order.createdAt,
      order.updatedAt
    );
  }

  private buildWhereFromFilters(filters?: OrderFilters): Record<string, unknown> {
    const where: Record<string, unknown> = {};
    if (filters?.status !== undefined) {
      where.status = filters.status;
    }
    if (filters?.userId) {
      where.userId = filters.userId;
    }
    if (filters?.tableId) {
      where.tableId = filters.tableId;
    }
    if (filters?.paymentMethod !== undefined) {
      where.paymentMethod = filters.paymentMethod;
    }
    if (filters?.origin) {
      where.origin = filters.origin;
    }
    if (filters?.dateFrom || filters?.dateTo) {
      where.date = {};
      if (filters.dateFrom) {
        (where.date as Record<string, Date>).gte = filters.dateFrom;
      }
      if (filters.dateTo) {
        (where.date as Record<string, Date>).lte = filters.dateTo;
      }
    }
    return where;
  }

  async findAll(filters?: OrderFilters, pagination?: { skip: number; take: number }): Promise<Order[]> {
    const where = this.buildWhereFromFilters(filters);

    const orders = await this.prisma.order.findMany({
      where,
      orderBy: {
        date: 'desc',
      },
      ...(pagination && { skip: pagination.skip, take: pagination.take }),
    });

    return orders.map(
      (order) =>
        new Order(
          order.id,
          order.date,
          order.status,
          order.paymentMethod,
          Number(order.total),
          Number(order.subtotal),
          Number(order.iva),
          order.delivered,
          order.tableId,
          Number(order.tip),
          order.origin,
          order.client,
          order.paymentDiffer,
          order.note,
          order.userId,
          order.createdAt,
          order.updatedAt
        )
    );
  }

  async count(filters?: OrderFilters): Promise<number> {
    const where = this.buildWhereFromFilters(filters);
    return this.prisma.order.count({ where });
  }

  async create(data: {
    date?: Date;
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
  }): Promise<Order> {
    const order = await this.prisma.order.create({
      data: {
        date: data.date || new Date(),
        status: data.status,
        paymentMethod: data.paymentMethod,
        total: data.total,
        subtotal: data.subtotal,
        iva: data.iva,
        delivered: data.delivered,
        tableId: data.tableId,
        tip: data.tip,
        origin: data.origin,
        client: data.client,
        paymentDiffer: data.paymentDiffer,
        note: data.note,
        userId: data.userId,
      },
    });

    return new Order(
      order.id,
      order.date,
      order.status,
      order.paymentMethod,
      Number(order.total),
      Number(order.subtotal),
      Number(order.iva),
      order.delivered,
      order.tableId,
      Number(order.tip),
      order.origin,
      order.client,
      order.paymentDiffer,
      order.note,
      order.userId,
      order.createdAt,
      order.updatedAt
    );
  }

  async update(
    id: string,
    data: {
      status?: boolean;
      paymentMethod?: number | null;
      delivered?: boolean;
      tip?: number;
      origin?: string;
      client?: string | null;
      paymentDiffer?: boolean;
      note?: string | null;
      tableId?: string | null;
      total?: number;
      subtotal?: number;
      iva?: number;
    }
  ): Promise<Order> {
    const updateData: any = {};

    if (data.status !== undefined) updateData.status = data.status;
    if (data.paymentMethod !== undefined) updateData.paymentMethod = data.paymentMethod;
    if (data.delivered !== undefined) updateData.delivered = data.delivered;
    if (data.tip !== undefined) updateData.tip = data.tip;
    if (data.origin !== undefined) updateData.origin = data.origin;
    if (data.client !== undefined) updateData.client = data.client;
    if (data.paymentDiffer !== undefined) updateData.paymentDiffer = data.paymentDiffer;
    if (data.note !== undefined) updateData.note = data.note;
    if (data.tableId !== undefined) updateData.tableId = data.tableId;
    if (data.total !== undefined) updateData.total = data.total;
    if (data.subtotal !== undefined) updateData.subtotal = data.subtotal;
    if (data.iva !== undefined) updateData.iva = data.iva;

    const order = await this.prisma.order.update({
      where: { id },
      data: updateData,
    });

    return new Order(
      order.id,
      order.date,
      order.status,
      order.paymentMethod,
      Number(order.total),
      Number(order.subtotal),
      Number(order.iva),
      order.delivered,
      order.tableId,
      Number(order.tip),
      order.origin,
      order.client,
      order.paymentDiffer,
      order.note,
      order.userId,
      order.createdAt,
      order.updatedAt
    );
  }

  async delete(id: string): Promise<void> {
    await this.prisma.order.delete({
      where: { id },
    });
  }

  // Order Items
  async createOrderItem(data: {
    quantity: number;
    price: number;
    orderId: string;
    productId: string | null;
    menuItemId: string | null;
    note: string | null;
  }): Promise<OrderItem> {
    const orderItem = await this.prisma.orderItem.create({
      data: {
        quantity: data.quantity,
        price: data.price,
        orderId: data.orderId,
        productId: data.productId,
        menuItemId: data.menuItemId,
        note: data.note,
      },
    });

    return new OrderItem(
      orderItem.id,
      orderItem.quantity,
      Number(orderItem.price),
      orderItem.orderId,
      orderItem.productId,
      orderItem.menuItemId,
      orderItem.note,
      orderItem.createdAt,
      orderItem.updatedAt
    );
  }

  async updateOrderItem(
    id: string,
    data: {
      quantity?: number;
      price?: number;
      note?: string | null;
    }
  ): Promise<OrderItem> {
    const updateData: any = {};
    if (data.quantity !== undefined) updateData.quantity = data.quantity;
    if (data.price !== undefined) updateData.price = data.price;
    if (data.note !== undefined) updateData.note = data.note;

    const orderItem = await this.prisma.orderItem.update({
      where: { id },
      data: updateData,
    });

    return new OrderItem(
      orderItem.id,
      orderItem.quantity,
      Number(orderItem.price),
      orderItem.orderId,
      orderItem.productId,
      orderItem.menuItemId,
      orderItem.note,
      orderItem.createdAt,
      orderItem.updatedAt
    );
  }

  async deleteOrderItem(id: string): Promise<void> {
    await this.prisma.orderItem.delete({
      where: { id },
    });
  }

  async deleteOrderItemsByOrderId(orderId: string): Promise<void> {
    await this.prisma.orderItem.deleteMany({
      where: { orderId },
    });
  }

  async findOrderItemsByOrderId(orderId: string): Promise<OrderItem[]> {
    const orderItems = await this.prisma.orderItem.findMany({
      where: { orderId },
    });

    return orderItems.map(
      (item) =>
        new OrderItem(
          item.id,
          item.quantity,
          Number(item.price),
          item.orderId,
          item.productId,
          item.menuItemId,
          item.note,
          item.createdAt,
          item.updatedAt
        )
    );
  }

  // Order Item Extras
  async createOrderItemExtra(data: {
    orderId: string;
    orderItemId: string;
    extraId: string;
    quantity: number;
    price: number;
  }): Promise<OrderItemExtra> {
    const orderItemExtra = await this.prisma.orderItemExtra.create({
      data: {
        orderId: data.orderId,
        orderItemId: data.orderItemId,
        extraId: data.extraId,
        quantity: data.quantity,
        price: data.price,
      },
    });

    return new OrderItemExtra(
      orderItemExtra.id,
      orderItemExtra.orderId,
      orderItemExtra.orderItemId,
      orderItemExtra.extraId,
      orderItemExtra.quantity,
      Number(orderItemExtra.price),
      orderItemExtra.createdAt,
      orderItemExtra.updatedAt
    );
  }

  async deleteOrderItemExtrasByOrderId(orderId: string): Promise<void> {
    await this.prisma.orderItemExtra.deleteMany({
      where: { orderId },
    });
  }

  async deleteOrderItemExtrasByOrderItemId(orderItemId: string): Promise<void> {
    await this.prisma.orderItemExtra.deleteMany({
      where: { orderItemId },
    });
  }

  async findOrderItemExtrasByOrderId(orderId: string): Promise<OrderItemExtra[]> {
    const orderItemExtras = await this.prisma.orderItemExtra.findMany({
      where: { orderId },
    });

    return orderItemExtras.map(
      (extra) =>
        new OrderItemExtra(
          extra.id,
          extra.orderId,
          extra.orderItemId,
          extra.extraId,
          extra.quantity,
          Number(extra.price),
          extra.createdAt,
          extra.updatedAt
        )
    );
  }

  async findOrderItemExtrasByOrderItemId(orderItemId: string): Promise<OrderItemExtra[]> {
    const orderItemExtras = await this.prisma.orderItemExtra.findMany({
      where: { orderItemId },
    });

    return orderItemExtras.map(
      (extra) =>
        new OrderItemExtra(
          extra.id,
          extra.orderId,
          extra.orderItemId,
          extra.extraId,
          extra.quantity,
          Number(extra.price),
          extra.createdAt,
          extra.updatedAt
        )
    );
  }
}

