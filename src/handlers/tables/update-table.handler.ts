import middy from '@middy/core';
import httpJsonBodyParser from '@middy/http-json-body-parser';
import httpEventNormalizer from '@middy/http-event-normalizer';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { container } from 'tsyringe';
import { UpdateTableUseCase } from '../../core/application/use-cases/tables/update-table.use-case';
import { updateTableSchema, getTableSchema } from '../../core/application/dto/table.dto';
import { zodValidator } from '../../shared/middleware/zod-validator.middleware';
import { customErrorHandler } from '../../shared/middleware/error-handler.middleware';
import { responseFormatter } from '../../shared/middleware/response-formatter.middleware';
import { AppError } from '../../shared/errors';
import { ZodError } from 'zod';

const updateTableHandlerBase = async (
  event: APIGatewayProxyEvent
): Promise<any> => {
  const table_id = event.pathParameters?.table_id;

  if (!table_id) {
    throw new AppError('MISSING_REQUIRED_FIELD', 'Table ID is required');
  }

  // Body is already parsed by middleware
  const bodyData = (event.body as any) || {};

  // Validate body data
  let validatedBody;
  try {
    validatedBody = updateTableSchema.parse(bodyData);
  } catch (error) {
    if (error instanceof ZodError) {
      const errorMessage = error.errors
        .map((e) => `${e.path.join('.')}: ${e.message}`)
        .join(', ');
      throw new AppError('VALIDATION_ERROR', errorMessage);
    }
    throw error;
  }

  // Execute use case
  const updateTableUseCase = container.resolve(UpdateTableUseCase);
  const result = await updateTableUseCase.execute(table_id, validatedBody);

  return result;
};

export const updateTableHandler = middy(updateTableHandlerBase)
  .use(httpEventNormalizer())
  .use(httpJsonBodyParser())
  .use(zodValidator({ schema: getTableSchema, eventKey: 'pathParameters' }))
  .use(customErrorHandler())
  .use(responseFormatter());

