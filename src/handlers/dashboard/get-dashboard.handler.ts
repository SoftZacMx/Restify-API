import middy from '@middy/core';
import httpEventNormalizer from '@middy/http-event-normalizer';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { container } from 'tsyringe';
import { GetDashboardUseCase } from '../../core/application/use-cases/dashboard/get-dashboard.use-case';
import { customErrorHandler } from '../../shared/middleware/error-handler.middleware';
import { responseFormatter } from '../../shared/middleware/response-formatter.middleware';

const getDashboardHandlerBase = async (
  _event: APIGatewayProxyEvent
): Promise<any> => {
  const getDashboardUseCase = container.resolve(GetDashboardUseCase);
  const result = await getDashboardUseCase.execute();
  return result;
};

export const getDashboardHandler = middy(getDashboardHandlerBase)
  .use(httpEventNormalizer())
  .use(customErrorHandler())
  .use(responseFormatter());
