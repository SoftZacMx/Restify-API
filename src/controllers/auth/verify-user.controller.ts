import { Request, Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import { VerifyUserUseCase } from '../../core/application/use-cases/auth/verify-user.use-case';
import { sendSuccess } from '../../shared/middleware/response-formatter.middleware';

export const verifyUserController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const verifyUserUseCase = container.resolve(VerifyUserUseCase);
    const result = await verifyUserUseCase.execute(req.body);
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};
