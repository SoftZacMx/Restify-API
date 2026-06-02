import { GetDashboardUseCase } from '../../core/application/use-cases/dashboard/get-dashboard.use-case';
import { makeController } from '../../shared/utils/make-controller';

export const getDashboardController = makeController(GetDashboardUseCase, { mapper: () => ({}) });
