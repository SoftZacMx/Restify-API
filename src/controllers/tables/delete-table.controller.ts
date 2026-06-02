import { DeleteTableUseCase } from '../../core/application/use-cases/tables/delete-table.use-case';
import { makeController } from '../../shared/utils/make-controller';

export const deleteTableController = makeController(DeleteTableUseCase, {
  mapper: (req) => req.params,
  responseMapper: () => ({ message: 'Table deleted successfully' }),
});
