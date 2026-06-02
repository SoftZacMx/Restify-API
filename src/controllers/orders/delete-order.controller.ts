import { Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import { DeleteOrderUseCase } from '../../core/application/use-cases/orders/delete-order.use-case';
import { sendSuccess } from '../../shared/middleware/response-formatter.middleware';
import { AuthenticatedRequest } from '../../server/middleware/auth.middleware';

export const deleteOrderController = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const useCase = container.resolve(DeleteOrderUseCase);
    await useCase.execute({
      order_id: req.params.order_id,
      userId: req.user?.userId ?? null,
    });
    sendSuccess(res, { message: 'Order deleted successfully' });
  } catch (error) {
    next(error);
  }
};
