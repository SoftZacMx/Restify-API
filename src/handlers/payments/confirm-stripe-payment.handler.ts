import middy from '@middy/core';
import httpJsonBodyParser from '@middy/http-json-body-parser';
import httpEventNormalizer from '@middy/http-event-normalizer';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { container } from 'tsyringe';
import { ConfirmStripePaymentUseCase } from '../../core/application/use-cases/payments/confirm-stripe-payment.use-case';
import { confirmStripePaymentSchema } from '../../core/application/dto/payment.dto';
import { zodValidator } from '../../shared/middleware/zod-validator.middleware';
import { customErrorHandler } from '../../shared/middleware/error-handler.middleware';
import { responseFormatter } from '../../shared/middleware/response-formatter.middleware';

const confirmStripePaymentHandlerBase = async (
  event: APIGatewayProxyEvent
): Promise<any> => {
  const validatedData = event.body as any;

  const confirmStripePaymentUseCase = container.resolve(ConfirmStripePaymentUseCase);
  const result = await confirmStripePaymentUseCase.execute(validatedData);

  return result;
};

export const confirmStripePaymentHandler = middy(confirmStripePaymentHandlerBase)
  .use(httpEventNormalizer())
  .use(httpJsonBodyParser())
  .use(zodValidator({ schema: confirmStripePaymentSchema, eventKey: 'body' }))
  .use(customErrorHandler())
  .use(responseFormatter());

