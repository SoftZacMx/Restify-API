import { Router } from 'express';
import authRoutes from './auth.routes';
import configRoutes from './config.routes';
import userRoutes from './user.routes';
import productRoutes from './product.routes';
import tableRoutes from './table.routes';
import menuCategoryRoutes from './menu-category.routes';
import menuItemRoutes from './menu-item.routes';
import orderRoutes from './order.routes';
import paymentRoutes, { paymentWebhookRoutes } from './payment.routes';
import refundRoutes from './refund.routes';
import expenseRoutes from './expense.routes';
import employeeSalaryRoutes from './employee-salary.routes';
import reportRoutes from './report.routes';
import stockRoutes from './stock.routes';
import dashboardRoutes from './dashboard.routes';
import branchRoutes from './branch.routes';
import healthRoutes from './health.routes';
import subscriptionRoutes from './subscription.routes';
import settingsRoutes from './settings.routes';
import publicRoutes from './public.routes';
import { SubscriptionMiddleware } from '../middleware/subscription.middleware';
import { AuthMiddleware } from '../middleware/auth.middleware';
import { TenantMiddleware } from '../middleware/tenant.middleware';

const router = Router();

// Health check route (no auth, no tenant)
router.use('/health', healthRoutes);

// Config route (public - no auth, no tenant)
router.use('/api/config', configRoutes);

// Auth routes (no tenant context - users don't have org yet during login)
router.use('/api/auth', authRoutes);

// Subscription routes (no tenant - handled by Stripe webhooks)
router.use('/api/subscription', subscriptionRoutes);

// Webhook de Mercado Pago (no auth, no tenant - MP envía directamente)
router.use('/api/payments/webhooks', paymentWebhookRoutes);

// Rutas públicas: sin auth, CON validación de suscripción
router.use('/api/public', SubscriptionMiddleware.validateSubscription, publicRoutes);

// ===================================================
// TENANT CONTEXT (Phase 1.2)
// All routes below require authentication + tenant context
// ===================================================
router.use(AuthMiddleware.authenticate);
router.use(TenantMiddleware.attach);
router.use(SubscriptionMiddleware.validateSubscription);

// Rutas CON validación de suscripción y tenant context
router.use('/api/branches', branchRoutes);
router.use('/api/users', userRoutes);
router.use('/api/products', productRoutes);
router.use('/api/tables', tableRoutes);
router.use('/api/menu-categories', menuCategoryRoutes);
router.use('/api/menu-items', menuItemRoutes);
router.use('/api/orders', orderRoutes);
router.use('/api/payments', paymentRoutes);
router.use('/api/refunds', refundRoutes);
router.use('/api/expenses', expenseRoutes);
router.use('/api/employee-salaries', employeeSalaryRoutes);
router.use('/api/reports', reportRoutes);
router.use('/api/stock', stockRoutes);
router.use('/api/dashboard', dashboardRoutes);
router.use('/api/settings', settingsRoutes);

export default router;

