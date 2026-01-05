import { Order } from '../entities/order.entity';
import { OrderItem } from '../entities/order-item.entity';
import { OrderMenuItem } from '../entities/order-menu-item.entity';

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
  findAll(filters?: OrderFilters): Promise<Order[]>;
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
    userId: string;
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
    productId: string;
  }): Promise<OrderItem>;
  findOrderItemsByOrderId(orderId: string): Promise<OrderItem[]>;
  
  // Order Menu Items
  createOrderMenuItem(data: {
    orderId: string;
    menuItemId: string;
    amount: number;
    unitPrice: number;
    note: string | null;
  }): Promise<OrderMenuItem>;
  findOrderMenuItemsByOrderId(orderId: string): Promise<OrderMenuItem[]>;
}

