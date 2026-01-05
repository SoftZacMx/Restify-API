import middy from '@middy/core';
import httpJsonBodyParser from '@middy/http-json-body-parser';
import httpEventNormalizer from '@middy/http-event-normalizer';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { container } from 'tsyringe';
import { CreateUserUseCase } from '../../core/application/use-cases/users/create-user.use-case';
import { createUserSchema } from '../../core/application/dto/user.dto';
import { zodValidator } from '../../shared/middleware/zod-validator.middleware';
import { customErrorHandler } from '../../shared/middleware/error-handler.middleware';
import { responseFormatter } from '../../shared/middleware/response-formatter.middleware';

const createUserHandlerBase = async (
  event: APIGatewayProxyEvent
): Promise<any> => {
  // Body is already parsed and validated by middlewares
  const validatedData = event.body as any;

  // Execute use case
  const createUserUseCase = container.resolve(CreateUserUseCase);
  const result = await createUserUseCase.execute(validatedData);

  return result;
};

export const createUserHandler = middy(createUserHandlerBase)
  .use(httpEventNormalizer())
  .use(httpJsonBodyParser())
  .use(zodValidator({ schema: createUserSchema, eventKey: 'body' }))
  .use(customErrorHandler())
  .use(responseFormatter());

