import middy from '@middy/core';
import httpEventNormalizer from '@middy/http-event-normalizer';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { container } from 'tsyringe';
import { ListTablesUseCase } from '../../core/application/use-cases/tables/list-tables.use-case';
import { listTablesSchema } from '../../core/application/dto/table.dto';
import { zodValidator } from '../../shared/middleware/zod-validator.middleware';
import { customErrorHandler } from '../../shared/middleware/error-handler.middleware';
import { responseFormatter } from '../../shared/middleware/response-formatter.middleware';

const listTablesHandlerBase = async (
  event: APIGatewayProxyEvent
): Promise<any> => {
  // Query parameters are already validated by middleware
  const queryParams = event.queryStringParameters || {};

  // Execute use case
  const listTablesUseCase = container.resolve(ListTablesUseCase);
  const result = await listTablesUseCase.execute(queryParams);

  return result;
};

export const listTablesHandler = middy(listTablesHandlerBase)
  .use(httpEventNormalizer())
  .use(zodValidator({ schema: listTablesSchema, eventKey: 'queryStringParameters' }))
  .use(customErrorHandler())
  .use(responseFormatter());

