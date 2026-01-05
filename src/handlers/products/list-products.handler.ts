import middy from '@middy/core';
import httpEventNormalizer from '@middy/http-event-normalizer';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { container } from 'tsyringe';
import { ListProductsUseCase } from '../../core/application/use-cases/products/list-products.use-case';
import { listProductsSchema } from '../../core/application/dto/product.dto';
import { zodValidator } from '../../shared/middleware/zod-validator.middleware';
import { customErrorHandler } from '../../shared/middleware/error-handler.middleware';
import { responseFormatter } from '../../shared/middleware/response-formatter.middleware';

const listProductsHandlerBase = async (
  event: APIGatewayProxyEvent
): Promise<any> => {
  // Query parameters are already validated by middleware
  const queryParams = event.queryStringParameters || {};

  // Execute use case
  const listProductsUseCase = container.resolve(ListProductsUseCase);
  const result = await listProductsUseCase.execute(queryParams);

  return result;
};

export const listProductsHandler = middy(listProductsHandlerBase)
  .use(httpEventNormalizer())
  .use(zodValidator({ schema: listProductsSchema, eventKey: 'queryStringParameters' }))
  .use(customErrorHandler())
  .use(responseFormatter());

