import middy from '@middy/core';
import httpEventNormalizer from '@middy/http-event-normalizer';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { container } from 'tsyringe';
import { GetRefundUseCase } from '../../core/application/use-cases/refunds/get-refund.use-case';
import { getRefundSchema } from '../../core/application/dto/refund.dto';
import { zodValidator } from '../../shared/middleware/zod-validator.middleware';
import { customErrorHandler } from '../../shared/middleware/error-handler.middleware';
import { responseFormatter } from '../../shared/middleware/response-formatter.middleware';

const getRefundHandlerBase = async (
  event: APIGatewayProxyEvent
): Promise<any> => {
  const validatedData = {
    refund_id: event.pathParameters?.refund_id || '',
  };

  const getRefundUseCase = container.resolve(GetRefundUseCase);
  const result = await getRefundUseCase.execute(validatedData);

  return result;
};

export const getRefundHandler = middy(getRefundHandlerBase)
  .use(httpEventNormalizer())
  .use(zodValidator({ schema: getRefundSchema, eventKey: 'pathParameters' }))
  .use(customErrorHandler())
  .use(responseFormatter());

