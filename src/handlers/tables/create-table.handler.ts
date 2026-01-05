import middy from '@middy/core';
import httpJsonBodyParser from '@middy/http-json-body-parser';
import httpEventNormalizer from '@middy/http-event-normalizer';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { container } from 'tsyringe';
import { CreateTableUseCase } from '../../core/application/use-cases/tables/create-table.use-case';
import { createTableSchema } from '../../core/application/dto/table.dto';
import { zodValidator } from '../../shared/middleware/zod-validator.middleware';
import { customErrorHandler } from '../../shared/middleware/error-handler.middleware';
import { responseFormatter } from '../../shared/middleware/response-formatter.middleware';

const createTableHandlerBase = async (
  event: APIGatewayProxyEvent
): Promise<any> => {
  // Body is already parsed and validated by middlewares
  const validatedData = event.body as any;

  // Execute use case
  const createTableUseCase = container.resolve(CreateTableUseCase);
  const result = await createTableUseCase.execute(validatedData);

  return result;
};

export const createTableHandler = middy(createTableHandlerBase)
  .use(httpEventNormalizer())
  .use(httpJsonBodyParser())
  .use(zodValidator({ schema: createTableSchema, eventKey: 'body' }))
  .use(customErrorHandler())
  .use(responseFormatter());

