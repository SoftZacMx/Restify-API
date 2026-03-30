import { Request, Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import { UnregisterWebSocketConnectionUseCase } from '../../core/application/use-cases/websocket/unregister-websocket-connection.use-case';
import { sendSuccess } from '../../shared/middleware/response-formatter.middleware';

export const disconnectController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { connectionId } = req.query as Record<string, string>;
    const unregisterUseCase = container.resolve(UnregisterWebSocketConnectionUseCase);
    await unregisterUseCase.execute({ connectionId });

    sendSuccess(res, { message: 'Disconnected successfully' });
  } catch (error) {
    next(error);
  }
};
