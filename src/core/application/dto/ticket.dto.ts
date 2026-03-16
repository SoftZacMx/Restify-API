/**
 * Ticket API - GET /api/orders/:order_id/ticket/kitchen-ticket | sale-ticket
 * Estructurado (items) + líneas listas para imprimir (lines).
 */

export interface KitchenTicketExtraItem {
  name: string;
  quantity: number;
}

export interface KitchenTicketOrderItem {
  name: string;
  quantity: number;
  extras: KitchenTicketExtraItem[];
  note?: string | null;
}

export interface KitchenTicketResponse {
  orderId: string;
  tableNumber: number | null;
  items: KitchenTicketOrderItem[];
  lines: string[];
}

export interface SaleTicketExtraItem {
  name: string;
  quantity: number;
  price: number;
}

export interface SaleTicketOrderItem {
  name: string;
  quantity: number;
  price: number;
  lineTotal: number;
  extras: SaleTicketExtraItem[];
  note?: string | null;
}

export interface SaleTicketResponse {
  companyName: string;
  orderId: string;
  date: string;
  tableNumber: number | null;
  client: string | null;
  note: string | null;
  items: SaleTicketOrderItem[];
  subtotal: number;
  iva: number;
  tip: number;
  total: number;
  paymentMethod: string;
  delivered: boolean;
  lines: string[];
}
