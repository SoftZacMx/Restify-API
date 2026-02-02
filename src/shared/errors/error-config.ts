/**
 * Centralized error configuration
 * All error codes, messages, and status codes are defined here
 */

export const ERROR_CONFIG = {
  // ============================================
  // Authentication & Authorization Errors
  // ============================================
  USER_NOT_FOUND: {
    message: 'User not found',
    statusCode: 404,
    category: 'AUTH',
  },
  USER_NOT_ACTIVE: {
    message: 'User is not active',
    statusCode: 403,
    category: 'AUTH',
  },
  USER_ALREADY_DEACTIVATED: {
    message: 'User is already deactivated',
    statusCode: 400,
    category: 'BUSINESS',
  },
  USER_ALREADY_ACTIVE: {
    message: 'User is already active',
    statusCode: 400,
    category: 'BUSINESS',
  },
  PASSWORD_INCORRECT: {
    message: 'Password is incorrect',
    statusCode: 401,
    category: 'AUTH',
  },
  INVALID_TOKEN: {
    message: 'Invalid or expired token',
    statusCode: 401,
    category: 'AUTH',
  },
  UNAUTHORIZED: {
    message: 'Unauthorized access',
    statusCode: 401,
    category: 'AUTH',
  },
  FORBIDDEN: {
    message: 'Forbidden access',
    statusCode: 403,
    category: 'AUTH',
  },
  TOKEN_EXPIRED: {
    message: 'Token has expired',
    statusCode: 401,
    category: 'AUTH',
  },

  // ============================================
  // Validation Errors
  // ============================================
  VALIDATION_ERROR: {
    message: 'Validation error',
    statusCode: 400,
    category: 'VALIDATION',
  },
  INVALID_EMAIL: {
    message: 'Invalid email format',
    statusCode: 400,
    category: 'VALIDATION',
  },
  INVALID_PASSWORD: {
    message: 'Invalid password format',
    statusCode: 400,
    category: 'VALIDATION',
  },
  MISSING_REQUIRED_FIELD: {
    message: 'Missing required field',
    statusCode: 400,
    category: 'VALIDATION',
  },
  INVALID_INPUT: {
    message: 'Invalid input data',
    statusCode: 400,
    category: 'VALIDATION',
  },

  // ============================================
  // Business Logic Errors
  // ============================================
  ORDER_NOT_FOUND: {
    message: 'Order not found',
    statusCode: 404,
    category: 'BUSINESS',
  },
  PRODUCT_NOT_FOUND: {
    message: 'Product not found',
    statusCode: 404,
    category: 'BUSINESS',
  },
  TABLE_NOT_FOUND: {
    message: 'Table not found',
    statusCode: 404,
    category: 'BUSINESS',
  },
  MENU_CATEGORY_NOT_FOUND: {
    message: 'Menu category not found',
    statusCode: 404,
    category: 'BUSINESS',
  },
  MENU_ITEM_NOT_FOUND: {
    message: 'Menu item not found',
    statusCode: 404,
    category: 'BUSINESS',
  },
  INVALID_MENU_ITEM: {
    message: 'Menu item is an extra and should be in the extras array',
    statusCode: 400,
    category: 'VALIDATION',
  },
  INVALID_EXTRA: {
    message: 'Menu item is not an extra',
    statusCode: 400,
    category: 'VALIDATION',
  },
  INSUFFICIENT_STOCK: {
    message: 'Insufficient stock',
    statusCode: 400,
    category: 'BUSINESS',
  },
  TABLE_NOT_AVAILABLE: {
    message: 'Table is not available',
    statusCode: 400,
    category: 'BUSINESS',
  },
  ORDER_ALREADY_PAID: {
    message: 'Order has already been paid',
    statusCode: 400,
    category: 'BUSINESS',
  },
  PAYMENT_AMOUNT_MISMATCH: {
    message: 'Payment amount must match order total',
    statusCode: 400,
    category: 'BUSINESS',
  },
  PAYMENT_FAILED: {
    message: 'Payment processing failed',
    statusCode: 402,
    category: 'BUSINESS',
  },
  PAYMENT_NOT_FOUND: {
    message: 'Payment not found',
    statusCode: 404,
    category: 'BUSINESS',
  },
  PAYMENT_SESSION_NOT_FOUND: {
    message: 'Payment session not found',
    statusCode: 404,
    category: 'BUSINESS',
  },
  PAYMENT_SESSION_EXPIRED: {
    message: 'Payment session has expired',
    statusCode: 400,
    category: 'BUSINESS',
  },
  PAYMENT_STATUS_MISMATCH: {
    message: 'Payment status mismatch',
    statusCode: 400,
    category: 'BUSINESS',
  },
  SPLIT_PAYMENT_ALREADY_EXISTS: {
    message: 'Split payment already exists for this order',
    statusCode: 400,
    category: 'BUSINESS',
  },
  SPLIT_PAYMENT_INVALID_METHOD: {
    message: 'Invalid payment method for split payment',
    statusCode: 400,
    category: 'BUSINESS',
  },
  SPLIT_PAYMENT_SAME_METHOD: {
    message: 'Split payments must use different payment methods',
    statusCode: 400,
    category: 'BUSINESS',
  },
  SPLIT_PAYMENT_AMOUNT_EXCEEDS_TOTAL: {
    message: 'Split payment amount exceeds order total',
    statusCode: 400,
    category: 'BUSINESS',
  },
  SPLIT_PAYMENT_AMOUNT_MISMATCH: {
    message: 'Split payment amounts do not match order total',
    statusCode: 400,
    category: 'BUSINESS',
  },
  INVALID_AMOUNT: {
    message: 'Invalid payment amount',
    statusCode: 400,
    category: 'VALIDATION',
  },
  REFUND_NOT_FOUND: {
    message: 'Refund not found',
    statusCode: 404,
    category: 'BUSINESS',
  },
  PAYMENT_NOT_REFUNDABLE: {
    message: 'Payment is not refundable',
    statusCode: 400,
    category: 'BUSINESS',
  },
  REFUND_AMOUNT_EXCEEDS_REMAINING: {
    message: 'Refund amount exceeds remaining refundable amount',
    statusCode: 400,
    category: 'BUSINESS',
  },
  REFUND_STATUS_MISMATCH: {
    message: 'Refund status mismatch',
    statusCode: 400,
    category: 'BUSINESS',
  },
  PAYMENT_NOT_STRIPE: {
    message: 'Payment is not processed via Stripe',
    statusCode: 400,
    category: 'BUSINESS',
  },
  STRIPE_REFUND_FAILED: {
    message: 'Failed to create refund in Stripe',
    statusCode: 502,
    category: 'SYSTEM',
  },
  EXPENSE_NOT_FOUND: {
    message: 'Expense not found',
    statusCode: 404,
    category: 'BUSINESS',
  },
  EMPLOYEE_SALARY_PAYMENT_NOT_FOUND: {
    message: 'Employee salary payment not found',
    statusCode: 404,
    category: 'BUSINESS',
  },
  REPORT_TYPE_NOT_FOUND: {
    message: 'Report type not found or not supported',
    statusCode: 400,
    category: 'VALIDATION',
  },
  PURCHASE_MERCHANDISE_NOT_FOUND: {
    message: 'Purchase merchandise not found',
    statusCode: 404,
    category: 'BUSINESS',
  },
  SUBTOTAL_MISMATCH: {
    message: 'Items subtotal does not match purchase subtotal',
    statusCode: 400,
    category: 'VALIDATION',
  },
  IVA_MISMATCH: {
    message: 'Calculated IVA does not match purchase IVA',
    statusCode: 400,
    category: 'VALIDATION',
  },
  TOTAL_MISMATCH: {
    message: 'Items total does not match purchase total',
    statusCode: 400,
    category: 'VALIDATION',
  },

  // ============================================
  // System Errors
  // ============================================
  INTERNAL_ERROR: {
    message: 'Internal server error',
    statusCode: 500,
    category: 'SYSTEM',
  },
  DATABASE_ERROR: {
    message: 'Database error',
    statusCode: 500,
    category: 'SYSTEM',
  },
  EXTERNAL_SERVICE_ERROR: {
    message: 'External service error',
    statusCode: 502,
    category: 'SYSTEM',
  },
  SERVICE_UNAVAILABLE: {
    message: 'Service temporarily unavailable',
    statusCode: 503,
    category: 'SYSTEM',
  },
} as const;

/**
 * Type for error codes - automatically inferred from ERROR_CONFIG keys
 */
export type ErrorCode = keyof typeof ERROR_CONFIG;

/**
 * Error categories for grouping and monitoring
 */
export type ErrorCategory = 'AUTH' | 'VALIDATION' | 'BUSINESS' | 'SYSTEM';

