import middy from '@middy/core';
import httpEventNormalizer from '@middy/http-event-normalizer';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { container } from 'tsyringe';
import { GetTableUseCase } from '../../core/application/use-cases/tables/get-table.use-case';
import { getTableSchema } from '../../core/application/dto/table.dto';
import { zodValidator } from '../../shared/middleware/zod-validator.middleware';
import { customErrorHandler } from '../../shared/middleware/error-handler.middleware';
import { responseFormatter } from '../../shared/middleware/response-formatter.middleware';

const getTableHandlerBase = async (
  event: APIGatewayProxyEvent
): Promise<any> => {
  // Path parameters are already validated by middleware
  const table_id = event.pathParameters?.table_id;

  // Execute use case
  const getTableUseCase = container.resolve(GetTableUseCase);
  const result = await getTableUseCase.execute({ table_id: table_id! });

  return result;
};

export const getTableHandler = middy(getTableHandlerBase)
  .use(httpEventNormalizer())
  .use(zodValidator({ schema: getTableSchema, eventKey: 'pathParameters' }))
  .use(customErrorHandler())
  .use(responseFormatter());

