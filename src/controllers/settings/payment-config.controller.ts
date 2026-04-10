import { Request, Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import { z } from 'zod';
import { GetPaymentConfigUseCase } from '../../core/application/use-cases/settings/get-payment-config.use-case';
import { SavePaymentConfigUseCase } from '../../core/application/use-cases/settings/save-payment-config.use-case';
import { sendSuccess } from '../../shared/middleware/response-formatter.middleware';
import { AppError } from '../../shared/errors';

const savePaymentConfigSchema = z.object({
  mercadoPago: z.object({
    accessToken: z.string().optional(),
    webhookSecret: z.string().optional(),
  }).optional(),
});

export const getPaymentConfigController = async (
  _req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const useCase = container.resolve(GetPaymentConfigUseCase);
    const result = await useCase.execute();
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};

export const savePaymentConfigController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const parsed = savePaymentConfigSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError('VALIDATION_ERROR', 'Datos de configuración inválidos');
    }

    const useCase = container.resolve(SavePaymentConfigUseCase);
    await useCase.execute(parsed.data);
    sendSuccess(res, { message: 'Configuración de pagos actualizada' });
  } catch (error) {
    next(error);
  }
};
