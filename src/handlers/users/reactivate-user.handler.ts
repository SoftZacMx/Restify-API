import middy from '@middy/core';
import httpEventNormalizer from '@middy/http-event-normalizer';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { container } from 'tsyringe';
import { ReactivateUserUseCase } from '../../core/application/use-cases/users/reactivate-user.use-case';
import { reactivateUserSchema } from '../../core/application/dto/user.dto';
import { zodValidator } from '../../shared/middleware/zod-validator.middleware';
import { customErrorHandler } from '../../shared/middleware/error-handler.middleware';
import { responseFormatter } from '../../shared/middleware/response-formatter.middleware';

const reactivateUserHandlerBase = async (
  event: APIGatewayProxyEvent
): Promise<any> => {
  // Path parameters are already validated by middleware
  const user_id = event.pathParameters?.user_id;

  // Execute use case
  const reactivateUserUseCase = container.resolve(ReactivateUserUseCase);
  await reactivateUserUseCase.execute({ user_id: user_id! });

  return { message: 'User reactivated successfully' };
};

export const reactivateUserHandler = middy(reactivateUserHandlerBase)
  .use(httpEventNormalizer())
  .use(zodValidator({ schema: reactivateUserSchema, eventKey: 'pathParameters' }))
  .use(customErrorHandler())
  .use(responseFormatter());

