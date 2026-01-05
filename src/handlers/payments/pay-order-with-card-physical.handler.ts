import middy from '@middy/core';
import httpJsonBodyParser from '@middy/http-json-body-parser';
import httpEventNormalizer from '@middy/http-event-normalizer';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { container } from 'tsyringe';
import { PayOrderWithCardPhysicalUseCase } from '../../core/application/use-cases/payments/pay-order-with-card-physical.use-case';
import { payOrderWithCardPhysicalSchema } from '../../core/application/dto/payment.dto';
import { zodValidator } from '../../shared/middleware/zod-validator.middleware';
import { customErrorHandler } from '../../shared/middleware/error-handler.middleware';
import { responseFormatter } from '../../shared/middleware/response-formatter.middleware';

const payOrderWithCardPhysicalHandlerBase = async (
  event: APIGatewayProxyEvent
): Promise<any> => {
  const validatedData = event.body as any;

  const payOrderWithCardPhysicalUseCase = container.resolve(PayOrderWithCardPhysicalUseCase);
  const result = await payOrderWithCardPhysicalUseCase.execute(validatedData);

  return result;
};

export const payOrderWithCardPhysicalHandler = middy(payOrderWithCardPhysicalHandlerBase)
  .use(httpEventNormalizer())
  .use(httpJsonBodyParser())
  .use(zodValidator({ schema: payOrderWithCardPhysicalSchema, eventKey: 'body' }))
  .use(customErrorHandler())
  .use(responseFormatter());

