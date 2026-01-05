import middy from '@middy/core';
import httpJsonBodyParser from '@middy/http-json-body-parser';
import httpEventNormalizer from '@middy/http-event-normalizer';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { container } from 'tsyringe';
import { UpdateMenuCategoryUseCase } from '../../core/application/use-cases/menu-categories/update-menu-category.use-case';
import { updateMenuCategorySchema, getMenuCategorySchema } from '../../core/application/dto/menu-category.dto';
import { zodValidator } from '../../shared/middleware/zod-validator.middleware';
import { customErrorHandler } from '../../shared/middleware/error-handler.middleware';
import { responseFormatter } from '../../shared/middleware/response-formatter.middleware';
import { AppError } from '../../shared/errors';
import { ZodError } from 'zod';

const updateMenuCategoryHandlerBase = async (
  event: APIGatewayProxyEvent
): Promise<any> => {
  const category_id = event.pathParameters?.category_id;

  if (!category_id) {
    throw new AppError('MISSING_REQUIRED_FIELD', 'Category ID is required');
  }

  // Body is already parsed by middleware
  const bodyData = (event.body as any) || {};

  // Validate body data
  let validatedBody;
  try {
    validatedBody = updateMenuCategorySchema.parse(bodyData);
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
  const updateMenuCategoryUseCase = container.resolve(UpdateMenuCategoryUseCase);
  const result = await updateMenuCategoryUseCase.execute(category_id, validatedBody);

  return result;
};

export const updateMenuCategoryHandler = middy(updateMenuCategoryHandlerBase)
  .use(httpEventNormalizer())
  .use(httpJsonBodyParser())
  .use(zodValidator({ schema: getMenuCategorySchema, eventKey: 'pathParameters' }))
  .use(customErrorHandler())
  .use(responseFormatter());

