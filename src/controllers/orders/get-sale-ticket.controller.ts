import { Request, Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import { GetSaleTicketUseCase } from '../../core/application/use-cases/tickets/get-sale-ticket.use-case';
import { sendSuccess } from '../../shared/middleware/response-formatter.middleware';

export const getSaleTicketController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const getSaleTicketUseCase = container.resolve(GetSaleTicketUseCase);
    const result = await getSaleTicketUseCase.execute(req.params.order_id);
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};
