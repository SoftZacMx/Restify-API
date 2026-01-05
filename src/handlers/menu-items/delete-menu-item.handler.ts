import middy from '@middy/core';
import httpEventNormalizer from '@middy/http-event-normalizer';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { container } from 'tsyringe';
import { DeleteMenuItemUseCase } from '../../core/application/use-cases/menu-items/delete-menu-item.use-case';
import { deleteMenuItemSchema } from '../../core/application/dto/menu-item.dto';
import { zodValidator } from '../../shared/middleware/zod-validator.middleware';
import { customErrorHandler } from '../../shared/middleware/error-handler.middleware';
import { responseFormatter } from '../../shared/middleware/response-formatter.middleware';

const deleteMenuItemHandlerBase = async (
  event: APIGatewayProxyEvent
): Promise<any> => {
  // Path parameters are already validated by middleware
  const menu_item_id = event.pathParameters?.menu_item_id;

  // Execute use case
  const deleteMenuItemUseCase = container.resolve(DeleteMenuItemUseCase);
  await deleteMenuItemUseCase.execute({ menu_item_id: menu_item_id! });

  return { message: 'Menu item deleted successfully' };
};

export const deleteMenuItemHandler = middy(deleteMenuItemHandlerBase)
  .use(httpEventNormalizer())
  .use(zodValidator({ schema: deleteMenuItemSchema, eventKey: 'pathParameters' }))
  .use(customErrorHandler())
  .use(responseFormatter());

