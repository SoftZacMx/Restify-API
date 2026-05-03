import { Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import { UpdateOrderUseCase } from '../../core/application/use-cases/orders/update-order.use-case';
import { sendSuccess } from '../../shared/middleware/response-formatter.middleware';
import { AuthenticatedRequest } from '../../server/middleware/auth.middleware';

export const updateOrderController = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const useCase = container.resolve(UpdateOrderUseCase);
    const result = await useCase.execute(
      req.params.order_id,
      req.body,
      req.user?.userId ?? null
    );
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};
