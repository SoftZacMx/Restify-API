import middy from '@middy/core';
import httpEventNormalizer from '@middy/http-event-normalizer';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { container } from 'tsyringe';
import { DeleteMenuCategoryUseCase } from '../../core/application/use-cases/menu-categories/delete-menu-category.use-case';
import { deleteMenuCategorySchema } from '../../core/application/dto/menu-category.dto';
import { zodValidator } from '../../shared/middleware/zod-validator.middleware';
import { customErrorHandler } from '../../shared/middleware/error-handler.middleware';
import { responseFormatter } from '../../shared/middleware/response-formatter.middleware';

const deleteMenuCategoryHandlerBase = async (
  event: APIGatewayProxyEvent
): Promise<any> => {
  // Path parameters are already validated by middleware
  const category_id = event.pathParameters?.category_id;

  // Execute use case
  const deleteMenuCategoryUseCase = container.resolve(DeleteMenuCategoryUseCase);
  await deleteMenuCategoryUseCase.execute({ category_id: category_id! });

  return { message: 'Menu category deleted successfully' };
};

export const deleteMenuCategoryHandler = middy(deleteMenuCategoryHandlerBase)
  .use(httpEventNormalizer())
  .use(zodValidator({ schema: deleteMenuCategorySchema, eventKey: 'pathParameters' }))
  .use(customErrorHandler())
  .use(responseFormatter());

