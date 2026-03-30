import { Request, Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import { DeleteProductUseCase } from '../../core/application/use-cases/products/delete-product.use-case';
import { sendSuccess } from '../../shared/middleware/response-formatter.middleware';

export const deleteProductController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Path parameters are already validated by middleware
    const product_id = req.params.product_id;

    // Execute use case
    const deleteProductUseCase = container.resolve(DeleteProductUseCase);
    await deleteProductUseCase.execute({ product_id: product_id! });

    sendSuccess(res, { message: 'Product deleted successfully' });
  } catch (error) {
    next(error);
  }
};
