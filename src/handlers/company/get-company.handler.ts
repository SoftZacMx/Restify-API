import middy from '@middy/core';
import httpEventNormalizer from '@middy/http-event-normalizer';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { container } from 'tsyringe';
import { GetCompanyUseCase } from '../../core/application/use-cases/company/get-company.use-case';
import { customErrorHandler } from '../../shared/middleware/error-handler.middleware';
import { responseFormatter } from '../../shared/middleware/response-formatter.middleware';

const getCompanyHandlerBase = async (event: APIGatewayProxyEvent): Promise<any> => {
  const getCompanyUseCase = container.resolve(GetCompanyUseCase);
  const result = await getCompanyUseCase.execute();
  return result;
};

export const getCompanyHandler = middy(getCompanyHandlerBase)
  .use(httpEventNormalizer())
  .use(customErrorHandler())
  .use(responseFormatter());
