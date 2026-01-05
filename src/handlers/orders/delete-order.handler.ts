import middy from '@middy/core';
import httpEventNormalizer from '@middy/http-event-normalizer';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { container } from 'tsyringe';
import { DeleteOrderUseCase } from '../../core/application/use-cases/orders/delete-order.use-case';
import { deleteOrderSchema } from '../../core/application/dto/order.dto';
import { zodValidator } from '../../shared/middleware/zod-validator.middleware';
import { customErrorHandler } from '../../shared/middleware/error-handler.middleware';
import { responseFormatter } from '../../shared/middleware/response-formatter.middleware';

const deleteOrderHandlerBase = async (
  event: APIGatewayProxyEvent
): Promise<any> => {
  // Path parameters are already validated by middleware
  const order_id = event.pathParameters?.order_id;

  // Execute use case
  const deleteOrderUseCase = container.resolve(DeleteOrderUseCase);
  await deleteOrderUseCase.execute({ order_id: order_id! });

  return { message: 'Order deleted successfully' };
};

export const deleteOrderHandler = middy(deleteOrderHandlerBase)
  .use(httpEventNormalizer())
  .use(zodValidator({ schema: deleteOrderSchema, eventKey: 'pathParameters' }))
  .use(customErrorHandler())
  .use(responseFormatter());


