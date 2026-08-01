import { GetPaymentSessionUseCase } from '../../../../src/core/application/use-cases/payments/get-payment-session.use-case';
import { IPaymentSessionRepository } from '../../../../src/core/domain/interfaces/payment-session-repository.interface';
import { PaymentSession } from '../../../../src/core/domain/entities/payment-session.entity';

describe('GetPaymentSessionUseCase', () => {
  let useCase: GetPaymentSessionUseCase;
  let mockPaymentSessionRepository: jest.Mocked<IPaymentSessionRepository>;

  const paymentId = 'payment-123';
  const session = new PaymentSession(
    'session-1', paymentId, 'secret-abc', 'conn-1',
    new Date(Date.now() + 10 * 60 * 1000), new Date('2026-04-22T12:00:00.000Z')
  );

  beforeEach(() => {
    mockPaymentSessionRepository = {
      findById: jest.fn(),
      findByPaymentId: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteByPaymentId: jest.fn(),
    };

    useCase = new GetPaymentSessionUseCase(mockPaymentSessionRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('ejecución', () => {
    it('retorna la sesión mapeada cuando existe y sigue vigente', async () => {
      mockPaymentSessionRepository.findByPaymentId.mockResolvedValue(session);

      const result = await useCase.execute({ payment_id: paymentId });

      expect(mockPaymentSessionRepository.findByPaymentId).toHaveBeenCalledWith(paymentId);
      expect(result).toEqual({
        id: session.id,
        paymentId: session.paymentId,
        clientSecret: session.clientSecret,
        connectionId: session.connectionId,
        expiresAt: session.expiresAt,
        createdAt: session.createdAt,
      });
    });

    it('lanza PAYMENT_SESSION_NOT_FOUND cuando la sesión no existe', async () => {
      mockPaymentSessionRepository.findByPaymentId.mockResolvedValue(null);

      await expect(useCase.execute({ payment_id: paymentId })).rejects.toMatchObject({
        code: 'PAYMENT_SESSION_NOT_FOUND',
      });
    });

    it('lanza PAYMENT_SESSION_EXPIRED cuando la sesión ya venció', async () => {
      const expired = new PaymentSession(
        session.id, session.paymentId, session.clientSecret, session.connectionId,
        new Date(Date.now() - 1000), session.createdAt
      );
      mockPaymentSessionRepository.findByPaymentId.mockResolvedValue(expired);

      await expect(useCase.execute({ payment_id: paymentId })).rejects.toMatchObject({
        code: 'PAYMENT_SESSION_EXPIRED',
      });
    });

    it('no considera vencida una sesión con expiry exactamente ahora', async () => {
      const boundary = new PaymentSession(
        session.id, session.paymentId, session.clientSecret, session.connectionId,
        new Date(), session.createdAt
      );
      mockPaymentSessionRepository.findByPaymentId.mockResolvedValue(boundary);

      const result = await useCase.execute({ payment_id: paymentId });

      expect(result.expiresAt).toBe(boundary.expiresAt);
    });
  });
});
