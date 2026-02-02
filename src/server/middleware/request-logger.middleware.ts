import { Request, Response, NextFunction } from 'express';

export class RequestLoggerMiddleware {
  static handle(req: Request, res: Response, next: NextFunction): void {
    next();
  }
}

