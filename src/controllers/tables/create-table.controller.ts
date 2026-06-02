import { CreateTableUseCase } from '../../core/application/use-cases/tables/create-table.use-case';
import { makeController } from '../../shared/utils/make-controller';

export const createTableController = makeController(CreateTableUseCase);
