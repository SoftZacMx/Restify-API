import middy from '@middy/core';
import httpEventNormalizer from '@middy/http-event-normalizer';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { container } from 'tsyringe';
import { GetReportsSummaryUseCase } from '../../core/application/use-cases/reports/get-reports-summary.use-case';
import { customErrorHandler } from '../../shared/middleware/error-handler.middleware';
import { responseFormatter } from '../../shared/middleware/response-formatter.middleware';

const getReportsSummaryHandlerBase = async (
  event: APIGatewayProxyEvent
): Promise<any> => {
  const query = event.queryStringParameters ?? {};
  const dateFrom = query.dateFrom;
  const dateTo = query.dateTo;

  const getReportsSummaryUseCase = container.resolve(GetReportsSummaryUseCase);
  return getReportsSummaryUseCase.execute({ dateFrom, dateTo });
};

export const getReportsSummaryHandler = middy(getReportsSummaryHandlerBase)
  .use(httpEventNormalizer())
  .use(customErrorHandler())
  .use(responseFormatter());
