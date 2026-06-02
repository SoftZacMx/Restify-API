import { ListTablesUseCase } from '../../core/application/use-cases/tables/list-tables.use-case';
import { makeController } from '../../shared/utils/make-controller';

export const listTablesController = makeController(ListTablesUseCase, {
  mapper: (req) => req.query,
});
