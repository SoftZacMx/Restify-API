import { Request, Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import { GetKitchenTicketUseCase } from '../../core/application/use-cases/tickets/get-kitchen-ticket.use-case';
import { sendSuccess } from '../../shared/middleware/response-formatter.middleware';

export const getKitchenTicketController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const getKitchenTicketUseCase = container.resolve(GetKitchenTicketUseCase);
    const result = await getKitchenTicketUseCase.execute(req.params.order_id);
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};
