import middy from '@middy/core';
import httpJsonBodyParser from '@middy/http-json-body-parser';
import httpEventNormalizer from '@middy/http-event-normalizer';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { container } from 'tsyringe';
import { PayOrderWithCardStripeUseCase } from '../../core/application/use-cases/payments/pay-order-with-card-stripe.use-case';
import { payOrderWithCardStripeSchema } from '../../core/application/dto/payment.dto';
import { zodValidator } from '../../shared/middleware/zod-validator.middleware';
import { customErrorHandler } from '../../shared/middleware/error-handler.middleware';
import { responseFormatter } from '../../shared/middleware/response-formatter.middleware';

const payOrderWithCardStripeHandlerBase = async (
  event: APIGatewayProxyEvent
): Promise<any> => {
  const validatedData = event.body as any;

  const payOrderWithCardStripeUseCase = container.resolve(PayOrderWithCardStripeUseCase);
  const result = await payOrderWithCardStripeUseCase.execute(validatedData);

  return result;
};

export const payOrderWithCardStripeHandler = middy(payOrderWithCardStripeHandlerBase)
  .use(httpEventNormalizer())
  .use(httpJsonBodyParser())
  .use(zodValidator({ schema: payOrderWithCardStripeSchema, eventKey: 'body' }))
  .use(customErrorHandler())
  .use(responseFormatter());

