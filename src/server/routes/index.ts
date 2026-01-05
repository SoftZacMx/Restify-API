import { Router } from 'express';
import authRoutes from './auth.routes';
import userRoutes from './user.routes';
import productRoutes from './product.routes';
import tableRoutes from './table.routes';
import menuCategoryRoutes from './menu-category.routes';
import menuItemRoutes from './menu-item.routes';
import orderRoutes from './order.routes';
import paymentRoutes from './payment.routes';
import refundRoutes from './refund.routes';
import expenseRoutes from './expense.routes';
import employeeSalaryRoutes from './employee-salary.routes';
import reportRoutes from './report.routes';
import healthRoutes from './health.routes';

const router = Router();

// Health check route (no prefix)
router.use('/health', healthRoutes);

// API routes
router.use('/api/auth', authRoutes);
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


export default router;

