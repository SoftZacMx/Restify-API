import { Request, Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import { GetReportsSummaryUseCase } from '../../core/application/use-cases/reports/get-reports-summary.use-case';
import { sendSuccess } from '../../shared/middleware/response-formatter.middleware';

export const getReportsSummaryController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dateFrom = req.query.dateFrom as string | undefined;
    const dateTo = req.query.dateTo as string | undefined;

    const getReportsSummaryUseCase = container.resolve(GetReportsSummaryUseCase);
    const result = await getReportsSummaryUseCase.execute({ dateFrom, dateTo });

    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};
