import middy from '@middy/core';
import httpJsonBodyParser from '@middy/http-json-body-parser';
import httpEventNormalizer from '@middy/http-event-normalizer';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { container } from 'tsyringe';
import { PayOrderWithSplitPaymentUseCase } from '../../core/application/use-cases/payments/pay-order-with-split-payment.use-case';
import { payOrderWithSplitPaymentSchema } from '../../core/application/dto/payment.dto';
import { zodValidator } from '../../shared/middleware/zod-validator.middleware';
import { customErrorHandler } from '../../shared/middleware/error-handler.middleware';
import { responseFormatter } from '../../shared/middleware/response-formatter.middleware';

const payOrderWithSplitPaymentHandlerBase = async (
  event: APIGatewayProxyEvent
): Promise<any> => {
  const validatedData = event.body as any;

  const payOrderWithSplitPaymentUseCase = container.resolve(PayOrderWithSplitPaymentUseCase);
  const result = await payOrderWithSplitPaymentUseCase.execute(validatedData);

  return result;
};

export const payOrderWithSplitPaymentHandler = middy(payOrderWithSplitPaymentHandlerBase)
  .use(httpEventNormalizer())
  .use(httpJsonBodyParser())
  .use(zodValidator({ schema: payOrderWithSplitPaymentSchema, eventKey: 'body' }))
  .use(customErrorHandler())
  .use(responseFormatter());

