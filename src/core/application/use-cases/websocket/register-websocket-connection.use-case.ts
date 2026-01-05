import { inject, injectable } from 'tsyringe';
import { IWebSocketConnectionRepository } from '../../../domain/interfaces/websocket-connection-repository.interface';
import { IPaymentSessionRepository } from '../../../domain/interfaces/payment-session-repository.interface';

export interface RegisterWebSocketConnectionInput {
  connectionId: string; // API Gateway connection ID
  domainName?: string;
  stage?: string;
  customConnectionId?: string; // Custom connection ID from PaymentSession
  paymentId?: string;
  userId?: string;
}

@injectable()
export class RegisterWebSocketConnectionUseCase {
  constructor(
    @inject('IWebSocketConnectionRepository')
    private readonly connectionRepository: IWebSocketConnectionRepository,
    @inject('IPaymentSessionRepository')
    private readonly paymentSessionRepository: IPaymentSessionRepository
  ) {}

  async execute(input: RegisterWebSocketConnectionInput): Promise<{ success: boolean; message?: string }> {
    try {
      // If customConnectionId is provided, validate it exists in PaymentSession
      if (input.customConnectionId && input.paymentId) {
        const session = await this.paymentSessionRepository.findByPaymentId(input.paymentId);
        if (session && session.connectionId !== input.customConnectionId) {
          return {
            success: false,
            message: 'Invalid customConnectionId for this payment',
          };
        }
      }

      // Save connection to DynamoDB
      await this.connectionRepository.save({
        connectionId: input.connectionId,
        customConnectionId: input.customConnectionId,
        userId: input.userId,
        paymentId: input.paymentId,
        domainName: input.domainName,
        stage: input.stage,
        connectedAt: new Date().toISOString(),
      });

      // Update PaymentSession with connectionId if paymentId is provided
      if (input.paymentId && input.customConnectionId) {
        try {
          const session = await this.paymentSessionRepository.findByPaymentId(input.paymentId);
          if (session && !session.connectionId) {
            await this.paymentSessionRepository.update(session.id, {
              connectionId: input.customConnectionId,
            });
          }
        } catch (error) {
          console.error('[RegisterWebSocketConnection] Error updating PaymentSession:', error);
          // Don't fail connection registration if update fails
        }
      }

      return { success: true, message: 'Connection registered successfully' };
    } catch (error) {
      console.error('[RegisterWebSocketConnection] Error:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to register connection',
      };
    }
  }
}

