import { UpdateTableUseCase } from '../../core/application/use-cases/tables/update-table.use-case';
import { makeParamBodyController } from '../../shared/utils/make-controller';

export const updateTableController = makeParamBodyController(UpdateTableUseCase, 'table_id');
