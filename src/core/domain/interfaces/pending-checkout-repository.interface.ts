import { PendingCheckoutStatus } from '@prisma/client';

/** Item del carrito tal como se guarda en el snapshot del borrador. */
export interface PendingCheckoutCartItem {
  menuItemId: string;
  quantity: number;
  note?: string | null;
  extras?: { extraId: string; quantity: number }[];
}

export interface PendingCheckout {
  id: string;
  branchId: string;
  status: PendingCheckoutStatus;
  cart: PendingCheckoutCartItem[];
  customerName: string;
  customerPhone: string;
  orderType: 'DELIVERY' | 'PICKUP';
  deliveryAddress: string | null;
  latitude: number | null;
  longitude: number | null;
  scheduledAt: Date | null;
  total: number;
  subtotal: number;
  trackingToken: string;
  mpPreferenceId: string | null;
  paymentId: string | null;
  orderId: string | null;
  expiresAt: Date;
  createdAt: Date;
}

export interface CreatePendingCheckoutData {
  branchId: string;
  cart: PendingCheckoutCartItem[];
  customerName: string;
  customerPhone: string;
  orderType: 'DELIVERY' | 'PICKUP';
  deliveryAddress?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  scheduledAt?: Date | null;
  total: number;
  subtotal: number;
  trackingToken: string;
  expiresAt: Date;
}

export interface UpdatePendingCheckoutData {
  status?: PendingCheckoutStatus;
  mpPreferenceId?: string | null;
  paymentId?: string | null;
  orderId?: string | null;
}

export interface IPendingCheckoutRepository {
  findById(id: string): Promise<PendingCheckout | null>;
  findByTrackingToken(trackingToken: string): Promise<PendingCheckout | null>;
  create(data: CreatePendingCheckoutData): Promise<PendingCheckout>;
  update(id: string, data: UpdatePendingCheckoutData): Promise<PendingCheckout>;
}
