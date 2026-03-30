import { Request, Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import { DeleteTableUseCase } from '../../core/application/use-cases/tables/delete-table.use-case';
import { sendSuccess } from '../../shared/middleware/response-formatter.middleware';

export const deleteTableController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Path parameters are already validated by middleware
    const table_id = req.params.table_id;

    // Execute use case
    const deleteTableUseCase = container.resolve(DeleteTableUseCase);
    await deleteTableUseCase.execute({ table_id: table_id! });

    sendSuccess(res, { message: 'Table deleted successfully' });
  } catch (error) {
    next(error);
  }
};
