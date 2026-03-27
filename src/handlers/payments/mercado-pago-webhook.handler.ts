import middy from '@middy/core';
import httpEventNormalizer from '@middy/http-event-normalizer';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { container } from 'tsyringe';
import { MercadoPagoService } from '../../core/infrastructure/payment-gateways/mercado-pago.service';
import { ConfirmMercadoPagoPaymentUseCase } from '../../core/application/use-cases/payments/confirm-mercado-pago-payment.use-case';
import { AppError } from '../../shared/errors';
import { customErrorHandler } from '../../shared/middleware/error-handler.middleware';
import { responseFormatter } from '../../shared/middleware/response-formatter.middleware';

const mercadoPagoWebhookHandlerBase = async (
  event: APIGatewayProxyEvent
): Promise<any> => {
  const mercadoPagoService = container.resolve(MercadoPagoService);

  // 1. Validar firma del webhook
  const xSignature = event.headers['x-signature'] || event.headers['X-Signature'] || '';
  const xRequestId = event.headers['x-request-id'] || event.headers['X-Request-Id'] || '';
  const queryParams = event.queryStringParameters || {};

  const isValid = mercadoPagoService.validateWebhookSignature({
    xSignature,
    xRequestId,
    dataId: queryParams['data.id'] || '',
  });

  if (!isValid) {
    throw new AppError('INVALID_WEBHOOK_SIGNATURE');
  }

  // 2. Parsear body
  const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;

  // 3. Solo procesar eventos de pago
  if (body.type === 'payment') {
    const confirmUseCase = container.resolve(ConfirmMercadoPagoPaymentUseCase);
    await confirmUseCase.execute({
      mpPaymentId: body.data.id,
      action: body.action,
    });
  }

  return { received: true };
};

// NO httpJsonBodyParser — body raw para validar firma
export const mercadoPagoWebhookHandler = middy(mercadoPagoWebhookHandlerBase)
  .use(httpEventNormalizer())
  .use(customErrorHandler())
  .use(responseFormatter());
