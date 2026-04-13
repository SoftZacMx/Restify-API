import { z } from 'zod';

// Order Item Extra Schema
export const orderItemExtraSchema = z.object({
  extraId: z.string().uuid('Invalid extra ID format'),
  quantity: z.number().int().positive('Quantity must be positive').default(1),
  price: z.number().positive('Price must be positive').multipleOf(0.01, 'Price must have at most 2 decimal places'),
});

// Order Item Schema (unified for products and menu items)
export const orderItemSchema = z.object({
  productId: z.string().uuid('Invalid product ID format').optional().nullable(),
  menuItemId: z.string().uuid('Invalid menu item ID format').optional().nullable(),
  quantity: z.number().int().positive('Quantity must be positive'),
  price: z.number().positive('Price must be positive').multipleOf(0.01, 'Price must have at most 2 decimal places'),
  note: z.string().max(50, 'Note must be at most 50 characters').optional().nullable(),
  extras: z.array(orderItemExtraSchema).optional().default([]),
}).refine(
  (data) => {
    // Either productId or menuItemId must be provided, but not both
    const hasProductId = !!data.productId;
    const hasMenuItemId = !!data.menuItemId;
    return (hasProductId && !hasMenuItemId) || (!hasProductId && hasMenuItemId);
  },
  {
    message: 'Either productId or menuItemId must be provided, but not both',
  }
);

// Create Order Schema
export const createOrderSchema = z.object({
  paymentMethod: z.number().int().min(1).max(4).default(1), // 1: Cash, 2: Transfer, 3: Card, 4: QR Mercado Pago
  tableId: z.string().uuid('Invalid table ID format').optional().nullable(),
  tip: z.number().nonnegative('Tip must be non-negative').multipleOf(0.01).default(0),
  origin: z.string().min(1, 'Origin is required').max(50, 'Origin is too long'),
  client: z.string().max(200, 'Client name is too long').optional().nullable(),
  paymentDiffer: z.boolean().optional().default(false),
  note: z.string().max(1000, 'Note is too long').optional().nullable(),
  userId: z.string().uuid('Invalid user ID format').optional().nullable(),
  customerName: z.string().max(200, 'Customer name is too long').optional().nullable(),
  customerPhone: z.string().max(13, 'Customer phone must be at most 13 digits').optional().nullable(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  deliveryAddress: z.string().max(500, 'Delivery address is too long').optional().nullable(),
  scheduledAt: z.string().datetime().optional().nullable(),
  orderItems: z.array(orderItemSchema).min(1, 'At least one order item must be provided'),
});

// Update Order Item Schema (for existing items - includes optional id)
export const updateOrderItemSchema = z.object({
  id: z.string().uuid('Invalid order item ID format').optional(), // If provided, update existing; if not, create new
  productId: z.string().uuid('Invalid product ID format').optional().nullable(),
  menuItemId: z.string().uuid('Invalid menu item ID format').optional().nullable(),
  quantity: z.number().int().positive('Quantity must be positive'),
  price: z.number().positive('Price must be positive').multipleOf(0.01, 'Price must have at most 2 decimal places'),
  note: z.string().max(50, 'Note must be at most 50 characters').optional().nullable(),
  extras: z.array(orderItemExtraSchema).optional().default([]),
}).refine(
  (data) => {
    // Either productId or menuItemId must be provided, but not both
    const hasProductId = !!data.productId;
    const hasMenuItemId = !!data.menuItemId;
    return (hasProductId && !hasMenuItemId) || (!hasProductId && hasMenuItemId);
  },
  {
    message: 'Either productId or menuItemId must be provided, but not both',
  }
);

// Update Order Schema
export const updateOrderSchema = z.object({
  status: z.boolean().optional(),
  paymentMethod: z.number().int().min(1).max(4).optional().nullable(), // Can be null for split payments
  delivered: z.boolean().optional(),
  tip: z.number().nonnegative('Tip must be non-negative').multipleOf(0.01).optional(),
  origin: z.string().min(1, 'Origin is required').max(50, 'Origin is too long').optional(),
  client: z.string().max(200, 'Client name is too long').optional().nullable(),
  paymentDiffer: z.boolean().optional(),
  note: z.string().max(1000, 'Note is too long').optional().nullable(),
  tableId: z.string().uuid('Invalid table ID format').optional().nullable(),
  // Order items - if provided, replaces all existing items
  orderItems: z.array(updateOrderItemSchema).min(1, 'At least one order item must be provided').optional(),
});

// Get Order Schema (path parameter)
export const getOrderSchema = z.object({
  order_id: z.string().uuid('Invalid order ID format'),
});

// List Orders Schema (query parameters)
export const listOrdersSchema = z.object({
  status: z.string().transform((val) => {
    if (val === 'true') return true;
    if (val === 'false') return false;
    return undefined;
  }).optional(),
  userId: z.string().uuid('Invalid user ID format').optional(),
  tableId: z.string().uuid('Invalid table ID format').optional(),
  paymentMethod: z.string().transform((val) => {
    const num = parseInt(val, 10);
    return isNaN(num) ? undefined : num;
  }).optional(),
  origin: z.string().optional(),
  dateFrom: z.string().optional(), // ISO date string
  dateTo: z.string().optional(), // ISO date string
  // Pagination: frontend sends page & limit, query uses them for skip/take in DB
  page: z.string().transform((val) => {
    const num = parseInt(val, 10);
    return isNaN(num) || num < 1 ? 1 : num;
  }).optional(),
  limit: z.string().transform((val) => {
    const num = parseInt(val, 10);
    if (isNaN(num) || num < 1) return 20;
    return Math.min(num, 100); // max 100 per page
  }).optional(),
});

// Delete Order Schema (path parameter)
export const deleteOrderSchema = z.object({
  order_id: z.string().uuid('Invalid order ID format'),
});

// Update Delivery Status Schema (body)
export const updateDeliveryStatusSchema = z.object({
  status: z.enum(['PREPARING', 'READY', 'ON_THE_WAY', 'DELIVERED']),
});

// ============================================
// Public Order Schemas
// ============================================

// Public Order Item Extra Schema
const publicOrderItemExtraSchema = z.object({
  extraId: z.string().uuid('Invalid extra ID format'),
  quantity: z.number().int().positive('Quantity must be positive').max(99, 'Max 99 per extra').default(1),
});

// Public Order Item Schema
const publicOrderItemSchema = z.object({
  menuItemId: z.string().uuid('Invalid menu item ID format'),
  quantity: z.number().int().positive('Quantity must be positive').max(99, 'Max 99 per item'),
  note: z.string().max(50, 'Note must be at most 50 characters').optional().nullable(),
  extras: z.array(publicOrderItemExtraSchema).optional(),
});

// Create Public Order Schema
export const createPublicOrderSchema = z.object({
  customerName: z.string().min(1, 'Customer name is required').max(200, 'Customer name is too long'),
  customerPhone: z.string().min(10, 'Phone must be at least 10 digits').max(13, 'Phone must be at most 13 digits'),
  orderType: z.enum(['DELIVERY', 'PICKUP']),
  deliveryAddress: z.string().max(500, 'Delivery address is too long').optional().nullable(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  scheduledAt: z.string().datetime().optional().nullable(),
  items: z.array(publicOrderItemSchema).min(1, 'At least one item is required').max(50, 'Max 50 items per order'),
});

// Pay Public Order Schema (path parameter)
export const payPublicOrderParamsSchema = z.object({
  orderId: z.string().uuid('Invalid order ID format'),
});

// Get Public Order Status Schema (path parameter)
export const getPublicOrderStatusParamsSchema = z.object({
  trackingToken: z.string().uuid('Invalid tracking token format'),
});

// Type exports
export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type UpdateOrderInput = z.infer<typeof updateOrderSchema>;
export type GetOrderInput = z.infer<typeof getOrderSchema>;
export type ListOrdersInput = z.infer<typeof listOrdersSchema>;
export type DeleteOrderInput = z.infer<typeof deleteOrderSchema>;
export type OrderItemInput = z.infer<typeof orderItemSchema>;
export type UpdateOrderItemInput = z.infer<typeof updateOrderItemSchema>;
export type OrderItemExtraInput = z.infer<typeof orderItemExtraSchema>;

