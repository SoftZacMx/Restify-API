import middy from '@middy/core';
import httpEventNormalizer from '@middy/http-event-normalizer';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { container } from 'tsyringe';
import { ListPaymentsUseCase } from '../../core/application/use-cases/payments/list-payments.use-case';
import { listPaymentsSchema } from '../../core/application/dto/payment.dto';
import { zodValidator } from '../../shared/middleware/zod-validator.middleware';
import { customErrorHandler } from '../../shared/middleware/error-handler.middleware';
import { responseFormatter } from '../../shared/middleware/response-formatter.middleware';

const listPaymentsHandlerBase = async (
  event: APIGatewayProxyEvent
): Promise<any> => {
  const queryParams = event.queryStringParameters || {};
  const validatedData = {
    orderId: queryParams.orderId,
    userId: queryParams.userId,
    status: queryParams.status as any, // Will be validated by Zod schema
    paymentMethod: queryParams.paymentMethod as any, // Will be validated by Zod schema
    dateFrom: queryParams.dateFrom,
    dateTo: queryParams.dateTo,
  };

  const listPaymentsUseCase = container.resolve(ListPaymentsUseCase);
  const result = await listPaymentsUseCase.execute(validatedData);

  return result;
};

export const listPaymentsHandler = middy(listPaymentsHandlerBase)
  .use(httpEventNormalizer())
  .use(zodValidator({ schema: listPaymentsSchema, eventKey: 'queryStringParameters' }))
  .use(customErrorHandler())
  .use(responseFormatter());

