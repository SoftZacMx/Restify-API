import middy from '@middy/core';
import httpJsonBodyParser from '@middy/http-json-body-parser';
import httpEventNormalizer from '@middy/http-event-normalizer';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { container } from 'tsyringe';
import { ProcessStripeRefundUseCase } from '../../core/application/use-cases/refunds/process-stripe-refund.use-case';
import { processStripeRefundSchema } from '../../core/application/dto/refund.dto';
import { zodValidator } from '../../shared/middleware/zod-validator.middleware';
import { customErrorHandler } from '../../shared/middleware/error-handler.middleware';
import { responseFormatter } from '../../shared/middleware/response-formatter.middleware';

const processStripeRefundHandlerBase = async (
  event: APIGatewayProxyEvent
): Promise<any> => {
  const validatedData = event.body as any;

  const processStripeRefundUseCase = container.resolve(ProcessStripeRefundUseCase);
  const result = await processStripeRefundUseCase.execute(validatedData);

  return result;
};

export const processStripeRefundHandler = middy(processStripeRefundHandlerBase)
  .use(httpEventNormalizer())
  .use(httpJsonBodyParser())
  .use(zodValidator({ schema: processStripeRefundSchema, eventKey: 'body' }))
  .use(customErrorHandler())
  .use(responseFormatter());

