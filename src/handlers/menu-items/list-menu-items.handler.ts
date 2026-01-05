import middy from '@middy/core';
import httpEventNormalizer from '@middy/http-event-normalizer';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { container } from 'tsyringe';
import { ListMenuItemsUseCase } from '../../core/application/use-cases/menu-items/list-menu-items.use-case';
import { listMenuItemsSchema } from '../../core/application/dto/menu-item.dto';
import { zodValidator } from '../../shared/middleware/zod-validator.middleware';
import { customErrorHandler } from '../../shared/middleware/error-handler.middleware';
import { responseFormatter } from '../../shared/middleware/response-formatter.middleware';

const listMenuItemsHandlerBase = async (
  event: APIGatewayProxyEvent
): Promise<any> => {
  // Query parameters are already validated by middleware
  const queryParams = event.queryStringParameters || {};

  // Execute use case
  const listMenuItemsUseCase = container.resolve(ListMenuItemsUseCase);
  const result = await listMenuItemsUseCase.execute(queryParams);

  return result;
};

export const listMenuItemsHandler = middy(listMenuItemsHandlerBase)
  .use(httpEventNormalizer())
  .use(zodValidator({ schema: listMenuItemsSchema, eventKey: 'queryStringParameters' }))
  .use(customErrorHandler())
  .use(responseFormatter());

