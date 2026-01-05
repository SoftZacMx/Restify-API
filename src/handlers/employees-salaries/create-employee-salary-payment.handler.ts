import middy from '@middy/core';
import httpJsonBodyParser from '@middy/http-json-body-parser';
import httpEventNormalizer from '@middy/http-event-normalizer';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { container } from 'tsyringe';
import { CreateEmployeeSalaryPaymentUseCase } from '../../core/application/use-cases/employee-salary-payments/create-employee-salary-payment.use-case';
import { createEmployeeSalaryPaymentSchema } from '../../core/application/dto/employee-salary-payment.dto';
import { zodValidator } from '../../shared/middleware/zod-validator.middleware';
import { customErrorHandler } from '../../shared/middleware/error-handler.middleware';
import { responseFormatter } from '../../shared/middleware/response-formatter.middleware';

const createEmployeeSalaryPaymentHandlerBase = async (
  event: APIGatewayProxyEvent
): Promise<any> => {
  const validatedData = event.body as any;

  const createEmployeeSalaryPaymentUseCase = container.resolve(
    CreateEmployeeSalaryPaymentUseCase
  );
  const result = await createEmployeeSalaryPaymentUseCase.execute(validatedData);

  return result;
};

export const createEmployeeSalaryPaymentHandler = middy(
  createEmployeeSalaryPaymentHandlerBase
)
  .use(httpEventNormalizer())
  .use(httpJsonBodyParser())
  .use(
    zodValidator({
      schema: createEmployeeSalaryPaymentSchema,
      eventKey: 'body',
    })
  )
  .use(customErrorHandler())
  .use(responseFormatter());

