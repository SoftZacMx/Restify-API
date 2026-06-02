import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '../../shared/middleware/response-formatter.middleware';

export const getConfigController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const config = {
      billingEnabled: process.env.BILLING_ENABLED === 'true',
      environment: process.env.NODE_ENV || 'development',
      apiVersion: process.env.APP_VERSION || '1.0.0',
    };

    sendSuccess(res, config);
  } catch (error) {
    next(error);
  }
};
