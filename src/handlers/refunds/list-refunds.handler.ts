import middy from '@middy/core';
import httpEventNormalizer from '@middy/http-event-normalizer';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { container } from 'tsyringe';
import { ListRefundsUseCase } from '../../core/application/use-cases/refunds/list-refunds.use-case';
import { listRefundsSchema } from '../../core/application/dto/refund.dto';
import { zodValidator } from '../../shared/middleware/zod-validator.middleware';
import { customErrorHandler } from '../../shared/middleware/error-handler.middleware';
import { responseFormatter } from '../../shared/middleware/response-formatter.middleware';

const listRefundsHandlerBase = async (
  event: APIGatewayProxyEvent
): Promise<any> => {
  const queryParams = event.queryStringParameters || {};
  const validatedData = {
    paymentId: queryParams.paymentId,
    status: queryParams.status as any, // Will be validated by Zod schema
    dateFrom: queryParams.dateFrom,
    dateTo: queryParams.dateTo,
  };

  const listRefundsUseCase = container.resolve(ListRefundsUseCase);
  const result = await listRefundsUseCase.execute(validatedData);

  return result;
};

export const listRefundsHandler = middy(listRefundsHandlerBase)
  .use(httpEventNormalizer())
  .use(zodValidator({ schema: listRefundsSchema, eventKey: 'queryStringParameters' }))
  .use(customErrorHandler())
  .use(responseFormatter());

