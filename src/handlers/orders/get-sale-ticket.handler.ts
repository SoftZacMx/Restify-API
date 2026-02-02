import middy from '@middy/core';
import httpEventNormalizer from '@middy/http-event-normalizer';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { container } from 'tsyringe';
import { GetSaleTicketUseCase } from '../../core/application/use-cases/tickets/get-sale-ticket.use-case';
import { getOrderSchema } from '../../core/application/dto/order.dto';
import { zodValidator } from '../../shared/middleware/zod-validator.middleware';
import { customErrorHandler } from '../../shared/middleware/error-handler.middleware';
import { responseFormatter } from '../../shared/middleware/response-formatter.middleware';

const getSaleTicketHandlerBase = async (
  event: APIGatewayProxyEvent
): Promise<any> => {
  const order_id = event.pathParameters?.order_id;
  const getSaleTicketUseCase = container.resolve(GetSaleTicketUseCase);
  const result = await getSaleTicketUseCase.execute(order_id!);
  return result;
};

export const getSaleTicketHandler = middy(getSaleTicketHandlerBase)
  .use(httpEventNormalizer())
  .use(zodValidator({ schema: getOrderSchema, eventKey: 'pathParameters' }))
  .use(customErrorHandler())
  .use(responseFormatter());
