import middy from '@middy/core';
import httpJsonBodyParser from '@middy/http-json-body-parser';
import httpEventNormalizer from '@middy/http-event-normalizer';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { container } from 'tsyringe';
import { CreateMenuItemUseCase } from '../../core/application/use-cases/menu-items/create-menu-item.use-case';
import { createMenuItemSchema } from '../../core/application/dto/menu-item.dto';
import { zodValidator } from '../../shared/middleware/zod-validator.middleware';
import { customErrorHandler } from '../../shared/middleware/error-handler.middleware';
import { responseFormatter } from '../../shared/middleware/response-formatter.middleware';

const createMenuItemHandlerBase = async (
  event: APIGatewayProxyEvent
): Promise<any> => {
  // Body is already parsed and validated by middlewares
  const validatedData = event.body as any;

  // Execute use case
  const createMenuItemUseCase = container.resolve(CreateMenuItemUseCase);
  const result = await createMenuItemUseCase.execute(validatedData);

  return result;
};

export const createMenuItemHandler = middy(createMenuItemHandlerBase)
  .use(httpEventNormalizer())
  .use(httpJsonBodyParser())
  .use(zodValidator({ schema: createMenuItemSchema, eventKey: 'body' }))
  .use(customErrorHandler())
  .use(responseFormatter());

