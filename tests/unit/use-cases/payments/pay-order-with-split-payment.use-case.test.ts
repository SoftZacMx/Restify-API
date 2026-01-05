import { PayOrderWithSplitPaymentUseCase } from '../../../../src/core/application/use-cases/payments/pay-order-with-split-payment.use-case';
import { IOrderRepository } from '../../../../src/core/domain/interfaces/order-repository.interface';
import { IPaymentRepository } from '../../../../src/core/domain/interfaces/payment-repository.interface';
import { IPaymentDifferentiationRepository } from '../../../../src/core/domain/interfaces/payment-differentiation-repository.interface';
import { Order } from '../../../../src/core/domain/entities/order.entity';
import { Payment } from '../../../../src/core/domain/entities/payment.entity';
import { PaymentDifferentiation } from '../../../../src/core/domain/entities/payment-differentiation.entity';
import { PaymentStatus, PaymentMethod } from '@prisma/client';
import { AppError } from '../../../../src/shared/errors';

describe('PayOrderWithSplitPaymentUseCase', () => {
  let payOrderWithSplitPaymentUseCase: PayOrderWithSplitPaymentUseCase;
  let mockOrderRepository: jest.Mocked<IOrderRepository>;
  let mockPaymentRepository: jest.Mocked<IPaymentRepository>;
  let mockPaymentDiffRepository: jest.Mocked<IPaymentDifferentiationRepository>;

  beforeEach(() => {
    mockOrderRepository = {
      findById: jest.fn(),
      findAll: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      createOrderItem: jest.fn(),
      findOrderItemsByOrderId: jest.fn(),
      createOrderMenuItem: jest.fn(),
      findOrderMenuItemsByOrderId: jest.fn(),
    };

    mockPaymentRepository = {
      findById: jest.fn(),
      findByGatewayTransactionId: jest.fn(),
      findAll: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    mockPaymentDiffRepository = {
      findById: jest.fn(),
      findByOrderId: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteByOrderId: jest.fn(),
    };

    payOrderWithSplitPaymentUseCase = new PayOrderWithSplitPaymentUseCase(
      mockOrderRepository,
      mockPaymentRepository,
      mockPaymentDiffRepository
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
      50.00, // total
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

    it('should pay order with split payment successfully', async () => {
      const input = {
        orderId,
        firstPayment: {
          amount: 25.00,
          paymentMethod: PaymentMethod.CASH,
        },
        secondPayment: {
          amount: 25.00,
          paymentMethod: PaymentMethod.TRANSFER,
        },
      };

      const mockPaymentDiff = new PaymentDifferentiation(
        'payment-diff-123',
        orderId,
        25.00,
        PaymentMethod.CASH,
        25.00,
        PaymentMethod.TRANSFER,
        new Date(),
        new Date()
      );

      const mockPayment1 = new Payment(
        'payment-1',
        orderId,
        userId,
        25.00,
        'USD',
        PaymentStatus.SUCCEEDED,
        PaymentMethod.CASH,
        null,
        null,
        null,
        new Date(),
        new Date()
      );

      const mockPayment2 = new Payment(
        'payment-2',
        orderId,
        userId,
        25.00,
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
        null, // paymentMethod = null for split
        mockOrder.total,
        mockOrder.subtotal,
        mockOrder.iva,
        mockOrder.delivered,
        mockOrder.tableId,
        mockOrder.tip,
        mockOrder.origin,
        mockOrder.client,
        true, // paymentDiffer = true
        mockOrder.note,
        mockOrder.userId,
        mockOrder.createdAt,
        new Date()
      );

      mockOrderRepository.findById.mockResolvedValue(mockOrder);
      mockPaymentDiffRepository.create.mockResolvedValue(mockPaymentDiff);
      mockPaymentRepository.create
        .mockResolvedValueOnce(mockPayment1)
        .mockResolvedValueOnce(mockPayment2);
      mockOrderRepository.update.mockResolvedValue(updatedOrder);

      const result = await payOrderWithSplitPaymentUseCase.execute(input);

      expect(result.paymentDifferentiation.id).toBe('payment-diff-123');
      expect(result.payments).toHaveLength(2);
      expect(result.payments[0].paymentMethod).toBe(PaymentMethod.CASH);
      expect(result.payments[1].paymentMethod).toBe(PaymentMethod.TRANSFER);
      expect(result.order.status).toBe(true);
      expect(result.order.paymentDiffer).toBe(true);
      expect(result.order.paymentMethod).toBeNull();
      expect(mockPaymentDiffRepository.create).toHaveBeenCalled();
      expect(mockPaymentRepository.create).toHaveBeenCalledTimes(2);
      expect(mockOrderRepository.update).toHaveBeenCalledWith(orderId, {
        status: true,
        paymentDiffer: true,
        paymentMethod: null,
      });
    });

    it('should throw error when order not found', async () => {
      const input = {
        orderId,
        firstPayment: { amount: 25.00, paymentMethod: PaymentMethod.CASH },
        secondPayment: { amount: 25.00, paymentMethod: PaymentMethod.TRANSFER },
      };

      mockOrderRepository.findById.mockResolvedValue(null);

      try {
        await payOrderWithSplitPaymentUseCase.execute(input);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).code).toBe('ORDER_NOT_FOUND');
      }
    });

    it('should throw error when order is already paid', async () => {
      const input = {
        orderId,
        firstPayment: { amount: 25.00, paymentMethod: PaymentMethod.CASH },
        secondPayment: { amount: 25.00, paymentMethod: PaymentMethod.TRANSFER },
      };

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
        await payOrderWithSplitPaymentUseCase.execute(input);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).code).toBe('ORDER_ALREADY_PAID');
      }
    });

    it('should throw error when split payment already exists', async () => {
      const input = {
        orderId,
        firstPayment: { amount: 25.00, paymentMethod: PaymentMethod.CASH },
        secondPayment: { amount: 25.00, paymentMethod: PaymentMethod.TRANSFER },
      };

      const orderWithSplit = new Order(
        orderId,
        new Date(),
        false,
        null,
        50.00,
        43.10,
        6.90,
        false,
        null,
        0,
        'Local',
        null,
        true, // paymentDiffer = true
        null,
        userId,
        new Date(),
        new Date()
      );

      mockOrderRepository.findById.mockResolvedValue(orderWithSplit);

      try {
        await payOrderWithSplitPaymentUseCase.execute(input);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).code).toBe('SPLIT_PAYMENT_ALREADY_EXISTS');
      }
    });

    it('should throw error when payment methods are the same', async () => {
      const input = {
        orderId,
        firstPayment: { amount: 25.00, paymentMethod: PaymentMethod.CASH },
        secondPayment: { amount: 25.00, paymentMethod: PaymentMethod.CASH }, // Same method
      };

      mockOrderRepository.findById.mockResolvedValue(mockOrder);

      try {
        await payOrderWithSplitPaymentUseCase.execute(input);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).code).toBe('SPLIT_PAYMENT_SAME_METHOD');
      }
    });

    it('should throw error when first payment method is STRIPE', async () => {
      const input = {
        orderId,
        firstPayment: { amount: 25.00, paymentMethod: PaymentMethod.CARD_STRIPE as any }, // Force invalid method for test
        secondPayment: { amount: 25.00, paymentMethod: PaymentMethod.CASH },
      };

      mockOrderRepository.findById.mockResolvedValue(mockOrder);

      try {
        await payOrderWithSplitPaymentUseCase.execute(input);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).code).toBe('SPLIT_PAYMENT_INVALID_METHOD');
      }
    });

    it('should throw error when total amount exceeds order total', async () => {
      const input = {
        orderId,
        firstPayment: { amount: 30.00, paymentMethod: PaymentMethod.CASH },
        secondPayment: { amount: 30.00, paymentMethod: PaymentMethod.TRANSFER }, // Total = 60 > 50
      };

      mockOrderRepository.findById.mockResolvedValue(mockOrder);

      try {
        await payOrderWithSplitPaymentUseCase.execute(input);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).code).toBe('SPLIT_PAYMENT_AMOUNT_EXCEEDS_TOTAL');
      }
    });

    it('should throw error when total amount does not match order total', async () => {
      const input = {
        orderId,
        firstPayment: { amount: 20.00, paymentMethod: PaymentMethod.CASH },
        secondPayment: { amount: 20.00, paymentMethod: PaymentMethod.TRANSFER }, // Total = 40 < 50
      };

      mockOrderRepository.findById.mockResolvedValue(mockOrder);

      try {
        await payOrderWithSplitPaymentUseCase.execute(input);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).code).toBe('SPLIT_PAYMENT_AMOUNT_MISMATCH');
      }
    });

    it('should allow small rounding difference (0.01)', async () => {
      const input = {
        orderId,
        firstPayment: { amount: 25.00, paymentMethod: PaymentMethod.CASH },
        secondPayment: { amount: 25.00, paymentMethod: PaymentMethod.TRANSFER }, // Total = 50.00 (exact match)
      };

      const mockPaymentDiff = new PaymentDifferentiation(
        'payment-diff-123',
        orderId,
        25.00,
        PaymentMethod.CASH,
        25.00,
        PaymentMethod.TRANSFER,
        new Date(),
        new Date()
      );

      const mockPayment1 = new Payment(
        'payment-1',
        orderId,
        userId,
        25.00,
        'USD',
        PaymentStatus.SUCCEEDED,
        PaymentMethod.CASH,
        null,
        null,
        null,
        new Date(),
        new Date()
      );

      const mockPayment2 = new Payment(
        'payment-2',
        orderId,
        userId,
        25.00,
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
        null,
        mockOrder.total,
        mockOrder.subtotal,
        mockOrder.iva,
        mockOrder.delivered,
        mockOrder.tableId,
        mockOrder.tip,
        mockOrder.origin,
        mockOrder.client,
        true,
        mockOrder.note,
        mockOrder.userId,
        mockOrder.createdAt,
        new Date()
      );

      mockOrderRepository.findById.mockResolvedValue(mockOrder);
      mockPaymentDiffRepository.create.mockResolvedValue(mockPaymentDiff);
      mockPaymentRepository.create
        .mockResolvedValueOnce(mockPayment1)
        .mockResolvedValueOnce(mockPayment2);
      mockOrderRepository.update.mockResolvedValue(updatedOrder);

      const result = await payOrderWithSplitPaymentUseCase.execute(input);

      expect(result.order.status).toBe(true);
      expect(result.order.paymentDiffer).toBe(true);
    });
  });
});

