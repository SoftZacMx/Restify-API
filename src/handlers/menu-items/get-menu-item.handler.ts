import middy from '@middy/core';
import httpEventNormalizer from '@middy/http-event-normalizer';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { container } from 'tsyringe';
import { GetMenuItemUseCase } from '../../core/application/use-cases/menu-items/get-menu-item.use-case';
import { getMenuItemSchema } from '../../core/application/dto/menu-item.dto';
import { zodValidator } from '../../shared/middleware/zod-validator.middleware';
import { customErrorHandler } from '../../shared/middleware/error-handler.middleware';
import { responseFormatter } from '../../shared/middleware/response-formatter.middleware';

const getMenuItemHandlerBase = async (
  event: APIGatewayProxyEvent
): Promise<any> => {
  // Path parameters are already validated by middleware
  const menu_item_id = event.pathParameters?.menu_item_id;

  // Execute use case
  const getMenuItemUseCase = container.resolve(GetMenuItemUseCase);
  const result = await getMenuItemUseCase.execute({ menu_item_id: menu_item_id! });

  return result;
};

export const getMenuItemHandler = middy(getMenuItemHandlerBase)
  .use(httpEventNormalizer())
  .use(zodValidator({ schema: getMenuItemSchema, eventKey: 'pathParameters' }))
  .use(customErrorHandler())
  .use(responseFormatter());

