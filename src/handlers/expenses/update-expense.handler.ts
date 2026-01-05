import middy from '@middy/core';
import httpJsonBodyParser from '@middy/http-json-body-parser';
import httpEventNormalizer from '@middy/http-event-normalizer';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { container } from 'tsyringe';
import { UpdateExpenseUseCase } from '../../core/application/use-cases/expenses/update-expense.use-case';
import { updateExpenseSchema } from '../../core/application/dto/expense.dto';
import { zodValidator } from '../../shared/middleware/zod-validator.middleware';
import { customErrorHandler } from '../../shared/middleware/error-handler.middleware';
import { responseFormatter } from '../../shared/middleware/response-formatter.middleware';

const updateExpenseHandlerBase = async (
  event: APIGatewayProxyEvent
): Promise<any> => {
  const expense_id = event.pathParameters?.expense_id;
  const validatedBody = event.body as any;

  const updateExpenseUseCase = container.resolve(UpdateExpenseUseCase);
  const result = await updateExpenseUseCase.execute(expense_id!, validatedBody);

  return result;
};

export const updateExpenseHandler = middy(updateExpenseHandlerBase)
  .use(httpEventNormalizer())
  .use(httpJsonBodyParser())
  .use(zodValidator({ schema: updateExpenseSchema, eventKey: 'body' }))
  .use(customErrorHandler())
  .use(responseFormatter());

