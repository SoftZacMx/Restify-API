import { Request, Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import { ListRefundsUseCase } from '../../core/application/use-cases/refunds/list-refunds.use-case';
import { sendSuccess } from '../../shared/middleware/response-formatter.middleware';

export const listRefundsController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const queryParams = req.query || {};
    const validatedData = {
      paymentId: queryParams.paymentId as string | undefined,
      status: queryParams.status as any,
      dateFrom: queryParams.dateFrom as string | undefined,
      dateTo: queryParams.dateTo as string | undefined,
    };

    const listRefundsUseCase = container.resolve(ListRefundsUseCase);
    const result = await listRefundsUseCase.execute(validatedData);

    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};
