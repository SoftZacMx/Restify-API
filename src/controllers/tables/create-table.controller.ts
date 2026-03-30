import { Request, Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import { CreateTableUseCase } from '../../core/application/use-cases/tables/create-table.use-case';
import { sendSuccess } from '../../shared/middleware/response-formatter.middleware';

export const createTableController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Body is already parsed and validated by middlewares
    const validatedData = req.body;

    // Execute use case
    const createTableUseCase = container.resolve(CreateTableUseCase);
    const result = await createTableUseCase.execute(validatedData);

    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};
