import { Request, Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import { ListTablesUseCase } from '../../core/application/use-cases/tables/list-tables.use-case';
import { sendSuccess } from '../../shared/middleware/response-formatter.middleware';

export const listTablesController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Query parameters are already validated by middleware
    const queryParams = req.query || {};

    // Execute use case
    const listTablesUseCase = container.resolve(ListTablesUseCase);
    const result = await listTablesUseCase.execute(queryParams);

    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};
