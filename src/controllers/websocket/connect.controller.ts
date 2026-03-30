import { Request, Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import { RegisterWebSocketConnectionUseCase } from '../../core/application/use-cases/websocket/register-websocket-connection.use-case';
import { sendSuccess } from '../../shared/middleware/response-formatter.middleware';

export const connectController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const queryParams = req.query as Record<string, string>;
    const registerUseCase = container.resolve(RegisterWebSocketConnectionUseCase);
    const result = await registerUseCase.execute({
      connectionId: queryParams.connectionId || '',
      domainName: req.headers.host || '',
      stage: process.env.NODE_ENV || 'development',
      customConnectionId: queryParams.connectionId,
      paymentId: queryParams.paymentId,
      userId: queryParams.userId,
    });

    if (!result.success) {
      res.status(401).json({ message: result.message || 'Connection rejected' });
      return;
    }

    sendSuccess(res, { message: 'Connected successfully' });
  } catch (error) {
    next(error);
  }
};
