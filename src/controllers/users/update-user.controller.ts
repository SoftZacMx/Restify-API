import { Request, Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import { UpdateUserUseCase } from '../../core/application/use-cases/users/update-user.use-case';
import { updateUserSchema } from '../../core/application/dto/user.dto';
import { AppError } from '../../shared/errors';
import { ZodError } from 'zod';
import { sendSuccess } from '../../shared/middleware/response-formatter.middleware';

export const updateUserController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user_id = req.params.user_id;

    if (!user_id) {
      throw new AppError('MISSING_REQUIRED_FIELD', 'User ID is required');
    }

    const bodyData = req.body || {};

    // Validate body data
    let validatedBody;
    try {
      validatedBody = updateUserSchema.parse(bodyData);
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
    const updateUserUseCase = container.resolve(UpdateUserUseCase);
    const result = await updateUserUseCase.execute(user_id, validatedBody);

    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};
