import 'reflect-metadata';

// Prisma must be first — other modules depend on prismaClient
import './prisma.module';

// Domain modules
import './user.module';
import './product.module';
import './table.module';
import './company.module';
import './menu.module';
import './order.module';
import './payment.module';
import './subscription.module';
import './refund.module';
import './expense.module';
import './report.module';
import './ticket.module';
import './websocket.module';

export { container } from 'tsyringe';
