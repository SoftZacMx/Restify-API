import { z } from 'zod';

// Order Item Schema (for creating orders with products)
export const orderItemSchema = z.object({
  productId: z.string().uuid('Invalid product ID format'),
  quantity: z.number().int().positive('Quantity must be positive'),
  price: z.number().positive('Price must be positive').multipleOf(0.01, 'Price must have at most 2 decimal places'),
});

// Order Menu Item Schema (for creating orders with menu items)
export const orderMenuItemSchema = z.object({
  menuItemId: z.string().uuid('Invalid menu item ID format'),
  amount: z.number().int().positive('Amount must be positive'),
  unitPrice: z.number().positive('Unit price must be positive').multipleOf(0.01, 'Unit price must have at most 2 decimal places'),
  note: z.string().max(500, 'Note is too long').optional().nullable(),
});

// Create Order Schema
export const createOrderSchema = z.object({
  paymentMethod: z.number().int().min(1).max(3).default(1), // 1: Cash, 2: Transfer, 3: Card
  tableId: z.string().uuid('Invalid table ID format').optional().nullable(),
  tip: z.number().nonnegative('Tip must be non-negative').multipleOf(0.01).default(0),
  origin: z.string().min(1, 'Origin is required').max(50, 'Origin is too long'),
  client: z.string().max(200, 'Client name is too long').optional().nullable(),
  paymentDiffer: z.boolean().optional().default(false),
  note: z.string().max(1000, 'Note is too long').optional().nullable(),
  userId: z.string().uuid('Invalid user ID format'),
  orderItems: z.array(orderItemSchema).optional().default([]),
  orderMenuItems: z.array(orderMenuItemSchema).optional().default([]),
}).refine(
  (data) => {
    // At least one item (product or menu item) must be provided
    const hasOrderItems = data.orderItems && data.orderItems.length > 0;
    const hasOrderMenuItems = data.orderMenuItems && data.orderMenuItems.length > 0;
    return hasOrderItems || hasOrderMenuItems;
  },
  {
    message: 'At least one order item or menu item must be provided',
  }
);

// Update Order Schema
export const updateOrderSchema = z.object({
  status: z.boolean().optional(),
  paymentMethod: z.number().int().min(1).max(3).optional().nullable(), // Can be null for split payments
  delivered: z.boolean().optional(),
  tip: z.number().nonnegative('Tip must be non-negative').multipleOf(0.01).optional(),
  origin: z.string().min(1, 'Origin is required').max(50, 'Origin is too long').optional(),
  client: z.string().max(200, 'Client name is too long').optional().nullable(),
  paymentDiffer: z.boolean().optional(),
  note: z.string().max(1000, 'Note is too long').optional().nullable(),
  tableId: z.string().uuid('Invalid table ID format').optional().nullable(),
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
});

// Delete Order Schema (path parameter)
export const deleteOrderSchema = z.object({
  order_id: z.string().uuid('Invalid order ID format'),
});

// Type exports
export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type UpdateOrderInput = z.infer<typeof updateOrderSchema>;
export type GetOrderInput = z.infer<typeof getOrderSchema>;
export type ListOrdersInput = z.infer<typeof listOrdersSchema>;
export type DeleteOrderInput = z.infer<typeof deleteOrderSchema>;
export type OrderItemInput = z.infer<typeof orderItemSchema>;
export type OrderMenuItemInput = z.infer<typeof orderMenuItemSchema>;

