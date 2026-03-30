import { Request, Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import { DeleteOrderUseCase } from '../../core/application/use-cases/orders/delete-order.use-case';
import { sendSuccess } from '../../shared/middleware/response-formatter.middleware';

export const deleteOrderController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const deleteOrderUseCase = container.resolve(DeleteOrderUseCase);
    await deleteOrderUseCase.execute({ order_id: req.params.order_id });
    sendSuccess(res, { message: 'Order deleted successfully' });
  } catch (error) {
    next(error);
  }
};
