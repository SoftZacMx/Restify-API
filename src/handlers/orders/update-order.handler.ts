import middy from '@middy/core';
import httpJsonBodyParser from '@middy/http-json-body-parser';
import httpEventNormalizer from '@middy/http-event-normalizer';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { container } from 'tsyringe';
import { UpdateOrderUseCase } from '../../core/application/use-cases/orders/update-order.use-case';
import { updateOrderSchema, getOrderSchema } from '../../core/application/dto/order.dto';
import { zodValidator } from '../../shared/middleware/zod-validator.middleware';
import { customErrorHandler } from '../../shared/middleware/error-handler.middleware';
import { responseFormatter } from '../../shared/middleware/response-formatter.middleware';
import { AppError } from '../../shared/errors';
import { ZodError } from 'zod';

const updateOrderHandlerBase = async (
  event: APIGatewayProxyEvent
): Promise<any> => {
  const order_id = event.pathParameters?.order_id;

  if (!order_id) {
    throw new AppError('MISSING_REQUIRED_FIELD', 'Order ID is required');
  }

  // Body is already parsed by middleware
  const bodyData = (event.body as any) || {};

  // Validate body data
  let validatedBody;
  try {
    validatedBody = updateOrderSchema.parse(bodyData);
  } catch (error) {
    if (error instanceof ZodError) {
      const errorMessage = error.errors
        .map((e) => `${e.path.join('.')}: ${e.message}`)
        .join(', ');
      throw new AppError('VALIDATION_ERROR', errorMessage);
    }
    throw error;
  }

  // Execute use case
  const updateOrderUseCase = container.resolve(UpdateOrderUseCase);
  const result = await updateOrderUseCase.execute(order_id, validatedBody);

  return result;
};

export const updateOrderHandler = middy(updateOrderHandlerBase)
  .use(httpEventNormalizer())
  .use(httpJsonBodyParser())
  .use(zodValidator({ schema: getOrderSchema, eventKey: 'pathParameters' }))
  .use(customErrorHandler())
  .use(responseFormatter());


