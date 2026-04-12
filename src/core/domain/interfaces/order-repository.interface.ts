import { Order } from '../entities/order.entity';
import { OrderItem } from '../entities/order-item.entity';
import { OrderItemExtra } from '../entities/order-item-extra.entity';

export interface OrderFilters {
  status?: boolean;
  userId?: string;
  tableId?: string;
  paymentMethod?: number;
  origin?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

export interface IOrderRepository {
  findById(id: string): Promise<Order | null>;
  findByTrackingToken(trackingToken: string): Promise<Order | null>;
  findAll(filters?: OrderFilters, pagination?: { skip: number; take: number }): Promise<Order[]>;
  count(filters?: OrderFilters): Promise<number>;
  create(data: {
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
    userId: string | null;
    customerName?: string | null;
    customerPhone?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    deliveryAddress?: string | null;
    scheduledAt?: Date | null;
    trackingToken?: string | null;
  }): Promise<Order>;
  update(id: string, data: {
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
  }): Promise<Order>;
  delete(id: string): Promise<void>;
  
  // Order Items
  createOrderItem(data: {
    quantity: number;
    price: number;
    orderId: string;
    productId: string | null;
    menuItemId: string | null;
    note: string | null;
  }): Promise<OrderItem>;
  updateOrderItem(id: string, data: {
    quantity?: number;
    price?: number;
    note?: string | null;
  }): Promise<OrderItem>;
  deleteOrderItem(id: string): Promise<void>;
  deleteOrderItemsByOrderId(orderId: string): Promise<void>;
  findOrderItemsByOrderId(orderId: string): Promise<OrderItem[]>;
  
  // Order Item Extras
  createOrderItemExtra(data: {
    orderId: string;
    orderItemId: string;
    extraId: string;
    quantity: number;
    price: number;
  }): Promise<OrderItemExtra>;
  deleteOrderItemExtrasByOrderId(orderId: string): Promise<void>;
  deleteOrderItemExtrasByOrderItemId(orderItemId: string): Promise<void>;
  findOrderItemExtrasByOrderId(orderId: string): Promise<OrderItemExtra[]>;
  findOrderItemExtrasByOrderItemId(orderItemId: string): Promise<OrderItemExtra[]>;
}

