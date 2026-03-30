import { Request, Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import { CreateUserUseCase } from '../../core/application/use-cases/users/create-user.use-case';
import { sendSuccess } from '../../shared/middleware/response-formatter.middleware';

export const createUserController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Body is already parsed and validated by middlewares
    const validatedData = req.body;

    // Execute use case
    const createUserUseCase = container.resolve(CreateUserUseCase);
    const result = await createUserUseCase.execute(validatedData);

    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};
