import middy from '@middy/core';
import httpEventNormalizer from '@middy/http-event-normalizer';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { container } from 'tsyringe';
import { DeleteProductUseCase } from '../../core/application/use-cases/products/delete-product.use-case';
import { deleteProductSchema } from '../../core/application/dto/product.dto';
import { zodValidator } from '../../shared/middleware/zod-validator.middleware';
import { customErrorHandler } from '../../shared/middleware/error-handler.middleware';
import { responseFormatter } from '../../shared/middleware/response-formatter.middleware';

const deleteProductHandlerBase = async (
  event: APIGatewayProxyEvent
): Promise<any> => {
  // Path parameters are already validated by middleware
  const product_id = event.pathParameters?.product_id;

  // Execute use case
  const deleteProductUseCase = container.resolve(DeleteProductUseCase);
  await deleteProductUseCase.execute({ product_id: product_id! });

  return { message: 'Product deleted successfully' };
};

export const deleteProductHandler = middy(deleteProductHandlerBase)
  .use(httpEventNormalizer())
  .use(zodValidator({ schema: deleteProductSchema, eventKey: 'pathParameters' }))
  .use(customErrorHandler())
  .use(responseFormatter());

