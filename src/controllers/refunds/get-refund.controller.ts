import { GetRefundUseCase } from '../../core/application/use-cases/refunds/get-refund.use-case';
import { makeController } from '../../shared/utils/make-controller';

export const getRefundController = makeController(GetRefundUseCase, {
  mapper: (req) => req.params,
});
