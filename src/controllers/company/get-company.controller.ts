import { Request, Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import { GetCompanyUseCase } from '../../core/application/use-cases/company/get-company.use-case';
import { sendSuccess } from '../../shared/middleware/response-formatter.middleware';

export const getCompanyController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const getCompanyUseCase = container.resolve(GetCompanyUseCase);
    const result = await getCompanyUseCase.execute();

    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};
