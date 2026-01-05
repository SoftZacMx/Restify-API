import middy from '@middy/core';
import httpEventNormalizer from '@middy/http-event-normalizer';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { container } from 'tsyringe';
import { ListOrdersUseCase } from '../../core/application/use-cases/orders/list-orders.use-case';
import { listOrdersSchema } from '../../core/application/dto/order.dto';
import { zodValidator } from '../../shared/middleware/zod-validator.middleware';
import { customErrorHandler } from '../../shared/middleware/error-handler.middleware';
import { responseFormatter } from '../../shared/middleware/response-formatter.middleware';

const listOrdersHandlerBase = async (
  event: APIGatewayProxyEvent
): Promise<any> => {
  // Query parameters are already validated by middleware
  const queryParams = event.queryStringParameters || {};

  // Execute use case
  const listOrdersUseCase = container.resolve(ListOrdersUseCase);
  const result = await listOrdersUseCase.execute(queryParams);

  return result;
};

export const listOrdersHandler = middy(listOrdersHandlerBase)
  .use(httpEventNormalizer())
  .use(zodValidator({ schema: listOrdersSchema, eventKey: 'queryStringParameters' }))
  .use(customErrorHandler())
  .use(responseFormatter());


