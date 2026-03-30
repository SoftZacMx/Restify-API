import { Request, Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import { ReactivateUserUseCase } from '../../core/application/use-cases/users/reactivate-user.use-case';
import { sendSuccess } from '../../shared/middleware/response-formatter.middleware';

export const reactivateUserController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user_id = req.params.user_id;

    // Execute use case
    const reactivateUserUseCase = container.resolve(ReactivateUserUseCase);
    await reactivateUserUseCase.execute({ user_id: user_id! });

    sendSuccess(res, { message: 'User reactivated successfully' });
  } catch (error) {
    next(error);
  }
};
