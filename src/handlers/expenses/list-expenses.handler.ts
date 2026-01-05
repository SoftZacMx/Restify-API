import middy from '@middy/core';
import httpEventNormalizer from '@middy/http-event-normalizer';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { container } from 'tsyringe';
import { ListExpensesUseCase } from '../../core/application/use-cases/expenses/list-expenses.use-case';
import { listExpensesSchema } from '../../core/application/dto/expense.dto';
import { zodValidator } from '../../shared/middleware/zod-validator.middleware';
import { customErrorHandler } from '../../shared/middleware/error-handler.middleware';
import { responseFormatter } from '../../shared/middleware/response-formatter.middleware';

const listExpensesHandlerBase = async (
  event: APIGatewayProxyEvent
): Promise<any> => {
  const queryParams = event.queryStringParameters || {};
  const validatedData = queryParams as any;

  const listExpensesUseCase = container.resolve(ListExpensesUseCase);
  const result = await listExpensesUseCase.execute(validatedData);

  return result;
};

export const listExpensesHandler = middy(listExpensesHandlerBase)
  .use(httpEventNormalizer())
  .use(zodValidator({ schema: listExpensesSchema, eventKey: 'queryStringParameters' }))
  .use(customErrorHandler())
  .use(responseFormatter());

