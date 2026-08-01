/// <reference types="jest" />

import { PrismaClient, PaymentStatus, PaymentMethod, PaymentGateway, ExpenseType } from '@prisma/client';
import { ConfirmMercadoPagoPaymentUseCase } from '../../src/core/application/use-cases/payments/confirm-mercado-pago-payment.use-case';
import { CreateMercadoPagoFeeExpenseUseCase } from '../../src/core/application/use-cases/expenses/create-mercado-pago-fee-expense.use-case';
import { TenantResolverService } from '../../src/core/application/services/tenant-resolver.service';
import { PublicOrderPersistenceService } from '../../src/core/application/services/public-order-persistence.service';
import { StockService } from '../../src/core/application/services/stock.service';
import { PaymentRepository } from '../../src/core/infrastructure/database/repositories/payment.repository';
import { OrderRepository } from '../../src/core/infrastructure/database/repositories/order.repository';
import { TableRepository } from '../../src/core/infrastructure/database/repositories/table.repository';
import { PendingCheckoutRepository } from '../../src/core/infrastructure/database/repositories/pending-checkout.repository';
import { ExpenseRepository } from '../../src/core/infrastructure/database/repositories/expense.repository';
import { BranchRepository } from '../../src/core/infrastructure/database/repositories/branch.repository';
import { OrganizationRepository } from '../../src/core/infrastructure/database/repositories/organization.repository';
import { PrismaService } from '../../src/core/infrastructure/config/prisma.config';
import {
  ensurePaymentE2EEnv,
  shouldSkipPaymentE2E,
  createPaymentE2ETenant,
  cleanupPaymentE2ETenant,
  createFakeMercadoPagoService,
  buildMPPayment,
  prismaClient,
  PaymentE2ETenant,
} from './payment-e2e.helper';

const e2eSkip = shouldSkipPaymentE2E();
describe('E2E Pagos — ConfirmMercadoPagoPayment (webhook, BD real)', () => {
  if (e2eSkip) {
    it('se omite: requiere MySQL local (DATABASE_URL con localhost)', () => {});
    return;
  }

  const base = new PrismaClient();
  const prisma = prismaClient;

  let tenant: PaymentE2ETenant;
  let tableId: string;
  const createdOrderIds: string[] = [];

  const paymentRepo = new PaymentRepository(prisma);
  const orderRepo = new OrderRepository(prisma);
  const tableRepo = new TableRepository(prisma);
  const pendingCheckoutRepo = new PendingCheckoutRepository(prisma);
  const expenseRepo = new ExpenseRepository(prisma);
  const branchRepo = new BranchRepository(prisma);
  const orgRepo = new OrganizationRepository(prisma);

  const mp = createFakeMercadoPagoService();
  const confirmMP = new ConfirmMercadoPagoPaymentUseCase(
    paymentRepo,
    orderRepo,
    tableRepo,
    pendingCheckoutRepo,
    mp.service,
    new CreateMercadoPagoFeeExpenseUseCase(expenseRepo),
    new PublicOrderPersistenceService(new PrismaService(), new StockService(new PrismaService())),
    new TenantResolverService(branchRepo, orgRepo)
  );

  async function createLocalOrder() {
    const table = await base.table.create({
      data: {
        name: `Mesa E2E ${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        userId: tenant.userId,
        branchId: tenant.branchId,
        status: true,
        availabilityStatus: false,
      },
    });
    tableId = table.id;

    const order = await base.order.create({
      data: {
        status: false,
        paymentMethod: null,
        total: 150,
        subtotal: 150,
        iva: 0,
        delivered: false,
        tableId: table.id,
        tip: 0,
        origin: 'Local',
        client: null,
        paymentDiffer: false,
        note: null,
        userId: tenant.userId,
        branchId: tenant.branchId,
      },
    });
    createdOrderIds.push(order.id);
    return order;
  }

  async function createOnlineOrder() {
    const order = await base.order.create({
      data: {
        status: false,
        paymentMethod: null,
        total: 150,
        subtotal: 150,
        iva: 0,
        delivered: false,
        tableId: null,
        tip: 0,
        origin: 'online-pickup',
        client: null,
        paymentDiffer: false,
        note: null,
        userId: null,
        customerName: 'Cliente Online E2E',
        customerPhone: '5550000000',
        branchId: tenant.branchId,
      },
    });
    createdOrderIds.push(order.id);
    return order;
  }

  async function seedPendingPayment(orderId: string, mpPaymentId: number) {
    return base.payment.create({
      data: {
        orderId,
        userId: null,
        amount: 150,
        currency: 'MXN',
        status: PaymentStatus.PENDING,
        paymentMethod: PaymentMethod.QR_MERCADO_PAGO,
        gateway: PaymentGateway.MERCADO_PAGO,
        gatewayTransactionId: String(mpPaymentId),
        branchId: tenant.branchId,
      },
    });
  }

  beforeAll(async () => {
    tenant = await createPaymentE2ETenant(base);
  });

  afterAll(async () => {
    await cleanupPaymentE2ETenant(base, tenant.branchId, tenant.orgId);
    await base.$disconnect();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Flujo de orden existente', () => {
    it('approved → payment SUCCEEDED, orden pagada, mesa liberada y comisión registrada', async () => {
      const order = await createLocalOrder();
      const payment = await seedPendingPayment(order.id, 710001);

      mp.getPayment.mockResolvedValue(
        buildMPPayment({
          id: 710001,
          status: 'approved',
          externalReference: `${order.id}:${tenant.branchId}`,
          transactionAmount: 150,
          feeDetails: [{ type: 'mercadopago_fee', amount: 7.5, feePayer: 'collector' }],
        })
      );

      const result = await confirmMP.execute({
        mpPaymentId: 710001,
        action: 'payment.updated',
        branchId: tenant.branchId,
      });

      expect(result).not.toBeNull();
      expect(result!.payment.status).toBe(PaymentStatus.SUCCEEDED);
      expect(result!.payment.id).toBe(payment.id);
      expect(result!.payment.gatewayTransactionId).toBe('710001');
      expect(result!.order).toBeDefined();
      expect(result!.order!.status).toBe(true);
      expect(result!.order!.paymentMethod).toBe(4);
      expect(result!.tableReleased).toBe(true);

      const dbOrder = await base.order.findUnique({ where: { id: order.id } });
      expect(dbOrder!.status).toBe(true);
      expect(dbOrder!.paymentMethod).toBe(4);
      expect(dbOrder!.delivered).toBe(true);

      const dbTable = await base.table.findUnique({ where: { id: tableId } });
      expect(dbTable!.availabilityStatus).toBe(true);

      const expenses = await base.expense.findMany({ where: { branchId: tenant.branchId } });
      expect(expenses.length).toBe(1);
      expect(expenses[0].type).toBe(ExpenseType.MERCADO_PAGO_FEE);
      expect(Number(expenses[0].total)).toBe(7.5);
      expect(expenses[0].paymentId).toBe(payment.id);
    });

    it('webhook duplicado es idempotente: no duplica comisión ni re-libera mesa', async () => {
      const order = await createLocalOrder();
      const payment = await seedPendingPayment(order.id, 710002);

      mp.getPayment.mockResolvedValue(
        buildMPPayment({
          id: 710002,
          status: 'approved',
          externalReference: `${order.id}:${tenant.branchId}`,
          transactionAmount: 150,
          feeDetails: [{ type: 'mercadopago_fee', amount: 7.5, feePayer: 'collector' }],
        })
      );

      const first = await confirmMP.execute({
        mpPaymentId: 710002,
        action: 'payment.updated',
        branchId: tenant.branchId,
      });
      const second = await confirmMP.execute({
        mpPaymentId: 710002,
        action: 'payment.updated',
        branchId: tenant.branchId,
      });

      expect(first!.payment.status).toBe(PaymentStatus.SUCCEEDED);
      expect(second!.payment.status).toBe(PaymentStatus.SUCCEEDED);
      expect(second!.order).toBeUndefined();
      expect(second!.tableReleased).toBe(false);

      const expenses = await base.expense.findMany({
        where: { branchId: tenant.branchId, paymentId: payment.id },
      });
      expect(expenses.length).toBe(1);
    });

    it('rejected → payment FAILED y la orden no se toca', async () => {
      const order = await createLocalOrder();
      const payment = await seedPendingPayment(order.id, 710003);

      mp.getPayment.mockResolvedValue(
        buildMPPayment({
          id: 710003,
          status: 'rejected',
          statusDetail: 'cc_rejected_other_reason',
          externalReference: `${order.id}:${tenant.branchId}`,
          transactionAmount: 150,
          dateApproved: null,
        })
      );

      const result = await confirmMP.execute({
        mpPaymentId: 710003,
        action: 'payment.updated',
        branchId: tenant.branchId,
      });

      expect(result!.payment.status).toBe(PaymentStatus.FAILED);
      expect(result!.order).toBeUndefined();

      const dbPayment = await base.payment.findUnique({ where: { id: payment.id } });
      expect(dbPayment!.status).toBe(PaymentStatus.FAILED);
      const dbOrder = await base.order.findUnique({ where: { id: order.id } });
      expect(dbOrder!.status).toBe(false);
      expect(dbOrder!.paymentMethod).toBeNull();
    });

    it('cancelled → payment CANCELED', async () => {
      const order = await createOnlineOrder();
      await seedPendingPayment(order.id, 710004);

      mp.getPayment.mockResolvedValue(
        buildMPPayment({
          id: 710004,
          status: 'cancelled',
          statusDetail: 'expired',
          externalReference: `${order.id}:${tenant.branchId}`,
          transactionAmount: 150,
          dateApproved: null,
        })
      );

      const result = await confirmMP.execute({
        mpPaymentId: 710004,
        action: 'payment.updated',
        branchId: tenant.branchId,
      });

      expect(result!.payment.status).toBe(PaymentStatus.CANCELED);
      const dbOrder = await base.order.findUnique({ where: { id: order.id } });
      expect(dbOrder!.status).toBe(false);
    });

    it('pending → payment PROCESSING', async () => {
      const order = await createOnlineOrder();
      await seedPendingPayment(order.id, 710005);

      mp.getPayment.mockResolvedValue(
        buildMPPayment({
          id: 710005,
          status: 'pending',
          statusDetail: 'pending_waiting_transfer',
          externalReference: `${order.id}:${tenant.branchId}`,
          transactionAmount: 150,
          dateApproved: null,
        })
      );

      const result = await confirmMP.execute({
        mpPaymentId: 710005,
        action: 'payment.updated',
        branchId: tenant.branchId,
      });

      expect(result!.payment.status).toBe(PaymentStatus.PROCESSING);
    });

    it('monto aprobado distinto al total → payment PROCESSING y orden NO pagada', async () => {
      const order = await createLocalOrder();
      const payment = await seedPendingPayment(order.id, 710006);

      mp.getPayment.mockResolvedValue(
        buildMPPayment({
          id: 710006,
          status: 'approved',
          externalReference: `${order.id}:${tenant.branchId}`,
          transactionAmount: 100,
        })
      );

      const result = await confirmMP.execute({
        mpPaymentId: 710006,
        action: 'payment.updated',
        branchId: tenant.branchId,
      });

      expect(result!.payment.status).toBe(PaymentStatus.PROCESSING);
      const dbPayment = await base.payment.findUnique({ where: { id: payment.id } });
      expect(dbPayment!.status).toBe(PaymentStatus.PROCESSING);
      const dbOrder = await base.order.findUnique({ where: { id: order.id } });
      expect(dbOrder!.status).toBe(false);
      const dbTable = await base.table.findUnique({ where: { id: tableId } });
      expect(dbTable!.availabilityStatus).toBe(false);
    });

    it('branch de la URL distinto al external_reference → webhook ignorado', async () => {
      const order = await createLocalOrder();
      await seedPendingPayment(order.id, 710007);

      mp.getPayment.mockResolvedValue(
        buildMPPayment({
          id: 710007,
          status: 'approved',
          externalReference: `${order.id}:other-branch`,
          transactionAmount: 150,
        })
      );

      const result = await confirmMP.execute({
        mpPaymentId: 710007,
        action: 'payment.updated',
        branchId: tenant.branchId,
      });

      expect(result).toBeNull();
      const dbOrder = await base.order.findUnique({ where: { id: order.id } });
      expect(dbOrder!.status).toBe(false);
    });

    it('branch inexistente → webhook ignorado', async () => {
      mp.getPayment.mockResolvedValue(
        buildMPPayment({ id: 710008, status: 'approved', transactionAmount: 150 })
      );

      const result = await confirmMP.execute({
        mpPaymentId: 710008,
        action: 'payment.updated',
        branchId: 'branch-que-no-existe',
      });

      expect(result).toBeNull();
      expect(mp.getPayment).not.toHaveBeenCalled();
    });

    it('external_reference legacy sin branchId → webhook ignorado', async () => {
      const order = await createOnlineOrder();
      await seedPendingPayment(order.id, 710009);

      mp.getPayment.mockResolvedValue(
        buildMPPayment({
          id: 710009,
          status: 'approved',
          externalReference: order.id,
          transactionAmount: 150,
        })
      );

      const result = await confirmMP.execute({
        mpPaymentId: 710009,
        action: 'payment.updated',
      });

      expect(result).toBeNull();
    });

    it('fallback legacy: branchId solo en external_reference → confirma igual', async () => {
      const order = await createLocalOrder();
      await seedPendingPayment(order.id, 710010);

      mp.getPayment.mockResolvedValue(
        buildMPPayment({
          id: 710010,
          status: 'approved',
          externalReference: `${order.id}:${tenant.branchId}`,
          transactionAmount: 150,
        })
      );

      const result = await confirmMP.execute({
        mpPaymentId: 710010,
        action: 'payment.updated',
      });

      expect(result).not.toBeNull();
      expect(result!.payment.status).toBe(PaymentStatus.SUCCEEDED);
      const dbOrder = await base.order.findUnique({ where: { id: order.id } });
      expect(dbOrder!.status).toBe(true);
    });
  });

  describe('Autoservicio (in_process)', () => {
    it('cancela el pago in_process y marca el payment CANCELED', async () => {
      const order = await createOnlineOrder();
      const payment = await seedPendingPayment(order.id, 710011);

      mp.getPayment.mockResolvedValue(
        buildMPPayment({
          id: 710011,
          status: 'in_process',
          statusDetail: 'pending_review_manual',
          externalReference: `${order.id}:${tenant.branchId}`,
          transactionAmount: 150,
          dateApproved: null,
        })
      );
      mp.cancelPayment.mockResolvedValue({ status: 'cancelled', statusDetail: '' });

      const result = await confirmMP.execute({
        mpPaymentId: 710011,
        action: 'payment.updated',
        branchId: tenant.branchId,
      });

      expect(mp.cancelPayment).toHaveBeenCalledWith('710011');
      expect(result!.payment.status).toBe(PaymentStatus.CANCELED);
      const dbPayment = await base.payment.findUnique({ where: { id: payment.id } });
      expect(dbPayment!.status).toBe(PaymentStatus.CANCELED);
      const dbOrder = await base.order.findUnique({ where: { id: order.id } });
      expect(dbOrder!.status).toBe(false);
    });

    it('si el banco aprobó antes de cancelar, reprocesa como aprobado', async () => {
      const order = await createOnlineOrder();
      await seedPendingPayment(order.id, 710012);

      mp.getPayment.mockResolvedValue(
        buildMPPayment({
          id: 710012,
          status: 'in_process',
          statusDetail: 'pending_review_manual',
          externalReference: `${order.id}:${tenant.branchId}`,
          transactionAmount: 150,
          dateApproved: null,
        })
      );
      mp.cancelPayment.mockResolvedValue({ status: 'approved', statusDetail: '' });

      const result = await confirmMP.execute({
        mpPaymentId: 710012,
        action: 'payment.updated',
        branchId: tenant.branchId,
      });

      expect(result!.payment.status).toBe(PaymentStatus.SUCCEEDED);
      const dbOrder = await base.order.findUnique({ where: { id: order.id } });
      expect(dbOrder!.status).toBe(true);
      expect(dbOrder!.delivered).toBe(false);
      expect(dbOrder!.deliveryStatus).toBe('PAID');
    });
  });
});
