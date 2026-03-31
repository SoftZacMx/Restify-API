import { DeleteTableUseCase } from '../../core/application/use-cases/tables/delete-table.use-case';
import { makeDeleteController } from '../../shared/utils/make-controller';

export const deleteTableController = makeDeleteController(DeleteTableUseCase, 'Table deleted successfully');
