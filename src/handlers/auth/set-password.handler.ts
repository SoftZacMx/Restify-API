import middy from '@middy/core';
import httpJsonBodyParser from '@middy/http-json-body-parser';
import httpErrorHandler from '@middy/http-error-handler';
import httpEventNormalizer from '@middy/http-event-normalizer';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { container } from 'tsyringe';
import { SetPasswordUseCase } from '../../core/application/use-cases/auth/set-password.use-case';
import { setPasswordSchema } from '../../core/application/dto/auth.dto';
import { zodValidator } from '../../shared/middleware/zod-validator.middleware';
import { customErrorHandler } from '../../shared/middleware/error-handler.middleware';
import { responseFormatter } from '../../shared/middleware/response-formatter.middleware';
import { AppError } from '../../shared/errors';
import { ZodError } from 'zod';

const setPasswordHandlerBase = async (
  event: APIGatewayProxyEvent
): Promise<any> => {
  const user_id = event.pathParameters?.user_id;

  if (!user_id) {
    throw new AppError('MISSING_REQUIRED_FIELD', 'User ID is required');
  }

  // Body is already parsed by middleware
  // Combine body and path parameter for validation
  const dataToValidate = {
    ...(event.body as any),
    user_id,
  };

  // Validate combined data (manual validation since we need to combine body + pathParams)
  let validatedData;
  try {
    validatedData = setPasswordSchema.parse(dataToValidate);
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
  const setPasswordUseCase = container.resolve(SetPasswordUseCase);
  await setPasswordUseCase.execute(validatedData);

  return { message: 'Password updated successfully' };
};

export const setPasswordHandler = middy(setPasswordHandlerBase)
  .use(httpEventNormalizer())
  .use(httpJsonBodyParser())
  // Note: We validate manually in the handler since we need to combine body + pathParams
  .use(customErrorHandler())
  .use(responseFormatter());

