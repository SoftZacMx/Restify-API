import { Request, Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import { LogoutUseCase } from '../../core/application/use-cases/auth/logout.use-case';
import { sendSuccess } from '../../shared/middleware/response-formatter.middleware';

export const logoutController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const logoutUseCase = container.resolve(LogoutUseCase);
    const result = await logoutUseCase.execute();
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};
