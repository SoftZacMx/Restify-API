import { SendVerificationEmailUseCase } from '../../../../src/core/application/use-cases/auth/send-verification-email.use-case';
import { EmailService } from '../../../../src/core/infrastructure/messaging/email.service';
import { JwtUtil } from '../../../../src/shared/utils/jwt.util';

jest.mock('../../../../src/shared/utils/jwt.util');

describe('SendVerificationEmailUseCase', () => {
  let useCase: SendVerificationEmailUseCase;
  let mockEmailService: jest.Mocked<EmailService>;
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV, APP_URL: 'https://app.restify.test' };

    mockEmailService = {
      send: jest.fn(),
    } as unknown as jest.Mocked<EmailService>;

    useCase = new SendVerificationEmailUseCase(mockEmailService);

    (JwtUtil.generateEmailVerificationToken as jest.Mock).mockReturnValue('signed-token');
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
    jest.clearAllMocks();
  });

  it('generates a verification token and sends an email with the link', async () => {
    await useCase.execute({ userId: 'user-1', email: 'john@example.com', name: 'John' });

    expect(JwtUtil.generateEmailVerificationToken).toHaveBeenCalledWith({
      sub: 'user-1',
      email: 'john@example.com',
    });

    expect(mockEmailService.send).toHaveBeenCalledTimes(1);
    const arg = mockEmailService.send.mock.calls[0][0];
    expect(arg.to).toBe('john@example.com');
    expect(arg.subject).toContain('Confirma tu correo');
    expect(arg.html).toContain('https://app.restify.test/verify-email?token=signed-token');
    expect(arg.html).toContain('Hola John,');
  });

  it('uses a neutral greeting when no name is provided', async () => {
    await useCase.execute({ userId: 'user-1', email: 'john@example.com' });

    const arg = mockEmailService.send.mock.calls[0][0];
    expect(arg.html).toContain('Hola,');
  });
});
