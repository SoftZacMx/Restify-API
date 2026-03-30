import { Request, Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import { GetDashboardUseCase } from '../../core/application/use-cases/dashboard/get-dashboard.use-case';
import { sendSuccess } from '../../shared/middleware/response-formatter.middleware';

export const getDashboardController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const getDashboardUseCase = container.resolve(GetDashboardUseCase);
    const result = await getDashboardUseCase.execute();

    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};
