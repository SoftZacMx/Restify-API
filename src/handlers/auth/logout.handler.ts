import middy from '@middy/core';
import httpEventNormalizer from '@middy/http-event-normalizer';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { container } from 'tsyringe';
import { LogoutUseCase } from '../../core/application/use-cases/auth/logout.use-case';
import { customErrorHandler } from '../../shared/middleware/error-handler.middleware';
import { responseFormatter } from '../../shared/middleware/response-formatter.middleware';

const logoutHandlerBase = async (
  event: APIGatewayProxyEvent
): Promise<any> => {
  // Execute use case
  const logoutUseCase = container.resolve(LogoutUseCase);
  const result = await logoutUseCase.execute();

  return result;
};

export const logoutHandler = middy(logoutHandlerBase)
  .use(httpEventNormalizer())
  .use(customErrorHandler())
  .use(responseFormatter());

