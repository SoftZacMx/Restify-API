import middy from '@middy/core';
import httpJsonBodyParser from '@middy/http-json-body-parser';
import httpEventNormalizer from '@middy/http-event-normalizer';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { container } from 'tsyringe';
import { CreateProductUseCase } from '../../core/application/use-cases/products/create-product.use-case';
import { createProductSchema } from '../../core/application/dto/product.dto';
import { zodValidator } from '../../shared/middleware/zod-validator.middleware';
import { customErrorHandler } from '../../shared/middleware/error-handler.middleware';
import { responseFormatter } from '../../shared/middleware/response-formatter.middleware';

const createProductHandlerBase = async (
  event: APIGatewayProxyEvent
): Promise<any> => {
  // Body is already parsed and validated by middlewares
  const validatedData = event.body as any;

  // Execute use case
  const createProductUseCase = container.resolve(CreateProductUseCase);
  const result = await createProductUseCase.execute(validatedData);

  return result;
};

export const createProductHandler = middy(createProductHandlerBase)
  .use(httpEventNormalizer())
  .use(httpJsonBodyParser())
  .use(zodValidator({ schema: createProductSchema, eventKey: 'body' }))
  .use(customErrorHandler())
  .use(responseFormatter());

