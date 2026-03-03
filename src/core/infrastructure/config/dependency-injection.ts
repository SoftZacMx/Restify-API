import 'reflect-metadata';
import { container } from 'tsyringe';
import { PrismaService } from './prisma.config';
import { UserRepository } from '../database/repositories/user.repository';
import { IUserRepository } from '../../domain/interfaces/user-repository.interface';
import { ProductRepository } from '../database/repositories/product.repository';
import { IProductRepository } from '../../domain/interfaces/product-repository.interface';
import { TableRepository } from '../database/repositories/table.repository';
import { ITableRepository } from '../../domain/interfaces/table-repository.interface';
import { CompanyRepository } from '../database/repositories/company.repository';
import { ICompanyRepository } from '../../domain/interfaces/company-repository.interface';
import { MenuCategoryRepository } from '../database/repositories/menu-category.repository';
import { IMenuCategoryRepository } from '../../domain/interfaces/menu-category-repository.interface';
import { MenuItemRepository } from '../database/repositories/menu-item.repository';
import { IMenuItemRepository } from '../../domain/interfaces/menu-item-repository.interface';
import { OrderRepository } from '../database/repositories/order.repository';
import { IOrderRepository } from '../../domain/interfaces/order-repository.interface';
import { PaymentRepository } from '../database/repositories/payment.repository';
import { IPaymentRepository } from '../../domain/interfaces/payment-repository.interface';
import { PaymentSessionRepository } from '../database/repositories/payment-session.repository';
import { IPaymentSessionRepository } from '../../domain/interfaces/payment-session-repository.interface';
import { PaymentDifferentiationRepository } from '../database/repositories/payment-differentiation.repository';
import { IPaymentDifferentiationRepository } from '../../domain/interfaces/payment-differentiation-repository.interface';
import { RefundRepository } from '../database/repositories/refund.repository';
import { IRefundRepository } from '../../domain/interfaces/refund-repository.interface';
import { ExpenseRepository } from '../database/repositories/expense.repository';
import { IExpenseRepository } from '../../domain/interfaces/expense-repository.interface';
import { EmployeeSalaryPaymentRepository } from '../database/repositories/employee-salary-payment.repository';
import { IEmployeeSalaryPaymentRepository } from '../../domain/interfaces/employee-salary-payment-repository.interface';
import { ReportFactory } from '../../application/reports/report-factory';
import { StripeService } from '../payment-gateways/stripe.service';
import { WebSocketConnectionManager } from '../websocket/websocket-connection-manager';
import { IWebSocketConnectionManager } from '../../domain/interfaces/websocket-connection.interface';
import { NotifyPaymentStatusUseCase } from '../../application/use-cases/websocket/notify-payment-status.use-case';
import { QueuePaymentNotificationUseCase } from '../../application/use-cases/websocket/queue-payment-notification.use-case';
import { NotifyOrderStatusUseCase } from '../../application/use-cases/websocket/notify-order-status.use-case';
import { QueueOrderNotificationUseCase } from '../../application/use-cases/websocket/queue-order-notification.use-case';
import { SQSService } from '../queue/sqs.service';
import { PaymentNotificationWorker } from '../../application/workers/payment-notification.worker';
import { OrderNotificationWorker } from '../../application/workers/order-notification.worker';
import { WebSocketConnectionRepository } from '../database/repositories/websocket-connection.repository';
import { IWebSocketConnectionRepository } from '../../domain/interfaces/websocket-connection-repository.interface';
import { RegisterWebSocketConnectionUseCase } from '../../application/use-cases/websocket/register-websocket-connection.use-case';
import { UnregisterWebSocketConnectionUseCase } from '../../application/use-cases/websocket/unregister-websocket-connection.use-case';
import { PayOrderUseCase } from '../../application/use-cases/orders/pay-order.use-case';
import { GetDashboardUseCase } from '../../application/use-cases/dashboard/get-dashboard.use-case';
import { GetKitchenTicketUseCase } from '../../application/use-cases/tickets/get-kitchen-ticket.use-case';
import { GetSaleTicketUseCase } from '../../application/use-cases/tickets/get-sale-ticket.use-case';
import { GetCompanyUseCase } from '../../application/use-cases/company/get-company.use-case';
import { UpsertCompanyUseCase } from '../../application/use-cases/company/upsert-company.use-case';

// Register Prisma Service
container.registerSingleton(PrismaService);

// Get Prisma Client
const prismaService = container.resolve(PrismaService);
const prismaClient = prismaService.getClient();

// Register Repositories
container.register<IUserRepository>('IUserRepository', {
  useFactory: () => new UserRepository(prismaClient),
});

container.register<IProductRepository>('IProductRepository', {
  useFactory: () => new ProductRepository(prismaClient),
});

container.register<ITableRepository>('ITableRepository', {
  useFactory: () => new TableRepository(prismaClient),
});

container.register<ICompanyRepository>('ICompanyRepository', {
  useFactory: () => new CompanyRepository(prismaClient),
});

container.register<IMenuCategoryRepository>('IMenuCategoryRepository', {
  useFactory: () => new MenuCategoryRepository(prismaClient),
});

container.register<IMenuItemRepository>('IMenuItemRepository', {
  useFactory: () => new MenuItemRepository(prismaClient),
});

container.register<IOrderRepository>('IOrderRepository', {
  useFactory: () => new OrderRepository(prismaClient),
});

// Register Payment Repositories
container.register<IPaymentRepository>('IPaymentRepository', {
  useFactory: () => new PaymentRepository(prismaClient),
});

container.register<IPaymentSessionRepository>('IPaymentSessionRepository', {
  useFactory: () => new PaymentSessionRepository(prismaClient),
});

container.register<IPaymentDifferentiationRepository>('IPaymentDifferentiationRepository', {
  useFactory: () => new PaymentDifferentiationRepository(prismaClient),
});

// Register Refund Repository
container.register<IRefundRepository>('IRefundRepository', {
  useFactory: () => new RefundRepository(prismaClient),
});

// Register Expense Repository
container.register<IExpenseRepository>('IExpenseRepository', {
  useFactory: () => new ExpenseRepository(prismaClient),
});

// Register Employee Salary Payment Repository
container.register<IEmployeeSalaryPaymentRepository>('IEmployeeSalaryPaymentRepository', {
  useFactory: () => new EmployeeSalaryPaymentRepository(prismaClient),
});

// Register Report Factory
container.registerSingleton('ReportFactory', ReportFactory);

// Register Payment Services
container.registerSingleton(StripeService);

// Register WebSocket Services
container.registerSingleton<IWebSocketConnectionManager>(
  'IWebSocketConnectionManager',
  WebSocketConnectionManager
);

// Register SQS Service
container.registerSingleton(SQSService);

// Register WebSocket Use Cases
container.register(NotifyPaymentStatusUseCase, NotifyPaymentStatusUseCase);
container.register(QueuePaymentNotificationUseCase, QueuePaymentNotificationUseCase);
container.register(NotifyOrderStatusUseCase, NotifyOrderStatusUseCase);
container.register(QueueOrderNotificationUseCase, QueueOrderNotificationUseCase);

// Register Notification Workers
container.registerSingleton(PaymentNotificationWorker);
container.registerSingleton(OrderNotificationWorker);

// Register WebSocket Connection Repository (DynamoDB)
container.registerSingleton<IWebSocketConnectionRepository>(
  'IWebSocketConnectionRepository',
  WebSocketConnectionRepository
);

// Register WebSocket Connection Use Cases
container.register(RegisterWebSocketConnectionUseCase, RegisterWebSocketConnectionUseCase);
container.register(UnregisterWebSocketConnectionUseCase, UnregisterWebSocketConnectionUseCase);

// Pay order (unified endpoint, transaction)
container.register(PayOrderUseCase, PayOrderUseCase);

// Dashboard
container.register(GetDashboardUseCase, GetDashboardUseCase);

// Tickets (kitchen-ticket, sale-ticket)
container.register(GetKitchenTicketUseCase, GetKitchenTicketUseCase);
container.register(GetSaleTicketUseCase, GetSaleTicketUseCase);

// Company (singleton business info)
container.register(GetCompanyUseCase, GetCompanyUseCase);
container.register(UpsertCompanyUseCase, UpsertCompanyUseCase);

export { container };

