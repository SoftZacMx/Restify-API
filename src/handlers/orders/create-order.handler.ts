import middy from '@middy/core';
import httpJsonBodyParser from '@middy/http-json-body-parser';
import httpEventNormalizer from '@middy/http-event-normalizer';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { container } from 'tsyringe';
import { CreateOrderUseCase } from '../../core/application/use-cases/orders/create-order.use-case';
import { createOrderSchema } from '../../core/application/dto/order.dto';
import { zodValidator } from '../../shared/middleware/zod-validator.middleware';
import { customErrorHandler } from '../../shared/middleware/error-handler.middleware';
import { responseFormatter } from '../../shared/middleware/response-formatter.middleware';

const createOrderHandlerBase = async (
  event: APIGatewayProxyEvent
): Promise<any> => {
  // Body is already parsed and validated by middlewares
  const validatedData = event.body as any;

  // Execute use case
  const createOrderUseCase = container.resolve(CreateOrderUseCase);
  const result = await createOrderUseCase.execute(validatedData);

  return result;
};

export const createOrderHandler = middy(createOrderHandlerBase)
  .use(httpEventNormalizer())
  .use(httpJsonBodyParser())
  .use(zodValidator({ schema: createOrderSchema, eventKey: 'body' }))
  .use(customErrorHandler())
  .use(responseFormatter());


