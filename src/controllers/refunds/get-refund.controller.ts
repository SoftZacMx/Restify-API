import { GetRefundUseCase } from '../../core/application/use-cases/refunds/get-refund.use-case';
import { makeParamsController } from '../../shared/utils/make-controller';

export const getRefundController = makeParamsController(GetRefundUseCase);
