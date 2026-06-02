import { UpdateTableUseCase } from '../../core/application/use-cases/tables/update-table.use-case';
import { makeController } from '../../shared/utils/make-controller';

export const updateTableController = makeController(UpdateTableUseCase, {
  mapper: (req) => [req.params.table_id, req.body],
});
