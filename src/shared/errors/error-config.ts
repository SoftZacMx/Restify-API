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
  ACCOUNT_DISABLED: {
    message: 'Account is disabled',
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
  USER_DISABLED: {
    message: 'User account is disabled',
    statusCode: 403,
    category: 'AUTH',
  },
  INVALID_CREDENTIALS: {
    message: 'Invalid email or password',
    statusCode: 401,
    category: 'AUTH',
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
  TOKEN_REVOKED: {
    message: 'Token has been revoked',
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
  EMAIL_ALREADY_EXISTS: {
    message: 'An account with this email already exists',
    statusCode: 409,
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
  COMPANY_NOT_FOUND: {
    message: 'Company information not found',
    statusCode: 404,
    category: 'BUSINESS',
  },
  OUTSIDE_OPERATING_HOURS: {
    message: 'No se pueden crear órdenes fuera del horario de operación',
    statusCode: 400,
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
  ORDER_ITEM_NOT_FOUND: {
    message: 'Order item not found',
    statusCode: 404,
    category: 'BUSINESS',
  },
  STOCK_REASON_REQUIRED: {
    message: 'Reason is required for this stock operation',
    statusCode: 400,
    category: 'VALIDATION',
  },
  STOCK_INVALID_QUANTITY: {
    message: 'Quantity must be positive',
    statusCode: 400,
    category: 'VALIDATION',
  },
  MENU_ITEM_NOT_AVAILABLE: {
    message: 'Menu item is not available',
    statusCode: 400,
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
  ORDER_ALREADY_DELIVERED: {
    message: 'Order has already been delivered',
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
  PENDING_MP_PAYMENT_EXISTS: {
    message: 'A pending Mercado Pago payment already exists for this order',
    statusCode: 400,
    category: 'BUSINESS',
  },
  INVALID_WEBHOOK_SIGNATURE: {
    message: 'Invalid webhook signature',
    statusCode: 401,
    category: 'AUTH',
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
  INGREDIENT_NOT_FOUND: {
    message: 'Ingredient is not part of the recipe',
    statusCode: 404,
    category: 'BUSINESS',
  },
  INGREDIENT_ALREADY_EXISTS: {
    message: 'Ingredient is already part of the recipe',
    statusCode: 409,
    category: 'BUSINESS',
  },
  DUPLICATE_INGREDIENT: {
    message: 'A product appears more than once in the recipe',
    statusCode: 400,
    category: 'VALIDATION',
  },
  RECIPE_NOT_ALLOWED_ON_DIRECT_ITEM: {
    message: 'MenuItem is configured as direct (linked product). Cannot have a recipe.',
    statusCode: 400,
    category: 'BUSINESS',
  },
  INCOMPATIBLE_UNIT: {
    message: 'La unidad del ingrediente no es compatible con la del producto',
    statusCode: 400,
    category: 'VALIDATION',
  },

  // ============================================
  // Subscription Errors
  // ============================================
  SUBSCRIPTION_ALREADY_ACTIVE: {
    message: 'Ya existe una suscripción activa',
    statusCode: 400,
    category: 'BUSINESS',
  },
  SUBSCRIPTION_NOT_FOUND: {
    message: 'No se encontró una suscripción',
    statusCode: 404,
    category: 'BUSINESS',
  },
  SUBSCRIPTION_NOT_ACTIVE: {
    message: 'La suscripción no está activa',
    statusCode: 400,
    category: 'BUSINESS',
  },
  SUBSCRIPTION_NOT_CANCELABLE: {
    message: 'La suscripción no se puede cancelar en su estado actual',
    statusCode: 400,
    category: 'BUSINESS',
  },
  SUBSCRIPTION_NOT_REACTIVATABLE: {
    message: 'La suscripción no se puede reactivar',
    statusCode: 400,
    category: 'BUSINESS',
  },
  STRIPE_SUBSCRIPTION_ERROR: {
    message: 'Error al procesar la suscripción en Stripe',
    statusCode: 502,
    category: 'SYSTEM',
  },
  SUBSCRIPTION_PLAN_NOT_FOUND: {
    message: 'El plan de suscripción no existe o no está activo',
    statusCode: 404,
    category: 'BUSINESS',
  },
  PAYMENT_CONFIG_NOT_CONFIGURED: {
    message: 'La configuración de pagos no está completa',
    statusCode: 500,
    category: 'SYSTEM',
  },
  SUBSCRIPTION_PRICE_NOT_CONFIGURED: {
    message: 'El precio de suscripción no está configurado',
    statusCode: 500,
    category: 'SYSTEM',
  },

  // ============================================
  // Multi-tenancy / Branches
  // ============================================
  ORGANIZATION_NOT_FOUND: {
    message: 'Organization not found',
    statusCode: 404,
    category: 'BUSINESS',
  },
  ORGANIZATION_INACTIVE: {
    message: 'Organization is not active',
    statusCode: 403,
    category: 'BUSINESS',
  },
  BRANCH_DISABLED: {
    message: 'Branch is disabled',
    statusCode: 404,
    category: 'BUSINESS',
  },
  BRANCH_FORBIDDEN: {
    message: 'Branch access is forbidden',
    statusCode: 400,
    category: 'BUSINESS',
  },
  BRANCH_NOT_FOUND: {
    message: 'Branch not found',
    statusCode: 404,
    category: 'BUSINESS',
  },
  BRANCH_LIMIT_REACHED: {
    message: 'Branch limit reached for your plan',
    statusCode: 409,
    category: 'BUSINESS',
  },
  BRANCH_ALREADY_DISABLED: {
    message: 'Branch is already disabled',
    statusCode: 400,
    category: 'BUSINESS',
  },
  BRANCH_ALREADY_ACTIVE: {
    message: 'Branch is already active',
    statusCode: 400,
    category: 'BUSINESS',
  },
  ORGANIZATION_NAME_MISMATCH: {
    message: 'Confirmation name does not match the organization name',
    statusCode: 400,
    category: 'BUSINESS',
  },
  ORGANIZATION_ALREADY_CLOSED: {
    message: 'Organization is already closed',
    statusCode: 409,
    category: 'BUSINESS',
  },
  ORGANIZATION_NOT_CLOSED: {
    message: 'Organization is not closed',
    statusCode: 409,
    category: 'BUSINESS',
  },
  ORGANIZATION_REACTIVATION_EXPIRED: {
    message: 'The reactivation window has expired',
    statusCode: 410,
    category: 'BUSINESS',
  },
  ORGANIZATION_ALREADY_ACTIVE: {
    message: 'Organization is already active',
    statusCode: 409,
    category: 'BUSINESS',
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

  // ============================================
  // Image Upload Errors (Storage / S3)
  // ============================================
  INVALID_IMAGE_TYPE: {
    message: 'Image type not allowed (jpeg, png, webp)',
    statusCode: 400,
    category: 'VALIDATION',
  },
  IMAGE_SIZE_EXCEEDS_LIMIT: {
    message: 'Image exceeds the 5MB size limit',
    statusCode: 413,
    category: 'VALIDATION',
  },
  IMAGE_UPLOAD_FAILED: {
    message: 'Failed to upload image',
    statusCode: 500,
    category: 'SYSTEM',
  },
  IMAGE_BRANCH_CONTEXT_REQUIRED: {
    message: 'A branch context is required to upload this image kind',
    statusCode: 400,
    category: 'VALIDATION',
  },
  IMAGE_FILE_REQUIRED: {
    message: 'Image file is required (field "file")',
    statusCode: 400,
    category: 'VALIDATION',
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
