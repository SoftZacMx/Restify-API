import { inject, injectable } from 'tsyringe';
import { IPendingCheckoutRepository } from '../../../domain/interfaces/pending-checkout-repository.interface';
import { GetPublicOrderStatusUseCase, PublicOrderStatus } from './get-public-order-status.use-case';
import { AppError } from '../../../../shared/errors';
import { withoutTenant } from '../../../infrastructure/tenant/tenant-context';

export interface GetPublicCheckoutStatusInput {
  checkoutId: string;
}

@injectable()
export class GetPublicCheckoutStatusUseCase {
  constructor(
    @inject('IPendingCheckoutRepository') private readonly pendingCheckoutRepository: IPendingCheckoutRepository,
    @inject(GetPublicOrderStatusUseCase) private readonly getPublicOrderStatus: GetPublicOrderStatusUseCase
  ) {}

  // El borrador lleva el trackingToken desde que arrancó el checkout, así que esto resuelve
  // aunque el webhook todavía no haya materializado la orden.
  async execute(input: GetPublicCheckoutStatusInput): Promise<PublicOrderStatus> {
    const checkout = await withoutTenant(() =>
      this.pendingCheckoutRepository.findById(input.checkoutId)
    );
    if (!checkout) {
      throw new AppError('ORDER_NOT_FOUND');
    }

    return this.getPublicOrderStatus.execute(checkout.trackingToken);
  }
}
