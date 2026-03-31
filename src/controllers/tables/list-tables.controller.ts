import { ListTablesUseCase } from '../../core/application/use-cases/tables/list-tables.use-case';
import { makeQueryController } from '../../shared/utils/make-controller';

export const listTablesController = makeQueryController(ListTablesUseCase);
