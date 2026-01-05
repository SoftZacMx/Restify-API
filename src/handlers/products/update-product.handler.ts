import middy from '@middy/core';
import httpJsonBodyParser from '@middy/http-json-body-parser';
import httpEventNormalizer from '@middy/http-event-normalizer';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { container } from 'tsyringe';
import { UpdateProductUseCase } from '../../core/application/use-cases/products/update-product.use-case';
import { updateProductSchema, getProductSchema } from '../../core/application/dto/product.dto';
import { zodValidator } from '../../shared/middleware/zod-validator.middleware';
import { customErrorHandler } from '../../shared/middleware/error-handler.middleware';
import { responseFormatter } from '../../shared/middleware/response-formatter.middleware';
import { AppError } from '../../shared/errors';
import { ZodError } from 'zod';

const updateProductHandlerBase = async (
  event: APIGatewayProxyEvent
): Promise<any> => {
  const product_id = event.pathParameters?.product_id;

  if (!product_id) {
    throw new AppError('MISSING_REQUIRED_FIELD', 'Product ID is required');
  }

  // Body is already parsed by middleware
  const bodyData = (event.body as any) || {};

  // Validate body data
  let validatedBody;
  try {
    validatedBody = updateProductSchema.parse(bodyData);
  } catch (error) {
    if (error instanceof ZodError) {
      const errorMessage = error.errors
        .map((e) => `${e.path.join('.')}: ${e.message}`)
        .join(', ');
      throw new AppError('VALIDATION_ERROR', errorMessage);
    }
    throw error;
  }

  // Execute use case
  const updateProductUseCase = container.resolve(UpdateProductUseCase);
  const result = await updateProductUseCase.execute(product_id, validatedBody);

  return result;
};

export const updateProductHandler = middy(updateProductHandlerBase)
  .use(httpEventNormalizer())
  .use(httpJsonBodyParser())
  .use(zodValidator({ schema: getProductSchema, eventKey: 'pathParameters' }))
  .use(customErrorHandler())
  .use(responseFormatter());

