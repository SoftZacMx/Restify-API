import middy from '@middy/core';
import httpEventNormalizer from '@middy/http-event-normalizer';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { container } from 'tsyringe';
import { ListEmployeeSalaryPaymentsUseCase } from '../../core/application/use-cases/employee-salary-payments/list-employee-salary-payments.use-case';
import { listEmployeeSalaryPaymentsSchema } from '../../core/application/dto/employee-salary-payment.dto';
import { zodValidator } from '../../shared/middleware/zod-validator.middleware';
import { customErrorHandler } from '../../shared/middleware/error-handler.middleware';
import { responseFormatter } from '../../shared/middleware/response-formatter.middleware';

const listEmployeeSalaryPaymentsHandlerBase = async (
  event: APIGatewayProxyEvent
): Promise<any> => {
  const queryParams = event.queryStringParameters || {};
  const validatedData = queryParams as any;

  const listEmployeeSalaryPaymentsUseCase = container.resolve(
    ListEmployeeSalaryPaymentsUseCase
  );
  const result = await listEmployeeSalaryPaymentsUseCase.execute(validatedData);

  return result;
};

export const listEmployeeSalaryPaymentsHandler = middy(
  listEmployeeSalaryPaymentsHandlerBase
)
  .use(httpEventNormalizer())
  .use(
    zodValidator({
      schema: listEmployeeSalaryPaymentsSchema,
      eventKey: 'queryStringParameters',
    })
  )
  .use(customErrorHandler())
  .use(responseFormatter());

