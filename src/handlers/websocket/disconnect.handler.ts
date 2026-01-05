import middy from '@middy/core';
import httpEventNormalizer from '@middy/http-event-normalizer';
import { APIGatewayProxyWebsocketEvent, APIGatewayProxyWebsocketResult } from 'aws-lambda';
import { container } from 'tsyringe';
import { UnregisterWebSocketConnectionUseCase } from '../../core/application/use-cases/websocket/unregister-websocket-connection.use-case';
import { customErrorHandler } from '../../shared/middleware/error-handler.middleware';

/**
 * Handler for WebSocket $disconnect event
 * This is called when a client disconnects from the WebSocket API
 */
const disconnectHandlerBase = async (
  event: APIGatewayProxyWebsocketEvent
): Promise<APIGatewayProxyWebsocketResult> => {
  const connectionId = event.requestContext.connectionId;

  console.log(`[WebSocket Disconnect] Connection ID: ${connectionId}`);

  // Unregister connection
  const unregisterUseCase = container.resolve(UnregisterWebSocketConnectionUseCase);
  await unregisterUseCase.execute({ connectionId });

  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Disconnected successfully' }),
  };
};

export const disconnectHandler = middy(disconnectHandlerBase)
  .use(httpEventNormalizer())
  .use(customErrorHandler());

