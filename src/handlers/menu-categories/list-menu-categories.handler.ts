import middy from '@middy/core';
import httpEventNormalizer from '@middy/http-event-normalizer';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { container } from 'tsyringe';
import { ListMenuCategoriesUseCase } from '../../core/application/use-cases/menu-categories/list-menu-categories.use-case';
import { listMenuCategoriesSchema } from '../../core/application/dto/menu-category.dto';
import { zodValidator } from '../../shared/middleware/zod-validator.middleware';
import { customErrorHandler } from '../../shared/middleware/error-handler.middleware';
import { responseFormatter } from '../../shared/middleware/response-formatter.middleware';

const listMenuCategoriesHandlerBase = async (
  event: APIGatewayProxyEvent
): Promise<any> => {
  // Query parameters are already validated by middleware
  const queryParams = event.queryStringParameters || {};

  // Execute use case
  const listMenuCategoriesUseCase = container.resolve(ListMenuCategoriesUseCase);
  const result = await listMenuCategoriesUseCase.execute(queryParams);

  return result;
};

export const listMenuCategoriesHandler = middy(listMenuCategoriesHandlerBase)
  .use(httpEventNormalizer())
  .use(zodValidator({ schema: listMenuCategoriesSchema, eventKey: 'queryStringParameters' }))
  .use(customErrorHandler())
  .use(responseFormatter());

