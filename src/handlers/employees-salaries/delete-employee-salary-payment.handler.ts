import middy from '@middy/core';
import httpEventNormalizer from '@middy/http-event-normalizer';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { container } from 'tsyringe';
import { DeleteEmployeeSalaryPaymentUseCase } from '../../core/application/use-cases/employee-salary-payments/delete-employee-salary-payment.use-case';
import { getEmployeeSalaryPaymentSchema } from '../../core/application/dto/employee-salary-payment.dto';
import { zodValidator } from '../../shared/middleware/zod-validator.middleware';
import { customErrorHandler } from '../../shared/middleware/error-handler.middleware';
import { responseFormatter } from '../../shared/middleware/response-formatter.middleware';

const deleteEmployeeSalaryPaymentHandlerBase = async (
  event: APIGatewayProxyEvent
): Promise<any> => {
  const employee_salary_payment_id =
    event.pathParameters?.employee_salary_payment_id;
  const validatedData = {
    employee_salary_payment_id: employee_salary_payment_id!,
  };

  const deleteEmployeeSalaryPaymentUseCase = container.resolve(
    DeleteEmployeeSalaryPaymentUseCase
  );
  await deleteEmployeeSalaryPaymentUseCase.execute(validatedData);

  return { message: 'Employee salary payment deleted successfully' };
};

export const deleteEmployeeSalaryPaymentHandler = middy(
  deleteEmployeeSalaryPaymentHandlerBase
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

