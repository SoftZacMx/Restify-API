import { inject, injectable } from 'tsyringe';
import { IPaymentSessionRepository } from '../../../domain/interfaces/payment-session-repository.interface';
import { GetPaymentSessionInput } from '../../dto/payment.dto';
import { AppError } from '../../../../shared/errors';

export interface GetPaymentSessionResult {
  id: string;
  paymentId: string;
  clientSecret: string;
  connectionId: string | null;
  expiresAt: Date;
  createdAt: Date;
}

@injectable()
export class GetPaymentSessionUseCase {
  constructor(
    @inject('IPaymentSessionRepository') private readonly paymentSessionRepository: IPaymentSessionRepository
  ) {}

  async execute(input: GetPaymentSessionInput): Promise<GetPaymentSessionResult> {
    const session = await this.paymentSessionRepository.findByPaymentId(input.payment_id);

    if (!session) {
      throw new AppError('PAYMENT_SESSION_NOT_FOUND');
    }

    // Check if session is expired
    if (session.expiresAt < new Date()) {
      throw new AppError('PAYMENT_SESSION_EXPIRED');
    }

    return {
      id: session.id,
      paymentId: session.paymentId,
      clientSecret: session.clientSecret,
      connectionId: session.connectionId,
      expiresAt: session.expiresAt,
      createdAt: session.createdAt,
    };
  }
}

