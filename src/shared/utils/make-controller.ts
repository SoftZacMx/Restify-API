import { Request, Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import { sendSuccess } from '../middleware/response-formatter.middleware';

type Constructor<T> = new (...args: any[]) => T;

/**
 * Factory for controllers that execute a use case with req.body.
 * Pattern: resolve → execute(req.body) → sendSuccess
 */
export function makeBodyController<T extends { execute: (input: any) => Promise<any> }>(
  UseCaseClass: Constructor<T>
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const useCase = container.resolve(UseCaseClass);
      const result = await useCase.execute(req.body);
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Factory for controllers that execute a use case with req.query.
 * Pattern: resolve → execute(req.query) → sendSuccess
 */
export function makeQueryController<T extends { execute: (input: any) => Promise<any> }>(
  UseCaseClass: Constructor<T>
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const useCase = container.resolve(UseCaseClass);
      const result = await useCase.execute(req.query || {});
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Factory for controllers that execute a use case with req.params.
 * Pattern: resolve → execute(req.params) → sendSuccess
 */
export function makeParamsController<T extends { execute: (input: any) => Promise<any> }>(
  UseCaseClass: Constructor<T>
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const useCase = container.resolve(UseCaseClass);
      const result = await useCase.execute(req.params);
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Factory for controllers that execute a use case with a param ID + req.body.
 * Pattern: resolve → execute(req.params[paramName], req.body) → sendSuccess
 */
export function makeParamBodyController<T extends { execute: (id: string, input: any) => Promise<any> }>(
  UseCaseClass: Constructor<T>,
  paramName: string
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const useCase = container.resolve(UseCaseClass);
      const result = await useCase.execute(req.params[paramName], req.body);
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Factory for delete controllers that execute a use case with req.params and return a message.
 * Pattern: resolve → execute(req.params) → sendSuccess({ message })
 */
export function makeDeleteController<T extends { execute: (input: any) => Promise<any> }>(
  UseCaseClass: Constructor<T>,
  message: string
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const useCase = container.resolve(UseCaseClass);
      await useCase.execute(req.params);
      sendSuccess(res, { message });
    } catch (error) {
      next(error);
    }
  };
}
