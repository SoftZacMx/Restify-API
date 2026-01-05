import middy from '@middy/core';
import httpJsonBodyParser from '@middy/http-json-body-parser';
import httpEventNormalizer from '@middy/http-event-normalizer';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { container } from 'tsyringe';
import { UpdateEmployeeSalaryPaymentUseCase } from '../../core/application/use-cases/employee-salary-payments/update-employee-salary-payment.use-case';
import { updateEmployeeSalaryPaymentSchema } from '../../core/application/dto/employee-salary-payment.dto';
import { zodValidator } from '../../shared/middleware/zod-validator.middleware';
import { customErrorHandler } from '../../shared/middleware/error-handler.middleware';
import { responseFormatter } from '../../shared/middleware/response-formatter.middleware';

const updateEmployeeSalaryPaymentHandlerBase = async (
  event: APIGatewayProxyEvent
): Promise<any> => {
  const employee_salary_payment_id =
    event.pathParameters?.employee_salary_payment_id;
  const validatedBody = event.body as any;

  const updateEmployeeSalaryPaymentUseCase = container.resolve(
    UpdateEmployeeSalaryPaymentUseCase
  );
  const result = await updateEmployeeSalaryPaymentUseCase.execute(
    employee_salary_payment_id!,
    validatedBody
  );

  return result;
};

export const updateEmployeeSalaryPaymentHandler = middy(
  updateEmployeeSalaryPaymentHandlerBase
)
  .use(httpEventNormalizer())
  .use(httpJsonBodyParser())
  .use(
    zodValidator({
      schema: updateEmployeeSalaryPaymentSchema,
      eventKey: 'body',
    })
  )
  .use(customErrorHandler())
  .use(responseFormatter());

