import { Request, Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import { GenerateReportUseCase } from '../../core/application/use-cases/reports/generate-report.use-case';
import { GenerateReportInput } from '../../core/application/dto/report.dto';
import { sendSuccess } from '../../shared/middleware/response-formatter.middleware';

export const generateReportController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // req.query ya fue validado y transformado por zodValidator en la ruta
    const validatedData = req.query as unknown as GenerateReportInput;

    const generateReportUseCase = container.resolve(GenerateReportUseCase);
    const result = await generateReportUseCase.execute(validatedData);

    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};
