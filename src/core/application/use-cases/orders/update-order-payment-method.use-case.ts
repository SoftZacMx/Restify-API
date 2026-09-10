import { inject, injectable } from 'tsyringe';
import { PaymentMethod, PaymentStatus } from '@prisma/client';
import { getPrisma } from '../../../infrastructure/database/prisma/get-prisma';
import { IOrderRepository } from '../../../domain/interfaces/order-repository.interface';
import { UpdateOrderPaymentMethodInput } from '../../dto/order.dto';
import { AppError } from '../../../../shared/errors';

const ORDER_INT_BY_PAYMENT_METHOD: Record<UpdateOrderPaymentMethodInput['paymentMethod'], number> = {
  CASH: 1,
  TRANSFER: 2,
  CARD_PHYSICAL: 3,
};

export interface UpdateOrderPaymentMethodResult {
  id: string;
  previousPaymentMethod: number | null;
  paymentMethod: number;
}

@injectable()
export class UpdateOrderPaymentMethodUseCase {
  constructor(
    @inject('IOrderRepository') private readonly orderRepository: IOrderRepository
  ) {}

  async execute(
    orderId: string,
    input: UpdateOrderPaymentMethodInput
  ): Promise<UpdateOrderPaymentMethodResult> {
    const order = await this.orderRepository.findById(orderId);
    if (!order) {
      throw new AppError('ORDER_NOT_FOUND');
    }

    if (!order.status) {
      throw new AppError(
        'VALIDATION_ERROR',
        'Only completed orders can change their payment method'
      );
    }

    if (order.paymentDiffer) {
      throw new AppError(
        'VALIDATION_ERROR',
        'Split payments cannot change their payment method'
      );
    }

    const paymentMethod = ORDER_INT_BY_PAYMENT_METHOD[input.paymentMethod];

    // El flujo de caja lee el método desde `payments` cuando esas filas existen,
    // así que orden y pagos tienen que quedar con el mismo método.
    await getPrisma().$transaction(async (tx) => {
      await tx.order.update({
        where: { id: orderId },
        data: { paymentMethod },
      });

      await tx.payment.updateMany({
        where: { orderId, status: PaymentStatus.SUCCEEDED },
        data: { paymentMethod: PaymentMethod[input.paymentMethod] },
      });
    });

    return {
      id: order.id,
      previousPaymentMethod: order.paymentMethod,
      paymentMethod,
    };
  }
}
