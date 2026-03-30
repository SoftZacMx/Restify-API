import { Request, Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import { ListUsersUseCase } from '../../core/application/use-cases/users/list-users.use-case';
import { sendSuccess } from '../../shared/middleware/response-formatter.middleware';

export const listUsersController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const queryParams = req.query || {};

    // Execute use case
    const listUsersUseCase = container.resolve(ListUsersUseCase);
    const result = await listUsersUseCase.execute(queryParams);

    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};
