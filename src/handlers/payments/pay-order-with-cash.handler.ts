import middy from '@middy/core';
import httpJsonBodyParser from '@middy/http-json-body-parser';
import httpEventNormalizer from '@middy/http-event-normalizer';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { container } from 'tsyringe';
import { PayOrderWithCashUseCase } from '../../core/application/use-cases/payments/pay-order-with-cash.use-case';
import { payOrderWithCashSchema } from '../../core/application/dto/payment.dto';
import { zodValidator } from '../../shared/middleware/zod-validator.middleware';
import { customErrorHandler } from '../../shared/middleware/error-handler.middleware';
import { responseFormatter } from '../../shared/middleware/response-formatter.middleware';

const payOrderWithCashHandlerBase = async (
  event: APIGatewayProxyEvent
): Promise<any> => {
  const validatedData = event.body as any;

  const payOrderWithCashUseCase = container.resolve(PayOrderWithCashUseCase);
  const result = await payOrderWithCashUseCase.execute(validatedData);

  return result;
};

export const payOrderWithCashHandler = middy(payOrderWithCashHandlerBase)
  .use(httpEventNormalizer())
  .use(httpJsonBodyParser())
  .use(zodValidator({ schema: payOrderWithCashSchema, eventKey: 'body' }))
  .use(customErrorHandler())
  .use(responseFormatter());

