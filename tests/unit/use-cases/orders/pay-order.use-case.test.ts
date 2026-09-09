import { PaymentStatus, PaymentMethod } from '@prisma/client';
import { PayOrderUseCase } from '../../../../src/core/application/use-cases/orders/pay-order.use-case';
import { getPrisma } from '../../../../src/core/infrastructure/database/prisma/get-prisma';

jest.mock('../../../../src/core/infrastructure/database/prisma/get-prisma');
const mockGetPrisma = getPrisma as jest.MockedFunction<typeof getPrisma>;

describe('PayOrderUseCase', () => {
  let useCase: PayOrderUseCase;
  let mockTx: {
    order: { findUnique: jest.Mock; update: jest.Mock };
    payment: { create: jest.Mock };
    paymentDifferentiation: { create: jest.Mock };
    table: { update: jest.Mock };
  };

  function makeOrder(overrides: Record<string, unknown> = {}) {
    return {
      id: 'order-1',
      status: false,
      total: 100,
      userId: 'user-1',
      tableId: null,
      origin: 'local',
      paymentDiffer: false,
      ...overrides,
    };
  }

  function mockSingleFlow(order: Record<string, unknown>) {
    mockTx.order.findUnique.mockResolvedValue(order);
    mockTx.payment.create.mockResolvedValue({
      id: 'payment-1',
      orderId: 'order-1',
      amount: 100,
      status: PaymentStatus.SUCCEEDED,
      paymentMethod: PaymentMethod.CASH,
      createdAt: new Date('2026-01-01T10:00:00.000Z'),
    });
    mockTx.order.update.mockResolvedValue({
      id: 'order-1',
      status: true,
      paymentMethod: 1,
      delivered: true,
    });
    mockTx.table.update.mockResolvedValue({});
  }

  function mockSplitFlow(order: Record<string, unknown>) {
    mockTx.order.findUnique.mockResolvedValue(order);
    mockTx.paymentDifferentiation.create.mockResolvedValue({
      id: 'pd-1',
      orderId: 'order-1',
      firstPaymentAmount: 40,
      firstPaymentMethod: PaymentMethod.CASH,
      secondPaymentAmount: 60,
      secondPaymentMethod: PaymentMethod.TRANSFER,
    });
    mockTx.payment.create.mockResolvedValue({
      id: 'payment-1',
      orderId: 'order-1',
      amount: 40,
      status: PaymentStatus.SUCCEEDED,
      paymentMethod: PaymentMethod.CASH,
      createdAt: new Date('2026-01-01T10:00:00.000Z'),
    });
    mockTx.order.update.mockResolvedValue({
      id: 'order-1',
      status: true,
      paymentMethod: null,
      paymentDiffer: true,
      delivered: true,
    });
    mockTx.table.update.mockResolvedValue({});
  }

  beforeEach(() => {
    mockTx = {
      order: { findUnique: jest.fn(), update: jest.fn() },
      payment: { create: jest.fn() },
      paymentDifferentiation: { create: jest.fn() },
      table: { update: jest.fn() },
    };

    mockGetPrisma.mockReturnValue({
      $transaction: jest.fn().mockImplementation((cb: (tx: unknown) => unknown) => cb(mockTx)),
    } as any);

    useCase = new PayOrderUseCase();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('executeSingle', () => {
    it('paga en CASH, libera la mesa, y guarda transferNumber en metadata', async () => {
      mockSingleFlow(makeOrder({ tableId: 'table-1', origin: 'local' }));

      const result = await useCase.execute({
        orderId: 'order-1',
        paymentMethod: 'CASH',
        amount: 100,
        transferNumber: 'TRF-123',
      } as never);

      expect(mockTx.payment.create).toHaveBeenCalledWith({
        data: {
          orderId: 'order-1',
          userId: 'user-1',
          amount: 100,
          currency: 'USD',
          status: PaymentStatus.SUCCEEDED,
          paymentMethod: PaymentMethod.CASH,
          gateway: null,
          metadata: { transferNumber: 'TRF-123' },
        },
      });
      expect(mockTx.order.update).toHaveBeenCalledWith({
        where: { id: 'order-1' },
        data: { status: true, paymentMethod: 1, delivered: true },
      });
      expect(mockTx.table.update).toHaveBeenCalledWith({
        where: { id: 'table-1' },
        data: { availabilityStatus: true },
      });
      expect(result.tableReleased).toBe(true);
      expect(result.payment).toEqual({
        id: 'payment-1',
        orderId: 'order-1',
        amount: 100,
        status: PaymentStatus.SUCCEEDED,
        paymentMethod: PaymentMethod.CASH,
        createdAt: new Date('2026-01-01T10:00:00.000Z'),
      });
      expect(result.order).toEqual({ id: 'order-1', status: true, paymentMethod: 1, delivered: true });
    });

    it('paga en TRANSFER sin transferNumber y sin mesa (tableReleased false)', async () => {
      mockSingleFlow(makeOrder({ origin: 'online-delivery' }));
      mockTx.payment.create.mockResolvedValue({
        id: 'payment-2',
        orderId: 'order-1',
        amount: 100,
        status: PaymentStatus.SUCCEEDED,
        paymentMethod: PaymentMethod.TRANSFER,
        createdAt: new Date('2026-01-01T10:00:00.000Z'),
      });

      const result = await useCase.execute({
        orderId: 'order-1',
        paymentMethod: 'TRANSFER',
        amount: 100,
      } as never);

      expect(mockTx.payment.create).toHaveBeenCalledWith({
        data: {
          orderId: 'order-1',
          userId: 'user-1',
          amount: 100,
          currency: 'USD',
          status: PaymentStatus.SUCCEEDED,
          paymentMethod: PaymentMethod.TRANSFER,
          gateway: null,
          metadata: undefined,
        },
      });
      expect(mockTx.order.update).toHaveBeenCalledWith({
        where: { id: 'order-1' },
        data: { status: true, paymentMethod: 2, delivered: true },
      });
      expect(mockTx.table.update).not.toHaveBeenCalled();
      expect(result.tableReleased).toBe(false);
    });

    it('paga en CARD_PHYSICAL con mesa pero de origen no local (tableReleased false)', async () => {
      mockSingleFlow(makeOrder({ tableId: 'table-1', origin: 'online-delivery' }));
      mockTx.payment.create.mockResolvedValue({
        id: 'payment-3',
        orderId: 'order-1',
        amount: 100,
        status: PaymentStatus.SUCCEEDED,
        paymentMethod: PaymentMethod.CARD_PHYSICAL,
        createdAt: new Date('2026-01-01T10:00:00.000Z'),
      });

      const result = await useCase.execute({
        orderId: 'order-1',
        paymentMethod: 'CARD_PHYSICAL',
        amount: 100,
      } as never);

      expect(mockTx.order.update).toHaveBeenCalledWith({
        where: { id: 'order-1' },
        data: { status: true, paymentMethod: 3, delivered: true },
      });
      expect(mockTx.table.update).not.toHaveBeenCalled();
      expect(result.tableReleased).toBe(false);
    });

    it('con paymentMethod desconocido cae a CARD_PHYSICAL y paymentMethod int por defecto 1', async () => {
      mockSingleFlow(makeOrder());
      mockTx.payment.create.mockResolvedValue({
        id: 'payment-4',
        orderId: 'order-1',
        amount: 100,
        status: PaymentStatus.SUCCEEDED,
        paymentMethod: PaymentMethod.CARD_PHYSICAL,
        createdAt: new Date('2026-01-01T10:00:00.000Z'),
      });

      await useCase.execute({ orderId: 'order-1', paymentMethod: 'OTHER', amount: 100 } as never);

      expect(mockTx.payment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ paymentMethod: PaymentMethod.CARD_PHYSICAL }),
      });
      expect(mockTx.order.update).toHaveBeenCalledWith({
        where: { id: 'order-1' },
        data: { status: true, paymentMethod: 1, delivered: true },
      });
    });

    it('lanza ORDER_NOT_FOUND si la orden no existe', async () => {
      mockTx.order.findUnique.mockResolvedValue(null);

      await expect(
        useCase.execute({ orderId: 'order-1', paymentMethod: 'CASH', amount: 100 } as never)
      ).rejects.toMatchObject({ code: 'ORDER_NOT_FOUND' });
    });

    it('lanza ORDER_ALREADY_PAID si la orden ya está pagada', async () => {
      mockTx.order.findUnique.mockResolvedValue(makeOrder({ status: true }));

      await expect(
        useCase.execute({ orderId: 'order-1', paymentMethod: 'CASH', amount: 100 } as never)
      ).rejects.toMatchObject({ code: 'ORDER_ALREADY_PAID' });
    });

    it('lanza PAYMENT_AMOUNT_MISMATCH si el monto no coincide con el total', async () => {
      mockTx.order.findUnique.mockResolvedValue(makeOrder());

      await expect(
        useCase.execute({ orderId: 'order-1', paymentMethod: 'CASH', amount: 90 } as never)
      ).rejects.toMatchObject({ code: 'PAYMENT_AMOUNT_MISMATCH' });
    });

    it('lanza VALIDATION_ERROR si la orden no tiene usuario asociado', async () => {
      mockTx.order.findUnique.mockResolvedValue(makeOrder({ userId: null }));

      await expect(
        useCase.execute({ orderId: 'order-1', paymentMethod: 'CASH', amount: 100 } as never)
      ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    });

    it('trata un input con firstPayment pero sin secondPayment como pago simple y falla por orden inexistente', async () => {
      mockTx.order.findUnique.mockResolvedValue(null);

      await expect(
        useCase.execute({ orderId: 'order-1', firstPayment: { amount: 40, paymentMethod: 'CASH' } } as never)
      ).rejects.toMatchObject({ code: 'ORDER_NOT_FOUND' });
    });
  });

  describe('executeSplit', () => {
    it('paga dividido en CASH + TRANSFER, libera la mesa y mapea el resultado', async () => {
      mockSplitFlow(makeOrder({ tableId: 'table-1', origin: 'local' }));

      const result = await useCase.execute({
        orderId: 'order-1',
        firstPayment: { amount: 40, paymentMethod: 'CASH' },
        secondPayment: { amount: 60, paymentMethod: 'TRANSFER' },
      } as never);

      expect(mockTx.paymentDifferentiation.create).toHaveBeenCalledWith({
        data: {
          orderId: 'order-1',
          firstPaymentAmount: 40,
          firstPaymentMethod: PaymentMethod.CASH,
          secondPaymentAmount: 60,
          secondPaymentMethod: PaymentMethod.TRANSFER,
        },
      });
      expect(mockTx.payment.create).toHaveBeenCalledTimes(2);
      expect(mockTx.order.update).toHaveBeenCalledWith({
        where: { id: 'order-1' },
        data: { status: true, paymentDiffer: true, paymentMethod: null, delivered: true },
      });
      expect(mockTx.table.update).toHaveBeenCalled();
      expect(result.tableReleased).toBe(true);
      expect(result.paymentDifferentiation).toEqual({
        id: 'pd-1',
        orderId: 'order-1',
        firstPaymentAmount: 40,
        firstPaymentMethod: PaymentMethod.CASH,
        secondPaymentAmount: 60,
        secondPaymentMethod: PaymentMethod.TRANSFER,
      });
      expect(result.payments).toEqual([
        { id: 'payment-1', amount: 40, status: PaymentStatus.SUCCEEDED, paymentMethod: PaymentMethod.CASH },
        { id: 'payment-1', amount: 40, status: PaymentStatus.SUCCEEDED, paymentMethod: PaymentMethod.CASH },
      ]);
    });

    it('paga dividido sin mesa y de origen no local (tableReleased false)', async () => {
      mockSplitFlow(makeOrder({ tableId: 'table-1', origin: 'online-delivery' }));

      const result = await useCase.execute({
        orderId: 'order-1',
        firstPayment: { amount: 40, paymentMethod: 'CASH' },
        secondPayment: { amount: 60, paymentMethod: 'TRANSFER' },
      } as never);

      expect(mockTx.table.update).not.toHaveBeenCalled();
      expect(result.tableReleased).toBe(false);
    });

    it('lanza ORDER_NOT_FOUND si la orden no existe', async () => {
      mockTx.order.findUnique.mockResolvedValue(null);

      await expect(
        useCase.execute({
          orderId: 'order-1',
          firstPayment: { amount: 40, paymentMethod: 'CASH' },
          secondPayment: { amount: 60, paymentMethod: 'TRANSFER' },
        } as never)
      ).rejects.toMatchObject({ code: 'ORDER_NOT_FOUND' });
    });

    it('lanza ORDER_ALREADY_PAID si la orden ya está pagada', async () => {
      mockTx.order.findUnique.mockResolvedValue(makeOrder({ status: true }));

      await expect(
        useCase.execute({
          orderId: 'order-1',
          firstPayment: { amount: 40, paymentMethod: 'CASH' },
          secondPayment: { amount: 60, paymentMethod: 'TRANSFER' },
        } as never)
      ).rejects.toMatchObject({ code: 'ORDER_ALREADY_PAID' });
    });

    it('lanza SPLIT_PAYMENT_ALREADY_EXISTS si la orden ya tiene paymentDiffer', async () => {
      mockTx.order.findUnique.mockResolvedValue(makeOrder({ paymentDiffer: true }));

      await expect(
        useCase.execute({
          orderId: 'order-1',
          firstPayment: { amount: 40, paymentMethod: 'CASH' },
          secondPayment: { amount: 60, paymentMethod: 'TRANSFER' },
        } as never)
      ).rejects.toMatchObject({ code: 'SPLIT_PAYMENT_ALREADY_EXISTS' });
    });

    it('lanza SPLIT_PAYMENT_AMOUNT_EXCEEDS_TOTAL si la suma supera el total', async () => {
      mockTx.order.findUnique.mockResolvedValue(makeOrder());

      await expect(
        useCase.execute({
          orderId: 'order-1',
          firstPayment: { amount: 60, paymentMethod: 'CASH' },
          secondPayment: { amount: 60, paymentMethod: 'TRANSFER' },
        } as never)
      ).rejects.toMatchObject({ code: 'SPLIT_PAYMENT_AMOUNT_EXCEEDS_TOTAL' });
    });

    it('lanza SPLIT_PAYMENT_AMOUNT_MISMATCH si la suma no alcanza el total', async () => {
      mockTx.order.findUnique.mockResolvedValue(makeOrder());

      await expect(
        useCase.execute({
          orderId: 'order-1',
          firstPayment: { amount: 30, paymentMethod: 'CASH' },
          secondPayment: { amount: 60, paymentMethod: 'TRANSFER' },
        } as never)
      ).rejects.toMatchObject({ code: 'SPLIT_PAYMENT_AMOUNT_MISMATCH' });
    });

    it('lanza SPLIT_PAYMENT_SAME_METHOD si ambos pagos usan el mismo método', async () => {
      mockTx.order.findUnique.mockResolvedValue(makeOrder());

      await expect(
        useCase.execute({
          orderId: 'order-1',
          firstPayment: { amount: 40, paymentMethod: 'CASH' },
          secondPayment: { amount: 60, paymentMethod: 'CASH' },
        } as never)
      ).rejects.toMatchObject({ code: 'SPLIT_PAYMENT_SAME_METHOD' });
    });

    it('lanza VALIDATION_ERROR si la orden no tiene usuario asociado', async () => {
      mockTx.order.findUnique.mockResolvedValue(makeOrder({ userId: null }));

      await expect(
        useCase.execute({
          orderId: 'order-1',
          firstPayment: { amount: 40, paymentMethod: 'CASH' },
          secondPayment: { amount: 60, paymentMethod: 'TRANSFER' },
        } as never)
      ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    });
  });
});
