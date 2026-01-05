import middy from '@middy/core';
import httpEventNormalizer from '@middy/http-event-normalizer';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { container } from 'tsyringe';
import { GetPaymentUseCase } from '../../core/application/use-cases/payments/get-payment.use-case';
import { getPaymentSchema } from '../../core/application/dto/payment.dto';
import { zodValidator } from '../../shared/middleware/zod-validator.middleware';
import { customErrorHandler } from '../../shared/middleware/error-handler.middleware';
import { responseFormatter } from '../../shared/middleware/response-formatter.middleware';

const getPaymentHandlerBase = async (
  event: APIGatewayProxyEvent
): Promise<any> => {
  const validatedData = {
    payment_id: event.pathParameters?.payment_id || '',
  };

  const getPaymentUseCase = container.resolve(GetPaymentUseCase);
  const result = await getPaymentUseCase.execute(validatedData);

  return result;
};

export const getPaymentHandler = middy(getPaymentHandlerBase)
  .use(httpEventNormalizer())
  .use(zodValidator({ schema: getPaymentSchema, eventKey: 'pathParameters' }))
  .use(customErrorHandler())
  .use(responseFormatter());

