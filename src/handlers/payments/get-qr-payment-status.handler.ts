import middy from '@middy/core';
import httpEventNormalizer from '@middy/http-event-normalizer';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { container } from 'tsyringe';
import { GetQRPaymentStatusUseCase } from '../../core/application/use-cases/payments/get-qr-payment-status.use-case';
import { getQRPaymentStatusSchema } from '../../core/application/dto/payment.dto';
import { zodValidator } from '../../shared/middleware/zod-validator.middleware';
import { customErrorHandler } from '../../shared/middleware/error-handler.middleware';
import { responseFormatter } from '../../shared/middleware/response-formatter.middleware';

const getQRPaymentStatusHandlerBase = async (
  event: APIGatewayProxyEvent
): Promise<any> => {
  const validatedData = {
    orderId: event.pathParameters?.orderId || '',
  };

  const useCase = container.resolve(GetQRPaymentStatusUseCase);
  const result = await useCase.execute(validatedData);

  return result;
};

export const getQRPaymentStatusHandler = middy(getQRPaymentStatusHandlerBase)
  .use(httpEventNormalizer())
  .use(zodValidator({ schema: getQRPaymentStatusSchema, eventKey: 'pathParameters' }))
  .use(customErrorHandler())
  .use(responseFormatter());
