import { Request, Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import { GetUserUseCase } from '../../core/application/use-cases/users/get-user.use-case';
import { sendSuccess } from '../../shared/middleware/response-formatter.middleware';

export const getUserController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user_id = req.params.user_id;

    // Execute use case
    const getUserUseCase = container.resolve(GetUserUseCase);
    const result = await getUserUseCase.execute({ user_id });

    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};
