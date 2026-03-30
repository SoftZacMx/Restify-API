import { PayOrderWithCashUseCase } from '../../../../src/core/application/use-cases/payments/pay-order-with-cash.use-case';
import { IOrderRepository } from '../../../../src/core/domain/interfaces/order-repository.interface';
import { IPaymentRepository } from '../../../../src/core/domain/interfaces/payment-repository.interface';
import { ITableRepository } from '../../../../src/core/domain/interfaces/table-repository.interface';
import { Order } from '../../../../src/core/domain/entities/order.entity';
import { Payment } from '../../../../src/core/domain/entities/payment.entity';
import { PaymentStatus, PaymentMethod } from '@prisma/client';
import { AppError } from '../../../../src/shared/errors';

describe('PayOrderWithCashUseCase', () => {
  let payOrderWithCashUseCase: PayOrderWithCashUseCase;
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

    payOrderWithCashUseCase = new PayOrderWithCashUseCase(
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
      false, // not paid
      1, // paymentMethod
      50.00, // total
      43.10, // subtotal
      6.90, // iva
      false, // delivered
      null, // tableId
      0, // tip
      'Local', // origin
      null, // client
      false, // paymentDiffer
      null, // note
      userId,
      new Date(),
      new Date()
    );

    it('should pay order with cash successfully', async () => {
      const input = { orderId };

      const mockPayment = new Payment(
        'payment-123',
        orderId,
        userId,
        50.00,
        'USD',
        PaymentStatus.SUCCEEDED,
        PaymentMethod.CASH,
        null, // gateway
        null, // gatewayTransactionId
        null, // metadata
        new Date(),
        new Date()
      );

      const updatedOrder = new Order(
        orderId,
        mockOrder.date,
        true, // status = paid
        1, // paymentMethod = Cash
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

      const result = await payOrderWithCashUseCase.execute(input);

      expect(result.payment.id).toBe('payment-123');
      expect(result.payment.status).toBe(PaymentStatus.SUCCEEDED);
      expect(result.payment.paymentMethod).toBe(PaymentMethod.CASH);
      expect(result.order.status).toBe(true);
      expect(result.order.paymentMethod).toBe(1);
      expect(mockOrderRepository.findById).toHaveBeenCalledWith(orderId);
      expect(mockPaymentRepository.create).toHaveBeenCalledWith({
        orderId: orderId,
        userId: userId,
        amount: 50.00,
        currency: 'USD',
        status: PaymentStatus.SUCCEEDED,
        paymentMethod: PaymentMethod.CASH,
        gateway: null,
      });
      expect(mockOrderRepository.update).toHaveBeenCalledWith(orderId, {
        status: true,
        paymentMethod: 1,
      });
    });

    it('should throw error when order not found', async () => {
      const input = { orderId };

      mockOrderRepository.findById.mockResolvedValue(null);

      try {
        await payOrderWithCashUseCase.execute(input);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).code).toBe('ORDER_NOT_FOUND');
      }
      expect(mockPaymentRepository.create).not.toHaveBeenCalled();
      expect(mockOrderRepository.update).not.toHaveBeenCalled();
    });

    it('should throw error when order is already paid', async () => {
      const input = { orderId };

      const paidOrder = new Order(
        orderId,
        new Date(),
        true, // already paid
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
        await payOrderWithCashUseCase.execute(input);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).code).toBe('ORDER_ALREADY_PAID');
      }
      expect(mockPaymentRepository.create).not.toHaveBeenCalled();
      expect(mockOrderRepository.update).not.toHaveBeenCalled();
    });
  });
});

