import { Request, Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import { GetPublicOrderStatusUseCase } from '../../core/application/use-cases/orders/get-public-order-status.use-case';
import { sendSuccess } from '../../shared/middleware/response-formatter.middleware';

export const getPublicOrderStatusController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const useCase = container.resolve(GetPublicOrderStatusUseCase);
    const result = await useCase.execute(req.params.trackingToken);
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};

/**
 * Status por orderId (retorno de Mercado Pago). La back_url trae el orderId en el
 * external_reference; este endpoint permite mostrar/redirigir al seguimiento aunque
 * el cliente haya perdido el trackingToken (webview de MP con storage distinto).
 */
export const getPublicOrderStatusByIdController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const useCase = container.resolve(GetPublicOrderStatusUseCase);
    const result = await useCase.executeByOrderId(req.params.orderId);
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};
