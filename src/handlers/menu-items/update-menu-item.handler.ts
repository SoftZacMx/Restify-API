import middy from '@middy/core';
import httpJsonBodyParser from '@middy/http-json-body-parser';
import httpEventNormalizer from '@middy/http-event-normalizer';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { container } from 'tsyringe';
import { UpdateMenuItemUseCase } from '../../core/application/use-cases/menu-items/update-menu-item.use-case';
import { updateMenuItemSchema, getMenuItemSchema } from '../../core/application/dto/menu-item.dto';
import { zodValidator } from '../../shared/middleware/zod-validator.middleware';
import { customErrorHandler } from '../../shared/middleware/error-handler.middleware';
import { responseFormatter } from '../../shared/middleware/response-formatter.middleware';
import { AppError } from '../../shared/errors';
import { ZodError } from 'zod';

const updateMenuItemHandlerBase = async (
  event: APIGatewayProxyEvent
): Promise<any> => {
  const menu_item_id = event.pathParameters?.menu_item_id;

  if (!menu_item_id) {
    throw new AppError('MISSING_REQUIRED_FIELD', 'Menu item ID is required');
  }

  // Body is already parsed by middleware
  const bodyData = (event.body as any) || {};

  // Validate body data
  let validatedBody;
  try {
    validatedBody = updateMenuItemSchema.parse(bodyData);
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
  const updateMenuItemUseCase = container.resolve(UpdateMenuItemUseCase);
  const result = await updateMenuItemUseCase.execute(menu_item_id, validatedBody);

  return result;
};

export const updateMenuItemHandler = middy(updateMenuItemHandlerBase)
  .use(httpEventNormalizer())
  .use(httpJsonBodyParser())
  .use(zodValidator({ schema: getMenuItemSchema, eventKey: 'pathParameters' }))
  .use(customErrorHandler())
  .use(responseFormatter());

