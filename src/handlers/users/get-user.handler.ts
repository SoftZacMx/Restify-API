import middy from '@middy/core';
import httpEventNormalizer from '@middy/http-event-normalizer';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { container } from 'tsyringe';
import { GetUserUseCase } from '../../core/application/use-cases/users/get-user.use-case';
import { getUserSchema } from '../../core/application/dto/user.dto';
import { zodValidator } from '../../shared/middleware/zod-validator.middleware';
import { customErrorHandler } from '../../shared/middleware/error-handler.middleware';
import { responseFormatter } from '../../shared/middleware/response-formatter.middleware';

const getUserHandlerBase = async (
  event: APIGatewayProxyEvent
): Promise<any> => {
  // Path parameters are already validated by middleware
  const user_id = event.pathParameters?.user_id;

  // Execute use case
  const getUserUseCase = container.resolve(GetUserUseCase);
  const result = await getUserUseCase.execute({ user_id: user_id! });

  return result;
};

export const getUserHandler = middy(getUserHandlerBase)
  .use(httpEventNormalizer())
  .use(zodValidator({ schema: getUserSchema, eventKey: 'pathParameters' }))
  .use(customErrorHandler())
  .use(responseFormatter());

