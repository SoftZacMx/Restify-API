import { Request, Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import { UpsertCompanyUseCase } from '../../core/application/use-cases/company/upsert-company.use-case';
import { sendSuccess } from '../../shared/middleware/response-formatter.middleware';

export const upsertCompanyController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const validatedData = req.body;
    const upsertCompanyUseCase = container.resolve(UpsertCompanyUseCase);
    const result = await upsertCompanyUseCase.execute(validatedData);

    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};
