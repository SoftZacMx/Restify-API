import middy from '@middy/core';
import httpEventNormalizer from '@middy/http-event-normalizer';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { container } from 'tsyringe';
import { GetExpenseUseCase } from '../../core/application/use-cases/expenses/get-expense.use-case';
import { getExpenseSchema } from '../../core/application/dto/expense.dto';
import { zodValidator } from '../../shared/middleware/zod-validator.middleware';
import { customErrorHandler } from '../../shared/middleware/error-handler.middleware';
import { responseFormatter } from '../../shared/middleware/response-formatter.middleware';

const getExpenseHandlerBase = async (
  event: APIGatewayProxyEvent
): Promise<any> => {
  const expense_id = event.pathParameters?.expense_id;
  const validatedData = { expense_id: expense_id! };

  const getExpenseUseCase = container.resolve(GetExpenseUseCase);
  const result = await getExpenseUseCase.execute(validatedData);

  return result;
};

export const getExpenseHandler = middy(getExpenseHandlerBase)
  .use(httpEventNormalizer())
  .use(zodValidator({ schema: getExpenseSchema, eventKey: 'pathParameters' }))
  .use(customErrorHandler())
  .use(responseFormatter());

