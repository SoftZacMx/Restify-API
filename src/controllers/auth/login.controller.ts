import { Request, Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import { LoginUseCase } from '../../core/application/use-cases/auth/login.use-case';
import { sendSuccess } from '../../shared/middleware/response-formatter.middleware';

export const loginController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const loginUseCase = container.resolve(LoginUseCase);
    const result = await loginUseCase.execute(req.body, req.params.rol);
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};
