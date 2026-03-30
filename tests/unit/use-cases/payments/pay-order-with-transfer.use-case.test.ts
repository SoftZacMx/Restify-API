import { PayOrderWithTransferUseCase } from '../../../../src/core/application/use-cases/payments/pay-order-with-transfer.use-case';
import { IOrderRepository } from '../../../../src/core/domain/interfaces/order-repository.interface';
import { IPaymentRepository } from '../../../../src/core/domain/interfaces/payment-repository.interface';
import { ITableRepository } from '../../../../src/core/domain/interfaces/table-repository.interface';
import { Order } from '../../../../src/core/domain/entities/order.entity';
import { Payment } from '../../../../src/core/domain/entities/payment.entity';
import { PaymentStatus, PaymentMethod } from '@prisma/client';
import { AppError } from '../../../../src/shared/errors';

describe('PayOrderWithTransferUseCase', () => {
  let payOrderWithTransferUseCase: PayOrderWithTransferUseCase;
  let mockOrderRepository: jest.Mocked<IOrderRepository>;
  let mockPaymentRepository: jest.Mocked<IPaymentRepository>;
  let mockTableRepository: jest.Mocked<ITableRepository>;

  beforeEach(() => {
    mockOrderRepository = {
      findById: jest.fn(),
      findAll: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      createOrderItem: jest.fn(),
      updateOrderItem: jest.fn(),
      deleteOrderItem: jest.fn(),
      deleteOrderItemsByOrderId: jest.fn(),
      findOrderItemsByOrderId: jest.fn(),
      createOrderItemExtra: jest.fn(),
      deleteOrderItemExtrasByOrderId: jest.fn(),
      deleteOrderItemExtrasByOrderItemId: jest.fn(),
      findOrderItemExtrasByOrderId: jest.fn(),
      findOrderItemExtrasByOrderItemId: jest.fn(),
    };

    mockPaymentRepository = {
      findById: jest.fn(),
      findByGatewayTransactionId: jest.fn(),
      findAll: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    mockTableRepository = {
      findById: jest.fn(),
      findByName: jest.fn(),
      findAll: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    payOrderWithTransferUseCase = new PayOrderWithTransferUseCase(
      mockOrderRepository,
      mockPaymentRepository,
      mockTableRepository
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    const orderId = 'order-123';
    const userId = 'user-123';

    const mockOrder = new Order(
      orderId,
      new Date(),
      false,
      1,
      50.00,
      43.10,
      6.90,
      false,
      null,
      0,
      'Local',
      null,
      false,
      null,
      userId,
      new Date(),
      new Date()
    );

    it('should pay order with transfer successfully', async () => {
      const input = { orderId, transferNumber: 'TRF-123456' };

      const mockPayment = new Payment(
        'payment-123',
        orderId,
        userId,
        50.00,
        'USD',
        PaymentStatus.SUCCEEDED,
        PaymentMethod.TRANSFER,
        null,
        null,
        { transferNumber: 'TRF-123456' },
        new Date(),
        new Date()
      );

      const updatedOrder = new Order(
        orderId,
        mockOrder.date,
        true,
        2, // paymentMethod = Transfer
        mockOrder.total,
        mockOrder.subtotal,
        mockOrder.iva,
        mockOrder.delivered,
        mockOrder.tableId,
        mockOrder.tip,
        mockOrder.origin,
        mockOrder.client,
        mockOrder.paymentDiffer,
        mockOrder.note,
        mockOrder.userId,
        mockOrder.createdAt,
        new Date()
      );

      mockOrderRepository.findById.mockResolvedValue(mockOrder);
      mockPaymentRepository.create.mockResolvedValue(mockPayment);
      mockOrderRepository.update.mockResolvedValue(updatedOrder);

      const result = await payOrderWithTransferUseCase.execute(input);

      expect(result.payment.id).toBe('payment-123');
      expect(result.payment.status).toBe(PaymentStatus.SUCCEEDED);
      expect(result.payment.paymentMethod).toBe(PaymentMethod.TRANSFER);
      expect(result.payment.metadata).toEqual({ transferNumber: 'TRF-123456' });
      expect(result.order.status).toBe(true);
      expect(result.order.paymentMethod).toBe(2);
      expect(mockPaymentRepository.create).toHaveBeenCalledWith({
        orderId: orderId,
        userId: userId,
        amount: 50.00,
        currency: 'USD',
        status: PaymentStatus.SUCCEEDED,
        paymentMethod: PaymentMethod.TRANSFER,
        gateway: null,
        metadata: { transferNumber: 'TRF-123456' },
      });
    });

    it('should pay order with transfer without transfer number', async () => {
      const input = { orderId };

      const mockPayment = new Payment(
        'payment-123',
        orderId,
        userId,
        50.00,
        'USD',
        PaymentStatus.SUCCEEDED,
        PaymentMethod.TRANSFER,
        null,
        null,
        null,
        new Date(),
        new Date()
      );

      const updatedOrder = new Order(
        orderId,
        mockOrder.date,
        true,
        2,
        mockOrder.total,
        mockOrder.subtotal,
        mockOrder.iva,
        mockOrder.delivered,
        mockOrder.tableId,
        mockOrder.tip,
        mockOrder.origin,
        mockOrder.client,
        mockOrder.paymentDiffer,
        mockOrder.note,
        mockOrder.userId,
        mockOrder.createdAt,
        new Date()
      );

      mockOrderRepository.findById.mockResolvedValue(mockOrder);
      mockPaymentRepository.create.mockResolvedValue(mockPayment);
      mockOrderRepository.update.mockResolvedValue(updatedOrder);

      const result = await payOrderWithTransferUseCase.execute(input);

      expect(result.payment.metadata).toBeNull();
    });

    it('should throw error when order not found', async () => {
      const input = { orderId };

      mockOrderRepository.findById.mockResolvedValue(null);

      try {
        await payOrderWithTransferUseCase.execute(input);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).code).toBe('ORDER_NOT_FOUND');
      }
    });

    it('should throw error when order is already paid', async () => {
      const input = { orderId };

      const paidOrder = new Order(
        orderId,
        new Date(),
        true,
        1,
        50.00,
        43.10,
        6.90,
        false,
        null,
        0,
        'Local',
        null,
        false,
        null,
        userId,
        new Date(),
        new Date()
      );

      mockOrderRepository.findById.mockResolvedValue(paidOrder);

      try {
        await payOrderWithTransferUseCase.execute(input);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).code).toBe('ORDER_ALREADY_PAID');
      }
    });
  });
});

