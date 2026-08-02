import { container } from 'tsyringe';
import { WebSocketConnectionManager } from '../../websocket/websocket-connection-manager';
import { IWebSocketConnectionManager } from '../../../domain/interfaces/websocket-connection.interface';
import { WebSocketConnectionRepository } from '../../database/repositories/websocket-connection.repository';
import { IWebSocketConnectionRepository } from '../../../domain/interfaces/websocket-connection-repository.interface';
import { RegisterWebSocketConnectionUseCase } from '../../../application/use-cases/websocket/register-websocket-connection.use-case';
import { UnregisterWebSocketConnectionUseCase } from '../../../application/use-cases/websocket/unregister-websocket-connection.use-case';

container.registerSingleton<IWebSocketConnectionManager>(
  'IWebSocketConnectionManager',
  WebSocketConnectionManager
);

container.registerSingleton<IWebSocketConnectionRepository>(
  'IWebSocketConnectionRepository',
  WebSocketConnectionRepository
);

container.register(RegisterWebSocketConnectionUseCase, RegisterWebSocketConnectionUseCase);
container.register(UnregisterWebSocketConnectionUseCase, UnregisterWebSocketConnectionUseCase);
