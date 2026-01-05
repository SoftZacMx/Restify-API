import middy from '@middy/core';
import httpJsonBodyParser from '@middy/http-json-body-parser';
import httpEventNormalizer from '@middy/http-event-normalizer';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { container } from 'tsyringe';
import { CreateMenuCategoryUseCase } from '../../core/application/use-cases/menu-categories/create-menu-category.use-case';
import { createMenuCategorySchema } from '../../core/application/dto/menu-category.dto';
import { zodValidator } from '../../shared/middleware/zod-validator.middleware';
import { customErrorHandler } from '../../shared/middleware/error-handler.middleware';
import { responseFormatter } from '../../shared/middleware/response-formatter.middleware';

const createMenuCategoryHandlerBase = async (
  event: APIGatewayProxyEvent
): Promise<any> => {
  // Body is already parsed and validated by middlewares
  const validatedData = event.body as any;

  // Execute use case
  const createMenuCategoryUseCase = container.resolve(CreateMenuCategoryUseCase);
  const result = await createMenuCategoryUseCase.execute(validatedData);

  return result;
};

export const createMenuCategoryHandler = middy(createMenuCategoryHandlerBase)
  .use(httpEventNormalizer())
  .use(httpJsonBodyParser())
  .use(zodValidator({ schema: createMenuCategorySchema, eventKey: 'body' }))
  .use(customErrorHandler())
  .use(responseFormatter());

