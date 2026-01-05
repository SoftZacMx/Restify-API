import { injectable } from 'tsyringe';

/**
 * Logout Use Case
 * Handles logout business logic
 * Currently simple, but can be extended for:
 * - Token blacklisting
 * - Session invalidation
 * - Audit logging
 */
@injectable()
export class LogoutUseCase {
  async execute(): Promise<{ message: string }> {
    // Future: Could add token blacklisting, session cleanup, etc.
    return { message: 'Logged out successfully' };
  }
}

