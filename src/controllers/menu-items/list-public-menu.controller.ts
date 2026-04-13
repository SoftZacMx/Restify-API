import { Request, Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import { ListPublicMenuUseCase } from '../../core/application/use-cases/menu-items/list-public-menu.use-case';
import { sendSuccess } from '../../shared/middleware/response-formatter.middleware';

export const listPublicMenuController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const useCase = container.resolve(ListPublicMenuUseCase);
    const result = await useCase.execute();
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};
