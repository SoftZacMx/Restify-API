import middy from '@middy/core';
import httpEventNormalizer from '@middy/http-event-normalizer';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { container } from 'tsyringe';
import { DeleteExpenseUseCase } from '../../core/application/use-cases/expenses/delete-expense.use-case';
import { getExpenseSchema } from '../../core/application/dto/expense.dto';
import { zodValidator } from '../../shared/middleware/zod-validator.middleware';
import { customErrorHandler } from '../../shared/middleware/error-handler.middleware';
import { responseFormatter } from '../../shared/middleware/response-formatter.middleware';

const deleteExpenseHandlerBase = async (
  event: APIGatewayProxyEvent
): Promise<any> => {
  const expense_id = event.pathParameters?.expense_id;
  const validatedData = { expense_id: expense_id! };

  const deleteExpenseUseCase = container.resolve(DeleteExpenseUseCase);
  await deleteExpenseUseCase.execute(validatedData);

  return { message: 'Expense deleted successfully' };
};

export const deleteExpenseHandler = middy(deleteExpenseHandlerBase)
  .use(httpEventNormalizer())
  .use(zodValidator({ schema: getExpenseSchema, eventKey: 'pathParameters' }))
  .use(customErrorHandler())
  .use(responseFormatter());

