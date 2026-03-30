import { Request, Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import { GetTableUseCase } from '../../core/application/use-cases/tables/get-table.use-case';
import { sendSuccess } from '../../shared/middleware/response-formatter.middleware';

export const getTableController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Path parameters are already validated by middleware
    const table_id = req.params.table_id;

    // Execute use case
    const getTableUseCase = container.resolve(GetTableUseCase);
    const result = await getTableUseCase.execute({ table_id: table_id! });

    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};
