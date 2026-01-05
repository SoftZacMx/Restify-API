import middy from '@middy/core';
import httpEventNormalizer from '@middy/http-event-normalizer';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { container } from 'tsyringe';
import { GetMenuCategoryUseCase } from '../../core/application/use-cases/menu-categories/get-menu-category.use-case';
import { getMenuCategorySchema } from '../../core/application/dto/menu-category.dto';
import { zodValidator } from '../../shared/middleware/zod-validator.middleware';
import { customErrorHandler } from '../../shared/middleware/error-handler.middleware';
import { responseFormatter } from '../../shared/middleware/response-formatter.middleware';

const getMenuCategoryHandlerBase = async (
  event: APIGatewayProxyEvent
): Promise<any> => {
  // Path parameters are already validated by middleware
  const category_id = event.pathParameters?.category_id;

  // Execute use case
  const getMenuCategoryUseCase = container.resolve(GetMenuCategoryUseCase);
  const result = await getMenuCategoryUseCase.execute({ category_id: category_id! });

  return result;
};

export const getMenuCategoryHandler = middy(getMenuCategoryHandlerBase)
  .use(httpEventNormalizer())
  .use(zodValidator({ schema: getMenuCategorySchema, eventKey: 'pathParameters' }))
  .use(customErrorHandler())
  .use(responseFormatter());

