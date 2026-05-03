import { Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import { AuthenticatedRequest } from '../../server/middleware/auth.middleware';
import { sendSuccess } from '../../shared/middleware/response-formatter.middleware';
import { AppError } from '../../shared/errors';
import { ListStockUseCase } from '../../core/application/use-cases/stock/list-stock.use-case';
import { ListStockAlertsUseCase } from '../../core/application/use-cases/stock/list-stock-alerts.use-case';
import { ListMovementsUseCase } from '../../core/application/use-cases/stock/list-movements.use-case';
import { RecordWasteUseCase } from '../../core/application/use-cases/stock/record-waste.use-case';
import { RecordAdjustmentUseCase } from '../../core/application/use-cases/stock/record-adjustment.use-case';
import { UpdateStockConfigUseCase } from '../../core/application/use-cases/stock/update-stock-config.use-case';
import { WasteReportUseCase } from '../../core/application/use-cases/stock/reports/waste-report.use-case';
import { ProductsConsumptionReportUseCase } from '../../core/application/use-cases/stock/reports/products-consumption-report.use-case';
import { MenuItemsCostReportUseCase } from '../../core/application/use-cases/stock/reports/menu-items-cost-report.use-case';

function getUserId(req: AuthenticatedRequest): string {
  const userId = req.user?.userId;
  if (!userId) throw new AppError('UNAUTHORIZED', 'Authenticated user is required');
  return userId;
}

export const listStockController = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const useCase = container.resolve(ListStockUseCase);
    const result = await useCase.execute(req.query as any);
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};

export const listStockAlertsController = async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const useCase = container.resolve(ListStockAlertsUseCase);
    const result = await useCase.execute();
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};

export const listMovementsController = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const useCase = container.resolve(ListMovementsUseCase);
    const result = await useCase.execute(req.query as any);
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};

export const listProductMovementsController = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const useCase = container.resolve(ListMovementsUseCase);
    const result = await useCase.execute({ ...(req.query as any), productId: req.params.product_id });
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};

export const recordWasteController = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    const useCase = container.resolve(RecordWasteUseCase);
    const result = await useCase.execute({ ...req.body, userId });
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};

export const recordAdjustmentController = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    const useCase = container.resolve(RecordAdjustmentUseCase);
    const result = await useCase.execute({ ...req.body, userId });
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};

export const updateStockConfigController = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const useCase = container.resolve(UpdateStockConfigUseCase);
    const result = await useCase.execute(req.params.product_id, req.body);
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};

export const wasteReportController = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const useCase = container.resolve(WasteReportUseCase);
    const { from, to } = req.query;
    const result = await useCase.execute({
      from: from ? new Date(from as string) : undefined,
      to: to ? new Date(to as string) : undefined,
    });
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};

export const productsConsumptionReportController = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const useCase = container.resolve(ProductsConsumptionReportUseCase);
    const { from, to, top } = req.query;
    const result = await useCase.execute({
      from: from ? new Date(from as string) : undefined,
      to: to ? new Date(to as string) : undefined,
      top: top ? Number(top) : undefined,
    });
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};

export const menuItemsCostReportController = async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const useCase = container.resolve(MenuItemsCostReportUseCase);
    const result = await useCase.execute();
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};
