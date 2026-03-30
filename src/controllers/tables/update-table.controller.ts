import { Request, Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import { UpdateTableUseCase } from '../../core/application/use-cases/tables/update-table.use-case';
import { updateTableSchema } from '../../core/application/dto/table.dto';
import { AppError } from '../../shared/errors';
import { ZodError } from 'zod';
import { sendSuccess } from '../../shared/middleware/response-formatter.middleware';

export const updateTableController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const table_id = req.params.table_id;

    if (!table_id) {
      throw new AppError('MISSING_REQUIRED_FIELD', 'Table ID is required');
    }

    // Body is already parsed by middleware
    const bodyData = req.body || {};

    // Validate body data
    let validatedBody;
    try {
      validatedBody = updateTableSchema.parse(bodyData);
    } catch (error) {
      if (error instanceof ZodError) {
        const errorMessage = error.errors
          .map((e) => `${e.path.join('.')}: ${e.message}`)
          .join(', ');
        throw new AppError('VALIDATION_ERROR', errorMessage);
      }
      throw error;
    }

    // Execute use case
    const updateTableUseCase = container.resolve(UpdateTableUseCase);
    const result = await updateTableUseCase.execute(table_id, validatedBody);

    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};
