import middy from '@middy/core';
import httpEventNormalizer from '@middy/http-event-normalizer';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { container } from 'tsyringe';
import { GetProductUseCase } from '../../core/application/use-cases/products/get-product.use-case';
import { getProductSchema } from '../../core/application/dto/product.dto';
import { zodValidator } from '../../shared/middleware/zod-validator.middleware';
import { customErrorHandler } from '../../shared/middleware/error-handler.middleware';
import { responseFormatter } from '../../shared/middleware/response-formatter.middleware';

const getProductHandlerBase = async (
  event: APIGatewayProxyEvent
): Promise<any> => {
  // Path parameters are already validated by middleware
  const product_id = event.pathParameters?.product_id;

  // Execute use case
  const getProductUseCase = container.resolve(GetProductUseCase);
  const result = await getProductUseCase.execute({ product_id: product_id! });

  return result;
};

export const getProductHandler = middy(getProductHandlerBase)
  .use(httpEventNormalizer())
  .use(zodValidator({ schema: getProductSchema, eventKey: 'pathParameters' }))
  .use(customErrorHandler())
  .use(responseFormatter());

