import middy from '@middy/core';
import httpEventNormalizer from '@middy/http-event-normalizer';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { container } from 'tsyringe';
import { GetPaymentSessionUseCase } from '../../core/application/use-cases/payments/get-payment-session.use-case';
import { getPaymentSessionSchema } from '../../core/application/dto/payment.dto';
import { zodValidator } from '../../shared/middleware/zod-validator.middleware';
import { customErrorHandler } from '../../shared/middleware/error-handler.middleware';
import { responseFormatter } from '../../shared/middleware/response-formatter.middleware';

const getPaymentSessionHandlerBase = async (
  event: APIGatewayProxyEvent
): Promise<any> => {
  const validatedData = {
    payment_id: event.pathParameters?.payment_id || '',
  };

  const getPaymentSessionUseCase = container.resolve(GetPaymentSessionUseCase);
  const result = await getPaymentSessionUseCase.execute(validatedData);

  return result;
};

export const getPaymentSessionHandler = middy(getPaymentSessionHandlerBase)
  .use(httpEventNormalizer())
  .use(zodValidator({ schema: getPaymentSessionSchema, eventKey: 'pathParameters' }))
  .use(customErrorHandler())
  .use(responseFormatter());

