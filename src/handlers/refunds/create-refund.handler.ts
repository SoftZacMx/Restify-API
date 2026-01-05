import middy from '@middy/core';
import httpJsonBodyParser from '@middy/http-json-body-parser';
import httpEventNormalizer from '@middy/http-event-normalizer';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { container } from 'tsyringe';
import { CreateRefundUseCase } from '../../core/application/use-cases/refunds/create-refund.use-case';
import { createRefundSchema } from '../../core/application/dto/refund.dto';
import { zodValidator } from '../../shared/middleware/zod-validator.middleware';
import { customErrorHandler } from '../../shared/middleware/error-handler.middleware';
import { responseFormatter } from '../../shared/middleware/response-formatter.middleware';

const createRefundHandlerBase = async (
  event: APIGatewayProxyEvent
): Promise<any> => {
  const validatedData = event.body as any;

  const createRefundUseCase = container.resolve(CreateRefundUseCase);
  const result = await createRefundUseCase.execute(validatedData);

  return result;
};

export const createRefundHandler = middy(createRefundHandlerBase)
  .use(httpEventNormalizer())
  .use(httpJsonBodyParser())
  .use(zodValidator({ schema: createRefundSchema, eventKey: 'body' }))
  .use(customErrorHandler())
  .use(responseFormatter());

