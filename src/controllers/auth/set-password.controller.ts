import { Request, Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import { SetPasswordUseCase } from '../../core/application/use-cases/auth/set-password.use-case';
import { setPasswordSchema } from '../../core/application/dto/auth.dto';
import { AppError } from '../../shared/errors';
import { ZodError } from 'zod';
import { sendSuccess } from '../../shared/middleware/response-formatter.middleware';

export const setPasswordController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { user_id } = req.params;

    if (!user_id) {
      throw new AppError('MISSING_REQUIRED_FIELD', 'User ID is required');
    }

    const dataToValidate = {
      ...req.body,
      user_id,
    };

    let validatedData;
    try {
      validatedData = setPasswordSchema.parse(dataToValidate);
    } catch (error) {
      if (error instanceof ZodError) {
        const errorMessage = error.errors
          .map((e) => `${e.path.join('.')}: ${e.message}`)
          .join(', ');
        throw new AppError('VALIDATION_ERROR', errorMessage);
      }
      throw error;
    }

    const setPasswordUseCase = container.resolve(SetPasswordUseCase);
    await setPasswordUseCase.execute(validatedData);

    sendSuccess(res, { message: 'Password updated successfully' });
  } catch (error) {
    next(error);
  }
};
