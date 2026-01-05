import middy from '@middy/core';
import httpEventNormalizer from '@middy/http-event-normalizer';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { container } from 'tsyringe';
import { DeleteUserUseCase } from '../../core/application/use-cases/users/delete-user.use-case';
import { deleteUserSchema } from '../../core/application/dto/user.dto';
import { zodValidator } from '../../shared/middleware/zod-validator.middleware';
import { customErrorHandler } from '../../shared/middleware/error-handler.middleware';
import { responseFormatter } from '../../shared/middleware/response-formatter.middleware';

const deleteUserHandlerBase = async (
  event: APIGatewayProxyEvent
): Promise<any> => {
  // Path parameters are already validated by middleware
  const user_id = event.pathParameters?.user_id;

  // Execute use case
  const deleteUserUseCase = container.resolve(DeleteUserUseCase);
  await deleteUserUseCase.execute({ user_id: user_id! });

  return { message: 'User deleted successfully' };
};

export const deleteUserHandler = middy(deleteUserHandlerBase)
  .use(httpEventNormalizer())
  .use(zodValidator({ schema: deleteUserSchema, eventKey: 'pathParameters' }))
  .use(customErrorHandler())
  .use(responseFormatter());

