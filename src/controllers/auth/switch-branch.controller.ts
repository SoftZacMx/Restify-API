import { Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import { SwitchBranchUseCase } from '../../core/application/use-cases/auth/switch-branch.use-case';
import { sendSuccess } from '../../shared/middleware/response-formatter.middleware';
import { AuthenticatedRequest } from '../../server/middleware/auth.middleware';

export const switchBranchController = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      throw new Error('User not authenticated');
    }

    const switchBranchUseCase = container.resolve(SwitchBranchUseCase);
    const result = await switchBranchUseCase.execute({
      branchId: req.body.branchId,
      currentUser: req.user,
    });

    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};
