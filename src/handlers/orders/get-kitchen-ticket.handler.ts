import middy from '@middy/core';
import httpEventNormalizer from '@middy/http-event-normalizer';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { container } from 'tsyringe';
import { GetKitchenTicketUseCase } from '../../core/application/use-cases/tickets/get-kitchen-ticket.use-case';
import { getOrderSchema } from '../../core/application/dto/order.dto';
import { zodValidator } from '../../shared/middleware/zod-validator.middleware';
import { customErrorHandler } from '../../shared/middleware/error-handler.middleware';
import { responseFormatter } from '../../shared/middleware/response-formatter.middleware';

const getKitchenTicketHandlerBase = async (
  event: APIGatewayProxyEvent
): Promise<any> => {
  const order_id = event.pathParameters?.order_id;
  const getKitchenTicketUseCase = container.resolve(GetKitchenTicketUseCase);
  const result = await getKitchenTicketUseCase.execute(order_id!);
  return result;
};

export const getKitchenTicketHandler = middy(getKitchenTicketHandlerBase)
  .use(httpEventNormalizer())
  .use(zodValidator({ schema: getOrderSchema, eventKey: 'pathParameters' }))
  .use(customErrorHandler())
  .use(responseFormatter());
