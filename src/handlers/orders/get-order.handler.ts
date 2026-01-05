import middy from '@middy/core';
import httpEventNormalizer from '@middy/http-event-normalizer';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { container } from 'tsyringe';
import { GetOrderUseCase } from '../../core/application/use-cases/orders/get-order.use-case';
import { getOrderSchema } from '../../core/application/dto/order.dto';
import { zodValidator } from '../../shared/middleware/zod-validator.middleware';
import { customErrorHandler } from '../../shared/middleware/error-handler.middleware';
import { responseFormatter } from '../../shared/middleware/response-formatter.middleware';

const getOrderHandlerBase = async (
  event: APIGatewayProxyEvent
): Promise<any> => {
  // Path parameters are already validated by middleware
  const order_id = event.pathParameters?.order_id;

  // Execute use case
  const getOrderUseCase = container.resolve(GetOrderUseCase);
  const result = await getOrderUseCase.execute({ order_id: order_id! });

  return result;
};

export const getOrderHandler = middy(getOrderHandlerBase)
  .use(httpEventNormalizer())
  .use(zodValidator({ schema: getOrderSchema, eventKey: 'pathParameters' }))
  .use(customErrorHandler())
  .use(responseFormatter());

