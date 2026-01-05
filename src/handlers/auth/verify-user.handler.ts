import middy from '@middy/core';
import httpJsonBodyParser from '@middy/http-json-body-parser';
import httpErrorHandler from '@middy/http-error-handler';
import httpEventNormalizer from '@middy/http-event-normalizer';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { container } from 'tsyringe';
import { VerifyUserUseCase } from '../../core/application/use-cases/auth/verify-user.use-case';
import { verifyUserSchema } from '../../core/application/dto/auth.dto';
import { zodValidator } from '../../shared/middleware/zod-validator.middleware';
import { customErrorHandler } from '../../shared/middleware/error-handler.middleware';
import { responseFormatter } from '../../shared/middleware/response-formatter.middleware';

const verifyUserHandlerBase = async (
  event: APIGatewayProxyEvent
): Promise<any> => {
  // Body is already parsed and validated by middlewares
  const validatedData = event.body as any;

  // Execute use case
  const verifyUserUseCase = container.resolve(VerifyUserUseCase);
  const result = await verifyUserUseCase.execute(validatedData);

  return result;
};

export const verifyUserHandler = middy(verifyUserHandlerBase)
  .use(httpEventNormalizer())
  .use(httpJsonBodyParser())
  .use(zodValidator({ schema: verifyUserSchema, eventKey: 'body' }))
  .use(customErrorHandler())
  .use(responseFormatter());

