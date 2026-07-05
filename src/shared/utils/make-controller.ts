import { Request, Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import { sendSuccess } from '../middleware/response-formatter.middleware';
import { logger } from './logger';

type Constructor<T> = new (...args: any[]) => T;

/**
 * Options for customizing controller behavior
 */
export interface ControllerOptions {
  /**
   * Function to map request to use case input
   * @default (req) => req.body
   */
  mapper?: (req: Request) => any;

  /**
   * Function to map use case result to response data
   * Useful for cases like delete operations that need custom messages
   */
  responseMapper?: (result: any) => any;

  /**
   * Whether this controller requires authentication (req.user)
   * If true, will extract userId and role from req.user
   */
  requireAuth?: boolean;
}

/**
 * Universal controller factory
 *
 * Creates a controller that:
 * 1. Resolves the use case from DI container
 * 2. Maps request to use case input using mapper function
 * 3. Executes the use case
 * 4. Sends success response
 *
 * @example
 * // Body controller
 * makeController(LoginUseCase)
 *
 * @example
 * // Query controller
 * makeController(ListOrdersUseCase, { mapper: req => req.query })
 *
 * @example
 * // Params controller
 * makeController(GetOrderUseCase, { mapper: req => req.params })
 *
 * @example
 * // No input controller
 * makeController(GetDashboardUseCase, { mapper: () => ({}) })
 *
 * @example
 * // Delete controller with custom message
 * makeController(DeleteOrderUseCase, {
 *   mapper: req => req.params,
 *   responseMapper: () => ({ message: 'Order deleted successfully' })
 * })
 *
 * @example
 * // Single param controller
 * makeController(GetOrderUseCase, { mapper: req => req.params.order_id })
 *
 * @example
 * // Param + body controller
 * makeController(UpdateOrderUseCase, {
 *   mapper: req => ({ id: req.params.order_id, ...req.body })
 * })
 */
export function makeController<T extends { execute: (...args: any[]) => Promise<any> }>(
  UseCaseClass: Constructor<T>,
  options: ControllerOptions = {}
) {
  const {
    mapper = req => req.body,
    responseMapper = result => result,
    requireAuth = false,
  } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Traza mínima del request. No se loguean credenciales (JWT en Authorization/cookie)
      // ni el payload completo del usuario: solo identificadores no sensibles de tenant.
      const reqUser = (req as any).user;
      logger.info({
        useCaseName: UseCaseClass.name,
        userId: reqUser?.sub,
        rol: reqUser?.rol,
        org: reqUser?.org,
        branch: reqUser?.branch,
        authenticated: !!reqUser,
      }, '[DEBUG] makeController invoked');

      const useCase = container.resolve(UseCaseClass);
      let input = mapper(req);

      // If auth is required, validate and inject userId/role
      if (requireAuth) {
        const user = (req as any).user;
        if (!user?.sub || !user?.rol) {
          return res.status(401).json({ success: false, error: 'UNAUTHORIZED' });
        }
        // Auto-inject userId and role into input
        // If input is an array (multiple args), inject into first object arg
        if (Array.isArray(input)) {
          input = [
            input[0],
            { ...input[1], userId: user.sub, role: user.rol },
            ...input.slice(2),
          ];
        } else {
          input = {
            ...input,
            userId: user.sub,
            role: user.rol,
          };
        }
      }

      // Support both single object input and multiple args (for legacy use cases)
      const result = Array.isArray(input)
        ? await useCase.execute(...input)
        : await useCase.execute(input);
      const responseData = responseMapper(result);

      sendSuccess(res, responseData);
    } catch (error) {
      next(error);
    }
  };
}
