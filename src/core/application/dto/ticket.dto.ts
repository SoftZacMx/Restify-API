/**
 * Ticket API - GET /api/orders/:order_id/ticket/kitchen-ticket | sale-ticket
 * Estructurado (items) + líneas listas para imprimir (lines).
 */

import type { ResolvedTicketPrintConfig } from './ticket-print-config';

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
  /** Origen de la orden (ej. "local", "takeaway") — para mostrar mesa solo en local */
  origin: string;
  /** Nombre de la mesa (ej. "1", "1A") o null si no aplica */
  tableName: string | null;
  items: KitchenTicketOrderItem[];
  lines: string[];
  /** Config resuelta (empresa + defaults) para render del ticket en cliente */
  printConfig: ResolvedTicketPrintConfig;
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
  /** Origen de la orden (ej. "local", "takeaway") — para mostrar mesa solo en local */
  origin: string;
  tableName: string | null;
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
  printConfig: ResolvedTicketPrintConfig;
}
