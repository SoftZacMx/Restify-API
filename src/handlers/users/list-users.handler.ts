import middy from '@middy/core';
import httpEventNormalizer from '@middy/http-event-normalizer';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { container } from 'tsyringe';
import { ListUsersUseCase } from '../../core/application/use-cases/users/list-users.use-case';
import { listUsersSchema } from '../../core/application/dto/user.dto';
import { zodValidator } from '../../shared/middleware/zod-validator.middleware';
import { customErrorHandler } from '../../shared/middleware/error-handler.middleware';
import { responseFormatter } from '../../shared/middleware/response-formatter.middleware';

const listUsersHandlerBase = async (
  event: APIGatewayProxyEvent
): Promise<any> => {
  // Query parameters are already validated by middleware
  const queryParams = event.queryStringParameters || {};

  // Execute use case
  const listUsersUseCase = container.resolve(ListUsersUseCase);
  const result = await listUsersUseCase.execute(queryParams);

  return result;
};

export const listUsersHandler = middy(listUsersHandlerBase)
  .use(httpEventNormalizer())
  .use(zodValidator({ schema: listUsersSchema, eventKey: 'queryStringParameters' }))
  .use(customErrorHandler())
  .use(responseFormatter());

