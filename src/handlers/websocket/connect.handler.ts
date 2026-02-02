import middy from '@middy/core';
import httpEventNormalizer from '@middy/http-event-normalizer';
import { APIGatewayProxyWebsocketEvent, APIGatewayProxyWebsocketResult } from 'aws-lambda';
import { container } from 'tsyringe';
import { RegisterWebSocketConnectionUseCase } from '../../core/application/use-cases/websocket/register-websocket-connection.use-case';
import { customErrorHandler } from '../../shared/middleware/error-handler.middleware';

/**
 * Handler for WebSocket $connect event
 * This is called when a client connects to the WebSocket API
 */
const connectHandlerBase = async (
  event: APIGatewayProxyWebsocketEvent
): Promise<APIGatewayProxyWebsocketResult> => {
  const connectionId = event.requestContext.connectionId;
  const domainName = event.requestContext.domainName;
  const stage = event.requestContext.stage;

  // Extract query parameters (customConnectionId, paymentId, userId)
  const queryParams = event.queryStringParameters || {};
  const customConnectionId = queryParams.connectionId; // Custom connection ID from PaymentSession
  const paymentId = queryParams.paymentId;
  const userId = queryParams.userId;

  // Register connection
  const registerUseCase = container.resolve(RegisterWebSocketConnectionUseCase);
  const result = await registerUseCase.execute({
    connectionId,
    domainName,
    stage,
    customConnectionId,
    paymentId,
    userId,
  });

  if (!result.success) {
    console.error(`[WebSocket Connect] Failed to register: ${result.message}`);
    return {
      statusCode: 401,
      body: JSON.stringify({ message: result.message || 'Connection rejected' }),
    };
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Connected successfully' }),
  };
};

export const connectHandler = middy(connectHandlerBase)
  .use(httpEventNormalizer())
  .use(customErrorHandler());

