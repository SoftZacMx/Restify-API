import middy from '@middy/core';
import httpJsonBodyParser from '@middy/http-json-body-parser';
import httpEventNormalizer from '@middy/http-event-normalizer';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { container } from 'tsyringe';
import { CreateStripeRefundUseCase } from '../../core/application/use-cases/refunds/create-stripe-refund.use-case';
import { createRefundSchema } from '../../core/application/dto/refund.dto';
import { zodValidator } from '../../shared/middleware/zod-validator.middleware';
import { customErrorHandler } from '../../shared/middleware/error-handler.middleware';
import { responseFormatter } from '../../shared/middleware/response-formatter.middleware';

const createStripeRefundHandlerBase = async (
  event: APIGatewayProxyEvent
): Promise<any> => {
  const validatedData = event.body as any;

  const createStripeRefundUseCase = container.resolve(CreateStripeRefundUseCase);
  const result = await createStripeRefundUseCase.execute(validatedData);

  return result;
};

export const createStripeRefundHandler = middy(createStripeRefundHandlerBase)
  .use(httpEventNormalizer())
  .use(httpJsonBodyParser())
  .use(zodValidator({ schema: createRefundSchema, eventKey: 'body' }))
  .use(customErrorHandler())
  .use(responseFormatter());

