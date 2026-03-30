import { Request, Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import { ListPaymentsUseCase } from '../../core/application/use-cases/payments/list-payments.use-case';
import { sendSuccess } from '../../shared/middleware/response-formatter.middleware';

export const listPaymentsController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const queryParams = req.query as Record<string, string>;
    const validatedData = {
      orderId: queryParams.orderId,
      userId: queryParams.userId,
      status: queryParams.status as any,
      paymentMethod: queryParams.paymentMethod as any,
      dateFrom: queryParams.dateFrom,
      dateTo: queryParams.dateTo,
    };

    const useCase = container.resolve(ListPaymentsUseCase);
    const result = await useCase.execute(validatedData);
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};
