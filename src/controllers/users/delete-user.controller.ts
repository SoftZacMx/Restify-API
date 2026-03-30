import { Request, Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import { DeleteUserUseCase } from '../../core/application/use-cases/users/delete-user.use-case';
import { sendSuccess } from '../../shared/middleware/response-formatter.middleware';

export const deleteUserController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user_id = req.params.user_id;

    // Execute use case
    const deleteUserUseCase = container.resolve(DeleteUserUseCase);
    await deleteUserUseCase.execute({ user_id: user_id! });

    sendSuccess(res, { message: 'User deleted successfully' });
  } catch (error) {
    next(error);
  }
};
