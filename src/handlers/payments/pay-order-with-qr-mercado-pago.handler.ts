import middy from '@middy/core';
import httpJsonBodyParser from '@middy/http-json-body-parser';
import httpEventNormalizer from '@middy/http-event-normalizer';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { container } from 'tsyringe';
import { PayOrderWithQRMercadoPagoUseCase } from '../../core/application/use-cases/payments/pay-order-with-qr-mercado-pago.use-case';
import { payOrderWithQRMercadoPagoSchema } from '../../core/application/dto/payment.dto';
import { zodValidator } from '../../shared/middleware/zod-validator.middleware';
import { customErrorHandler } from '../../shared/middleware/error-handler.middleware';
import { responseFormatter } from '../../shared/middleware/response-formatter.middleware';

const payOrderWithQRMercadoPagoHandlerBase = async (
  event: APIGatewayProxyEvent
): Promise<any> => {
  const validatedData = event.body as any;

  const useCase = container.resolve(PayOrderWithQRMercadoPagoUseCase);
  const result = await useCase.execute(validatedData);

  return result;
};

export const payOrderWithQRMercadoPagoHandler = middy(payOrderWithQRMercadoPagoHandlerBase)
  .use(httpEventNormalizer())
  .use(httpJsonBodyParser())
  .use(zodValidator({ schema: payOrderWithQRMercadoPagoSchema, eventKey: 'body' }))
  .use(customErrorHandler())
  .use(responseFormatter());
