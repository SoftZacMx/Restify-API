import { inject, injectable } from 'tsyringe';
import { IWebSocketConnectionRepository } from '../../../domain/interfaces/websocket-connection-repository.interface';

export interface UnregisterWebSocketConnectionInput {
  connectionId: string; // API Gateway connection ID
}

@injectable()
export class UnregisterWebSocketConnectionUseCase {
  constructor(
    @inject('IWebSocketConnectionRepository')
    private readonly connectionRepository: IWebSocketConnectionRepository
  ) {}

  async execute(input: UnregisterWebSocketConnectionInput): Promise<{ success: boolean }> {
    try {
      await this.connectionRepository.delete(input.connectionId);
      return { success: true };
    } catch (error) {
      console.error('[UnregisterWebSocketConnection] Error:', error);
      // Still return success to avoid retries on disconnect
      return { success: true };
    }
  }
}

