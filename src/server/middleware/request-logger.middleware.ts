import { Request, Response, NextFunction } from 'express';

export class RequestLoggerMiddleware {
  static handle(req: Request, res: Response, next: NextFunction): void {
    const start = Date.now();

    // Log request
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);

    // Log response when finished
    res.on('finish', () => {
      const duration = Date.now() - start;
      console.log(
        `[${new Date().toISOString()}] ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`
      );
    });

    next();
  }
}

