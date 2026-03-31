import { GetTableUseCase } from '../../core/application/use-cases/tables/get-table.use-case';
import { makeParamsController } from '../../shared/utils/make-controller';

export const getTableController = makeParamsController(GetTableUseCase);
