import { Request, Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import { GetProductUseCase } from '../../core/application/use-cases/products/get-product.use-case';
import { sendSuccess } from '../../shared/middleware/response-formatter.middleware';

export const getProductController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Path parameters are already validated by middleware
    const product_id = req.params.product_id;

    // Execute use case
    const getProductUseCase = container.resolve(GetProductUseCase);
    const result = await getProductUseCase.execute({ product_id: product_id! });

    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};
