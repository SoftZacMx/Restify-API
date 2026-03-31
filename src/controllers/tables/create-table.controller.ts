import { CreateTableUseCase } from '../../core/application/use-cases/tables/create-table.use-case';
import { makeBodyController } from '../../shared/utils/make-controller';

export const createTableController = makeBodyController(CreateTableUseCase);
