import { GetTableUseCase } from '../../core/application/use-cases/tables/get-table.use-case';
import { makeController } from '../../shared/utils/make-controller';

export const getTableController = makeController(GetTableUseCase, {
  mapper: (req) => req.params,
});
