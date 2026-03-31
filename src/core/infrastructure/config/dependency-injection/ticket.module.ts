import { container } from 'tsyringe';
import { GetKitchenTicketUseCase } from '../../../application/use-cases/tickets/get-kitchen-ticket.use-case';
import { GetSaleTicketUseCase } from '../../../application/use-cases/tickets/get-sale-ticket.use-case';

container.register(GetKitchenTicketUseCase, GetKitchenTicketUseCase);
container.register(GetSaleTicketUseCase, GetSaleTicketUseCase);
