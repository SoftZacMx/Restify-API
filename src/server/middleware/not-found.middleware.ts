import { Request, Response } from 'express';

export class NotFoundMiddleware {
  static handle(req: Request, res: Response): void {
    res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Route ${req.method} ${req.path} not found`,
      },
      timestamp: new Date().toISOString(),
    });
  }
}

