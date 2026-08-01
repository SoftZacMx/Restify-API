import { ListPaymentsUseCase } from '../../../../src/core/application/use-cases/payments/list-payments.use-case';
import { IPaymentRepository } from '../../../../src/core/domain/interfaces/payment-repository.interface';
import { BranchTimezoneService } from '../../../../src/core/application/services/branch-timezone.service';
import { Payment } from '../../../../src/core/domain/entities/payment.entity';
import { PaymentStatus, PaymentMethod, PaymentGateway } from '@prisma/client';
import { fromZonedTime } from 'date-fns-tz';

describe('ListPaymentsUseCase', () => {
  let useCase: ListPaymentsUseCase;
  let mockPaymentRepository: jest.Mocked<IPaymentRepository>;
  let mockBranchTimezoneService: jest.Mocked<BranchTimezoneService>;

  const payment = new Payment(
    'payment-123', 'order-123', 'user-123', 150.50, 'MXN',
    PaymentStatus.SUCCEEDED, PaymentMethod.CASH,
    null, null, null, new Date('2026-04-22T12:00:00.000Z'), new Date('2026-04-22T12:00:00.000Z')
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

    mockBranchTimezoneService = {
      get: jest.fn().mockResolvedValue('America/Mexico_City'),
    } as any;

    useCase = new ListPaymentsUseCase(mockPaymentRepository, mockBranchTimezoneService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('ejecución', () => {
    it('retorna los pagos mapeados cuando no hay filtros', async () => {
      mockPaymentRepository.findAll.mockResolvedValue([payment]);

      const result = await useCase.execute();

      expect(mockBranchTimezoneService.get).toHaveBeenCalled();
      expect(mockPaymentRepository.findAll).toHaveBeenCalledWith(undefined);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: payment.id,
        orderId: payment.orderId,
        userId: payment.userId,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status,
        paymentMethod: payment.paymentMethod,
        gateway: payment.gateway,
        gatewayTransactionId: payment.gatewayTransactionId,
        createdAt: payment.createdAt,
        updatedAt: payment.updatedAt,
      });
    });

    it('retorna lista vacía cuando no hay pagos', async () => {
      mockPaymentRepository.findAll.mockResolvedValue([]);

      const result = await useCase.execute();

      expect(result).toEqual([]);
    });

    it('pasa los filtros simples al repositorio', async () => {
      mockPaymentRepository.findAll.mockResolvedValue([payment]);

      await useCase.execute({
        orderId: 'order-123',
        userId: 'user-123',
        status: PaymentStatus.SUCCEEDED,
        paymentMethod: PaymentMethod.CASH,
      });

      expect(mockPaymentRepository.findAll).toHaveBeenCalledWith({
        orderId: 'order-123',
        userId: 'user-123',
        status: PaymentStatus.SUCCEEDED,
        paymentMethod: PaymentMethod.CASH,
        dateFrom: undefined,
        dateTo: undefined,
      });
    });

    it('convierte dateFrom/dateTo a inicio y fin de día en la zona horaria de la sucursal', async () => {
      mockPaymentRepository.findAll.mockResolvedValue([]);
      const timezone = 'America/Mexico_City';
      const expectedFrom = fromZonedTime('2026-04-22 00:00:00.000', timezone);
      const expectedTo = fromZonedTime('2026-04-22 23:59:59.999', timezone);

      await useCase.execute({ dateFrom: '2026-04-22', dateTo: '2026-04-22' });

      expect(mockBranchTimezoneService.get).toHaveBeenCalled();
      expect(mockPaymentRepository.findAll).toHaveBeenCalledWith({
        orderId: undefined,
        userId: undefined,
        status: undefined,
        paymentMethod: undefined,
        dateFrom: expectedFrom,
        dateTo: expectedTo,
      });
    });

    it('no convierte fechas cuando el input no trae dateFrom/dateTo', async () => {
      mockPaymentRepository.findAll.mockResolvedValue([]);

      await useCase.execute({ status: PaymentStatus.PENDING });

      expect(mockPaymentRepository.findAll).toHaveBeenCalledWith({
        orderId: undefined,
        userId: undefined,
        status: PaymentStatus.PENDING,
        paymentMethod: undefined,
        dateFrom: undefined,
        dateTo: undefined,
      });
    });
  });
});
