import middy from '@middy/core';
import httpJsonBodyParser from '@middy/http-json-body-parser';
import httpEventNormalizer from '@middy/http-event-normalizer';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { container } from 'tsyringe';
import { PayOrderWithTransferUseCase } from '../../core/application/use-cases/payments/pay-order-with-transfer.use-case';
import { payOrderWithTransferSchema } from '../../core/application/dto/payment.dto';
import { zodValidator } from '../../shared/middleware/zod-validator.middleware';
import { customErrorHandler } from '../../shared/middleware/error-handler.middleware';
import { responseFormatter } from '../../shared/middleware/response-formatter.middleware';

const payOrderWithTransferHandlerBase = async (
  event: APIGatewayProxyEvent
): Promise<any> => {
  const validatedData = event.body as any;

  const payOrderWithTransferUseCase = container.resolve(PayOrderWithTransferUseCase);
  const result = await payOrderWithTransferUseCase.execute(validatedData);

  return result;
};

export const payOrderWithTransferHandler = middy(payOrderWithTransferHandlerBase)
  .use(httpEventNormalizer())
  .use(httpJsonBodyParser())
  .use(zodValidator({ schema: payOrderWithTransferSchema, eventKey: 'body' }))
  .use(customErrorHandler())
  .use(responseFormatter());

