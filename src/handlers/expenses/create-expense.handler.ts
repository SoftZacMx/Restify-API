import middy from '@middy/core';
import httpJsonBodyParser from '@middy/http-json-body-parser';
import httpEventNormalizer from '@middy/http-event-normalizer';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { container } from 'tsyringe';
import { CreateExpenseUseCase } from '../../core/application/use-cases/expenses/create-expense.use-case';
import { createExpenseSchema } from '../../core/application/dto/expense.dto';
import { zodValidator } from '../../shared/middleware/zod-validator.middleware';
import { customErrorHandler } from '../../shared/middleware/error-handler.middleware';
import { responseFormatter } from '../../shared/middleware/response-formatter.middleware';

const createExpenseHandlerBase = async (
  event: APIGatewayProxyEvent
): Promise<any> => {
  const validatedData = event.body as any;

  const createExpenseUseCase = container.resolve(CreateExpenseUseCase);
  const result = await createExpenseUseCase.execute(validatedData);

  return result;
};

export const createExpenseHandler = middy(createExpenseHandlerBase)
  .use(httpEventNormalizer())
  .use(httpJsonBodyParser())
  .use(zodValidator({ schema: createExpenseSchema, eventKey: 'body' }))
  .use(customErrorHandler())
  .use(responseFormatter());

