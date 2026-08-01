import { GetPaymentUseCase } from '../../../../src/core/application/use-cases/payments/get-payment.use-case';
import { IPaymentRepository } from '../../../../src/core/domain/interfaces/payment-repository.interface';
import { Payment } from '../../../../src/core/domain/entities/payment.entity';
import { PaymentStatus, PaymentMethod, PaymentGateway } from '@prisma/client';

describe('GetPaymentUseCase', () => {
  let useCase: GetPaymentUseCase;
  let mockPaymentRepository: jest.Mocked<IPaymentRepository>;

  const paymentId = 'payment-123';
  const payment = new Payment(
    paymentId, 'order-123', 'user-123', 150.50, 'MXN',
    PaymentStatus.SUCCEEDED, PaymentMethod.CASH,
    null, null, { note: 'test' }, new Date('2026-04-22T12:00:00.000Z'), new Date('2026-04-22T12:00:00.000Z')
  );

  beforeEach(() => {
    mockPaymentRepository = {
      findById: jest.fn(),
      findByGatewayTransactionId: jest.fn(),
      findAll: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    useCase = new GetPaymentUseCase(mockPaymentRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('ejecución', () => {
    it('retorna el pago mapeado cuando existe', async () => {
      mockPaymentRepository.findById.mockResolvedValue(payment);

      const result = await useCase.execute({ payment_id: paymentId });

      expect(mockPaymentRepository.findById).toHaveBeenCalledWith(paymentId);
      expect(result).toEqual({
        id: payment.id,
        orderId: payment.orderId,
        userId: payment.userId,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status,
        paymentMethod: payment.paymentMethod,
        gateway: payment.gateway,
        gatewayTransactionId: payment.gatewayTransactionId,
        metadata: payment.metadata,
        createdAt: payment.createdAt,
        updatedAt: payment.updatedAt,
      });
    });

    it('lanza PAYMENT_NOT_FOUND cuando el pago no existe', async () => {
      mockPaymentRepository.findById.mockResolvedValue(null);

      await expect(useCase.execute({ payment_id: paymentId })).rejects.toMatchObject({
        code: 'PAYMENT_NOT_FOUND',
      });
    });
  });
});
