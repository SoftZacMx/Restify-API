import middy from '@middy/core';
import httpJsonBodyParser from '@middy/http-json-body-parser';
import httpErrorHandler from '@middy/http-error-handler';
import httpEventNormalizer from '@middy/http-event-normalizer';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { container } from 'tsyringe';
import { LoginUseCase } from '../../core/application/use-cases/auth/login.use-case';
import { loginSchema } from '../../core/application/dto/auth.dto';
import { zodValidator } from '../../shared/middleware/zod-validator.middleware';
import { customErrorHandler } from '../../shared/middleware/error-handler.middleware';
import { responseFormatter } from '../../shared/middleware/response-formatter.middleware';

const loginHandlerBase = async (
  event: APIGatewayProxyEvent
): Promise<any> => {
  // Body is already parsed and validated by middlewares
  const validatedData = event.body as any;
  const userRol = event.pathParameters?.rol;

  // Execute use case
  const loginUseCase = container.resolve(LoginUseCase);
  const result = await loginUseCase.execute(validatedData, userRol);

  return result;
};

export const loginHandler = middy(loginHandlerBase)
  .use(httpEventNormalizer())
  .use(httpJsonBodyParser())
  .use(zodValidator({ schema: loginSchema, eventKey: 'body' }))
  .use(customErrorHandler())
  .use(responseFormatter());

