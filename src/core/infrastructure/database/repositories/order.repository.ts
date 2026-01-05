import { PrismaClient } from '@prisma/client';
import { IOrderRepository, OrderFilters } from '../../../domain/interfaces/order-repository.interface';
import { Order } from '../../../domain/entities/order.entity';
import { OrderItem } from '../../../domain/entities/order-item.entity';
import { OrderMenuItem } from '../../../domain/entities/order-menu-item.entity';

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

  async findAll(filters?: OrderFilters): Promise<Order[]> {
    const where: any = {};

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
        where.date.gte = filters.dateFrom;
      }
      if (filters.dateTo) {
        where.date.lte = filters.dateTo;
      }
    }

    const orders = await this.prisma.order.findMany({
      where,
      orderBy: {
        date: 'desc',
      },
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
    productId: string;
  }): Promise<OrderItem> {
    const orderItem = await this.prisma.orderItem.create({
      data: {
        quantity: data.quantity,
        price: data.price,
        orderId: data.orderId,
        productId: data.productId,
      },
    });

    return new OrderItem(
      orderItem.id,
      orderItem.quantity,
      Number(orderItem.price),
      orderItem.orderId,
      orderItem.productId,
      orderItem.createdAt,
      orderItem.updatedAt
    );
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
          item.createdAt,
          item.updatedAt
        )
    );
  }

  // Order Menu Items
  async createOrderMenuItem(data: {
    orderId: string;
    menuItemId: string;
    amount: number;
    unitPrice: number;
    note: string | null;
  }): Promise<OrderMenuItem> {
    const orderMenuItem = await this.prisma.orderMenuItem.create({
      data: {
        orderId: data.orderId,
        menuItemId: data.menuItemId,
        amount: data.amount,
        unitPrice: data.unitPrice,
        note: data.note,
      },
    });

    return new OrderMenuItem(
      orderMenuItem.id,
      orderMenuItem.orderId,
      orderMenuItem.menuItemId,
      orderMenuItem.amount,
      Number(orderMenuItem.unitPrice),
      orderMenuItem.note,
      orderMenuItem.createdAt,
      orderMenuItem.updatedAt
    );
  }

  async findOrderMenuItemsByOrderId(orderId: string): Promise<OrderMenuItem[]> {
    const orderMenuItems = await this.prisma.orderMenuItem.findMany({
      where: { orderId },
    });

    return orderMenuItems.map(
      (item) =>
        new OrderMenuItem(
          item.id,
          item.orderId,
          item.menuItemId,
          item.amount,
          Number(item.unitPrice),
          item.note,
          item.createdAt,
          item.updatedAt
        )
    );
  }
}

