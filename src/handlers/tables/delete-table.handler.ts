import middy from '@middy/core';
import httpEventNormalizer from '@middy/http-event-normalizer';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { container } from 'tsyringe';
import { DeleteTableUseCase } from '../../core/application/use-cases/tables/delete-table.use-case';
import { deleteTableSchema } from '../../core/application/dto/table.dto';
import { zodValidator } from '../../shared/middleware/zod-validator.middleware';
import { customErrorHandler } from '../../shared/middleware/error-handler.middleware';
import { responseFormatter } from '../../shared/middleware/response-formatter.middleware';

const deleteTableHandlerBase = async (
  event: APIGatewayProxyEvent
): Promise<any> => {
  // Path parameters are already validated by middleware
  const table_id = event.pathParameters?.table_id;

  // Execute use case
  const deleteTableUseCase = container.resolve(DeleteTableUseCase);
  await deleteTableUseCase.execute({ table_id: table_id! });

  return { message: 'Table deleted successfully' };
};

export const deleteTableHandler = middy(deleteTableHandlerBase)
  .use(httpEventNormalizer())
  .use(zodValidator({ schema: deleteTableSchema, eventKey: 'pathParameters' }))
  .use(customErrorHandler())
  .use(responseFormatter());

