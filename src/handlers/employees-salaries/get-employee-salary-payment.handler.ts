import middy from '@middy/core';
import httpEventNormalizer from '@middy/http-event-normalizer';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { container } from 'tsyringe';
import { GetEmployeeSalaryPaymentUseCase } from '../../core/application/use-cases/employee-salary-payments/get-employee-salary-payment.use-case';
import { getEmployeeSalaryPaymentSchema } from '../../core/application/dto/employee-salary-payment.dto';
import { zodValidator } from '../../shared/middleware/zod-validator.middleware';
import { customErrorHandler } from '../../shared/middleware/error-handler.middleware';
import { responseFormatter } from '../../shared/middleware/response-formatter.middleware';

const getEmployeeSalaryPaymentHandlerBase = async (
  event: APIGatewayProxyEvent
): Promise<any> => {
  const employee_salary_payment_id =
    event.pathParameters?.employee_salary_payment_id;
  const validatedData = {
    employee_salary_payment_id: employee_salary_payment_id!,
  };

  const getEmployeeSalaryPaymentUseCase = container.resolve(
    GetEmployeeSalaryPaymentUseCase
  );
  const result = await getEmployeeSalaryPaymentUseCase.execute(validatedData);

  return result;
};

export const getEmployeeSalaryPaymentHandler = middy(
  getEmployeeSalaryPaymentHandlerBase
)
  .use(httpEventNormalizer())
  .use(
    zodValidator({
      schema: getEmployeeSalaryPaymentSchema,
      eventKey: 'pathParameters',
    })
  )
  .use(customErrorHandler())
  .use(responseFormatter());

