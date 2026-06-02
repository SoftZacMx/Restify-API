import { ListPublicMenuUseCase } from '../../core/application/use-cases/menu-items/list-public-menu.use-case';
import { makeController } from '../../shared/utils/make-controller';

export const listPublicMenuController = makeController(ListPublicMenuUseCase, {
  mapper: () => ({}),
});
