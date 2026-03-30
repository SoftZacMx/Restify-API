import { Request, Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import { ListProductsUseCase } from '../../core/application/use-cases/products/list-products.use-case';
import { sendSuccess } from '../../shared/middleware/response-formatter.middleware';

export const listProductsController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Query parameters are already validated by middleware
    const queryParams = req.query || {};

    // Execute use case
    const listProductsUseCase = container.resolve(ListProductsUseCase);
    const result = await listProductsUseCase.execute(queryParams);

    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};
