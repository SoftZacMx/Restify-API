import { Request, Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import { UpdateOrderUseCase } from '../../core/application/use-cases/orders/update-order.use-case';
import { updateOrderSchema } from '../../core/application/dto/order.dto';
import { AppError } from '../../shared/errors';
import { ZodError } from 'zod';
import { sendSuccess } from '../../shared/middleware/response-formatter.middleware';

export const updateOrderController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { order_id } = req.params;

    if (!order_id) {
      throw new AppError('MISSING_REQUIRED_FIELD', 'Order ID is required');
    }

    let validatedBody;
    try {
      validatedBody = updateOrderSchema.parse(req.body || {});
    } catch (error) {
      if (error instanceof ZodError) {
        const errorMessage = error.errors
          .map((e) => `${e.path.join('.')}: ${e.message}`)
          .join(', ');
        throw new AppError('VALIDATION_ERROR', errorMessage);
      }
      throw error;
    }

    const updateOrderUseCase = container.resolve(UpdateOrderUseCase);
    const result = await updateOrderUseCase.execute(order_id, validatedBody);
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};
