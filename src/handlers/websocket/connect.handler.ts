import middy from '@middy/core';
import httpEventNormalizer from '@middy/http-event-normalizer';
import { APIGatewayProxyWebsocketEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { container } from 'tsyringe';
import { RegisterWebSocketConnectionUseCase } from '../../core/application/use-cases/websocket/register-websocket-connection.use-case';
import { customErrorHandler } from '../../shared/middleware/error-handler.middleware';

/**
 * Handler for WebSocket $connect event
 * This is called when a client connects to the WebSocket API
 */
const connectHandlerBase = async (
  event: APIGatewayProxyWebsocketEventV2
): Promise<APIGatewayProxyResult> => {
  const connectionId = event.requestContext.connectionId;
  const domainName = event.requestContext.domainName;
  const stage = event.requestContext.stage;

  // Extract query parameters (V2 type omits them; API Gateway still sends them at runtime)
  const queryParams =
    (event as APIGatewayProxyWebsocketEventV2 & { queryStringParameters?: Record<string, string> }).queryStringParameters || {};
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

