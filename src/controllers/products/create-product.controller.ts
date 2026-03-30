import { Request, Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import { CreateProductUseCase } from '../../core/application/use-cases/products/create-product.use-case';
import { sendSuccess } from '../../shared/middleware/response-formatter.middleware';

export const createProductController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Body is already parsed and validated by middlewares
    const validatedData = req.body;

    // Execute use case
    const createProductUseCase = container.resolve(CreateProductUseCase);
    const result = await createProductUseCase.execute(validatedData);

    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};
