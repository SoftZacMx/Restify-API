import { inject, injectable } from 'tsyringe';
import { ExpenseType } from '@prisma/client';
import { IExpenseRepository } from '../../../domain/interfaces/expense-repository.interface';

export interface CreateMercadoPagoFeeExpenseInput {
  /** ID del Payment local (no el de MP). Sirve como clave de idempotencia. */
  paymentId: string;
  /** orderId de la orden a la que pertenece el pago — usado solo en la descripción. */
  orderId: string | null;
  /** ID del pago en Mercado Pago — usado solo en la descripción para auditoría. */
  mpPaymentId: number;
  /** Suma de comisiones cobradas por MP en la moneda del pago. */
  feeAmount: number;
  /** Fecha en que MP aprobó el pago; si no se provee se usa now(). */
  date?: Date;
}

export interface CreateMercadoPagoFeeExpenseResult {
  expenseId: string | null;
  /** True si se creó un nuevo gasto; false si ya existía (idempotencia) o no aplica. */
  created: boolean;
}

@injectable()
export class CreateMercadoPagoFeeExpenseUseCase {
  constructor(
    @inject('IExpenseRepository') private readonly expenseRepository: IExpenseRepository
  ) {}

  async execute(input: CreateMercadoPagoFeeExpenseInput): Promise<CreateMercadoPagoFeeExpenseResult> {
    if (input.feeAmount <= 0) {
      return { expenseId: null, created: false };
    }

    const existing = await this.expenseRepository.findByPaymentId(input.paymentId);
    if (existing) {
      return { expenseId: existing.id, created: false };
    }

    const orderRef = input.orderId ? ` - Orden ${input.orderId}` : '';
    const title = `Comisión Mercado Pago${orderRef}`;
    const description = `Comisión cobrada por Mercado Pago al confirmar el pago ${input.mpPaymentId}.`;

    const expense = await this.expenseRepository.create({
      title,
      type: ExpenseType.MERCADO_PAGO_FEE,
      date: input.date ?? new Date(),
      total: input.feeAmount,
      subtotal: input.feeAmount,
      iva: 0,
      description,
      paymentMethod: 2, // 2 = Transferencia (MP descuenta del depósito)
      userId: null,
      paymentId: input.paymentId,
    });

    return { expenseId: expense.id, created: true };
  }
}
