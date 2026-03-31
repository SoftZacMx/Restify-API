import { container } from 'tsyringe';
import { WebSocketConnectionManager } from '../../websocket/websocket-connection-manager';
import { IWebSocketConnectionManager } from '../../../domain/interfaces/websocket-connection.interface';
import { WebSocketConnectionRepository } from '../../database/repositories/websocket-connection.repository';
import { IWebSocketConnectionRepository } from '../../../domain/interfaces/websocket-connection-repository.interface';
import { NotifyPaymentStatusUseCase } from '../../../application/use-cases/websocket/notify-payment-status.use-case';
import { QueuePaymentNotificationUseCase } from '../../../application/use-cases/websocket/queue-payment-notification.use-case';
import { NotifyOrderStatusUseCase } from '../../../application/use-cases/websocket/notify-order-status.use-case';
import { QueueOrderNotificationUseCase } from '../../../application/use-cases/websocket/queue-order-notification.use-case';
import { RegisterWebSocketConnectionUseCase } from '../../../application/use-cases/websocket/register-websocket-connection.use-case';
import { UnregisterWebSocketConnectionUseCase } from '../../../application/use-cases/websocket/unregister-websocket-connection.use-case';
import { SQSService } from '../../queue/sqs.service';
import { PaymentNotificationWorker } from '../../../application/workers/payment-notification.worker';
import { OrderNotificationWorker } from '../../../application/workers/order-notification.worker';

container.registerSingleton<IWebSocketConnectionManager>(
  'IWebSocketConnectionManager',
  WebSocketConnectionManager
);

container.registerSingleton<IWebSocketConnectionRepository>(
  'IWebSocketConnectionRepository',
  WebSocketConnectionRepository
);

container.registerSingleton(SQSService);

container.register(NotifyPaymentStatusUseCase, NotifyPaymentStatusUseCase);
container.register(QueuePaymentNotificationUseCase, QueuePaymentNotificationUseCase);
container.register(NotifyOrderStatusUseCase, NotifyOrderStatusUseCase);
container.register(QueueOrderNotificationUseCase, QueueOrderNotificationUseCase);
container.register(RegisterWebSocketConnectionUseCase, RegisterWebSocketConnectionUseCase);
container.register(UnregisterWebSocketConnectionUseCase, UnregisterWebSocketConnectionUseCase);

container.registerSingleton(PaymentNotificationWorker);
container.registerSingleton(OrderNotificationWorker);
