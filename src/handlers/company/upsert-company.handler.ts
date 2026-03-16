import middy from '@middy/core';
import httpJsonBodyParser from '@middy/http-json-body-parser';
import httpEventNormalizer from '@middy/http-event-normalizer';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { container } from 'tsyringe';
import { UpsertCompanyUseCase } from '../../core/application/use-cases/company/upsert-company.use-case';
import { upsertCompanySchema } from '../../core/application/dto/company.dto';
import { zodValidator } from '../../shared/middleware/zod-validator.middleware';
import { customErrorHandler } from '../../shared/middleware/error-handler.middleware';
import { responseFormatter } from '../../shared/middleware/response-formatter.middleware';

const upsertCompanyHandlerBase = async (event: APIGatewayProxyEvent): Promise<any> => {
  const validatedData = event.body as any;
  const upsertCompanyUseCase = container.resolve(UpsertCompanyUseCase);
  const result = await upsertCompanyUseCase.execute(validatedData);
  return result;
};

export const upsertCompanyHandler = middy(upsertCompanyHandlerBase)
  .use(httpEventNormalizer())
  .use(httpJsonBodyParser())
  .use(zodValidator({ schema: upsertCompanySchema, eventKey: 'body' }))
  .use(customErrorHandler())
  .use(responseFormatter());
