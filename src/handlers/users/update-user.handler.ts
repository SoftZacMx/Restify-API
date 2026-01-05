import middy from '@middy/core';
import httpJsonBodyParser from '@middy/http-json-body-parser';
import httpEventNormalizer from '@middy/http-event-normalizer';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { container } from 'tsyringe';
import { UpdateUserUseCase } from '../../core/application/use-cases/users/update-user.use-case';
import { updateUserSchema, getUserSchema } from '../../core/application/dto/user.dto';
import { zodValidator } from '../../shared/middleware/zod-validator.middleware';
import { customErrorHandler } from '../../shared/middleware/error-handler.middleware';
import { responseFormatter } from '../../shared/middleware/response-formatter.middleware';
import { AppError } from '../../shared/errors';
import { ZodError } from 'zod';

const updateUserHandlerBase = async (
  event: APIGatewayProxyEvent
): Promise<any> => {
  const user_id = event.pathParameters?.user_id;

  if (!user_id) {
    throw new AppError('MISSING_REQUIRED_FIELD', 'User ID is required');
  }

  // Body is already parsed by middleware
  const bodyData = (event.body as any) || {};

  // Validate body data
  let validatedBody;
  try {
    validatedBody = updateUserSchema.parse(bodyData);
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
  const updateUserUseCase = container.resolve(UpdateUserUseCase);
  const result = await updateUserUseCase.execute(user_id, validatedBody);

  return result;
};

export const updateUserHandler = middy(updateUserHandlerBase)
  .use(httpEventNormalizer())
  .use(httpJsonBodyParser())
  .use(zodValidator({ schema: getUserSchema, eventKey: 'pathParameters' }))
  .use(customErrorHandler())
  .use(responseFormatter());

