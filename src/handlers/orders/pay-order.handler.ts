import middy from '@middy/core';
import httpJsonBodyParser from '@middy/http-json-body-parser';
import httpEventNormalizer from '@middy/http-event-normalizer';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { container } from 'tsyringe';
import { PayOrderUseCase } from '../../core/application/use-cases/orders/pay-order.use-case';
import { payOrderSchema } from '../../core/application/dto/payment.dto';
import { zodValidator } from '../../shared/middleware/zod-validator.middleware';
import { customErrorHandler } from '../../shared/middleware/error-handler.middleware';
import { responseFormatter } from '../../shared/middleware/response-formatter.middleware';

const payOrderHandlerBase = async (event: APIGatewayProxyEvent): Promise<any> => {
  const validatedData = event.body as any;

  const payOrderUseCase = container.resolve(PayOrderUseCase);
  const result = await payOrderUseCase.execute(validatedData);

  return result;
};

export const payOrderHandler = middy(payOrderHandlerBase)
  .use(httpEventNormalizer())
  .use(httpJsonBodyParser())
  .use(zodValidator({ schema: payOrderSchema, eventKey: 'body' }))
  .use(customErrorHandler())
  .use(responseFormatter());
