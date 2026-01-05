import middy from '@middy/core';
import httpEventNormalizer from '@middy/http-event-normalizer';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { container } from 'tsyringe';
import { GenerateReportUseCase } from '../../core/application/use-cases/reports/generate-report.use-case';
import { generateReportSchema } from '../../core/application/dto/report.dto';
import { zodValidator } from '../../shared/middleware/zod-validator.middleware';
import { customErrorHandler } from '../../shared/middleware/error-handler.middleware';
import { responseFormatter } from '../../shared/middleware/response-formatter.middleware';

const generateReportHandlerBase = async (
  event: APIGatewayProxyEvent
): Promise<any> => {
  const queryParams = event.queryStringParameters || {};
  const validatedData = queryParams as any;

  const generateReportUseCase = container.resolve(GenerateReportUseCase);
  const result = await generateReportUseCase.execute(validatedData);

  return result;
};

export const generateReportHandler = middy(generateReportHandlerBase)
  .use(httpEventNormalizer())
  .use(
    zodValidator({
      schema: generateReportSchema,
      eventKey: 'queryStringParameters',
    })
  )
  .use(customErrorHandler())
  .use(responseFormatter());

