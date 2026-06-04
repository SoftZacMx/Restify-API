import { EmailService } from '../../../src/core/infrastructure/messaging/email.service';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

// Mock del SDK de SES a nivel de módulo.
jest.mock('@aws-sdk/client-ses', () => ({
  SESClient: jest.fn(),
  SendEmailCommand: jest.fn(),
}));

describe('EmailService', () => {
  let mockSend: jest.Mock;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    process.env.AWS_REGION = 'us-east-1';
    process.env.EMAIL_FROM = 'no-reply@restify.app';

    mockSend = jest.fn();
    (SESClient as unknown as jest.Mock).mockImplementation(() => ({ send: mockSend }));
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.clearAllMocks();
  });

  const params = { to: 'user@example.com', subject: 'Hola', html: '<p>Hola</p>' };

  describe('when EMAIL_ENABLED=true', () => {
    beforeEach(() => {
      process.env.EMAIL_ENABLED = 'true';
    });

    it('should send the email via SES with the configured From', async () => {
      mockSend.mockResolvedValue({});
      const service = new EmailService();

      await service.send(params);

      expect(SendEmailCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          Source: 'no-reply@restify.app',
          Destination: { ToAddresses: ['user@example.com'] },
          Message: expect.objectContaining({
            Subject: expect.objectContaining({ Data: 'Hola' }),
            Body: { Html: expect.objectContaining({ Data: '<p>Hola</p>' }) },
          }),
        })
      );
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('should propagate errors from SES', async () => {
      mockSend.mockRejectedValue(new Error('SES down'));
      const service = new EmailService();

      await expect(service.send(params)).rejects.toThrow('SES down');
    });
  });

  describe('when EMAIL_ENABLED is not true (no-op)', () => {
    beforeEach(() => {
      process.env.EMAIL_ENABLED = 'false';
    });

    it('should NOT call SES and resolve without error', async () => {
      const service = new EmailService();

      await service.send(params);

      expect(mockSend).not.toHaveBeenCalled();
      expect(SendEmailCommand).not.toHaveBeenCalled();
    });

    it('should be no-op by default when EMAIL_ENABLED is undefined', async () => {
      delete process.env.EMAIL_ENABLED;
      const service = new EmailService();

      await service.send(params);

      expect(mockSend).not.toHaveBeenCalled();
    });
  });
});
