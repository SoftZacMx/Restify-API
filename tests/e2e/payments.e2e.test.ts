/// <reference types="jest" />

import { PrismaClient, PaymentStatus, PaymentMethod, PaymentGateway } from '@prisma/client';
import { PayPublicOrderUseCase } from '../../src/core/application/use-cases/payments/pay-public-order.use-case';
import { GetPaymentSessionUseCase } from '../../src/core/application/use-cases/payments/get-payment-session.use-case';
import { GetQRPaymentStatusUseCase } from '../../src/core/application/use-cases/payments/get-qr-payment-status.use-case';
import { ListPaymentsUseCase } from '../../src/core/application/use-cases/payments/list-payments.use-case';
import { PaymentConfigService } from '../../src/core/application/services/payment-config.service';
import { BranchTimezoneService } from '../../src/core/application/services/branch-timezone.service';
import { PaymentRepository } from '../../src/core/infrastructure/database/repositories/payment.repository';
import { PaymentSessionRepository } from '../../src/core/infrastructure/database/repositories/payment-session.repository';
import { OrderRepository } from '../../src/core/infrastructure/database/repositories/order.repository';
import { BranchRepository } from '../../src/core/infrastructure/database/repositories/branch.repository';
import { runWithTenant } from '../../src/core/infrastructure/tenant/tenant-context';
import { encrypt, decrypt } from '../../src/shared/utils/crypto.util';
import { AppError } from '../../src/shared/errors';
import {
  ensurePaymentE2EEnv,
  shouldSkipPaymentE2E,
  createPaymentE2ETenant,
  cleanupPaymentE2ETenant,
  createFakeMercadoPagoService,
  prismaClient,
  PaymentE2ETenant,
} from './payment-e2e.helper';

const e2eSkip = shouldSkipPaymentE2E();
describe('E2E Pagos — PayPublicOrder / sessions / status / list / config (BD real)', () => {
  if (e2eSkip) {
    it('se omite: requiere MySQL local (DATABASE_URL con localhost)', () => {});
    return;
  }

  const base = new PrismaClient();
  const prisma = prismaClient;

  let tenant: PaymentE2ETenant;
  const createdOrderIds: string[] = [];
  const createdPaymentIds: string[] = [];

  const paymentRepo = new PaymentRepository(prisma);
  const sessionRepo = new PaymentSessionRepository(prisma);
  const orderRepo = new OrderRepository(prisma);
  const branchRepo = new BranchRepository(prisma);
  const mp = createFakeMercadoPagoService();

  const payPublicOrder = new PayPublicOrderUseCase(
    orderRepo,
    paymentRepo,
    sessionRepo,
    branchRepo,
    mp.service
  );
  const getPaymentSession = new GetPaymentSessionUseCase(sessionRepo);
  const getQRStatus = new GetQRPaymentStatusUseCase(paymentRepo, mp.service);
  const listPayments = new ListPaymentsUseCase(
    paymentRepo,
    new BranchTimezoneService(branchRepo)
  );
  const paymentConfig = new PaymentConfigService(branchRepo);

  async function createPublicOrder(overrides: Partial<{
    userId: string | null;
    status: boolean;
    total: number;
    branchId: string | null;
    origin: string;
  }> = {}) {
    const order = await base.order.create({
      data: {
        status: overrides.status ?? false,
        paymentMethod: null,
        total: overrides.total ?? 150,
        subtotal: overrides.total ?? 150,
        iva: 0,
        delivered: false,
        tableId: null,
        tip: 0,
        origin: overrides.origin ?? 'online-delivery',
        client: null,
        paymentDiffer: false,
        note: null,
        userId: overrides.userId ?? null,
        customerName: 'Cliente E2E',
        customerPhone: '5550000000',
        branchId: overrides.branchId === undefined ? tenant.branchId : overrides.branchId,
      },
    });
    createdOrderIds.push(order.id);
    return order;
  }

  async function createPendingMPPayment(orderId: string, gatewayTransactionId: string) {
    const payment = await base.payment.create({
      data: {
        orderId,
        userId: null,
        amount: 150,
        currency: 'MXN',
        status: PaymentStatus.PENDING,
        paymentMethod: PaymentMethod.QR_MERCADO_PAGO,
        gateway: PaymentGateway.MERCADO_PAGO,
        gatewayTransactionId,
        branchId: tenant.branchId,
      },
    });
    createdPaymentIds.push(payment.id);
    return payment;
  }

  beforeAll(async () => {
    tenant = await createPaymentE2ETenant(base);
  });

  afterAll(async () => {
    await cleanupPaymentE2ETenant(base, tenant.branchId, tenant.orgId);
    if (createdPaymentIds.length) {
      await base.payment.deleteMany({ where: { id: { in: createdPaymentIds } } });
    }
    if (createdOrderIds.length) {
      await base.payment.deleteMany({ where: { orderId: { in: createdOrderIds } } });
      await base.order.deleteMany({ where: { id: { in: createdOrderIds } } });
    }
    await base.$disconnect();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('PayPublicOrderUseCase', () => {
    it('crea Payment + Session y llama a MP con la preferencia correcta', async () => {
      const order = await createPublicOrder();
      mp.createPreference.mockResolvedValue({
        id: 'pref-happy-e2e',
        initPoint: 'https://init.mercadopago.com/happy',
        sandboxInitPoint: '',
        expirationDate: null,
      });

      const result = await payPublicOrder.execute({ orderId: order.id });

      expect(result.paymentId).toBeTruthy();
      expect(result.preferenceId).toBe('pref-happy-e2e');
      expect(result.initPoint).toBe('https://init.mercadopago.com/happy');
      expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());

      const payment = await base.payment.findUnique({ where: { id: result.paymentId } });
      expect(payment).not.toBeNull();
      expect(payment!.orderId).toBe(order.id);
      expect(payment!.status).toBe(PaymentStatus.PENDING);
      expect(payment!.paymentMethod).toBe(PaymentMethod.QR_MERCADO_PAGO);
      expect(payment!.gateway).toBe(PaymentGateway.MERCADO_PAGO);
      expect(payment!.gatewayTransactionId).toBe('pref-happy-e2e');
      expect(payment!.branchId).toBe(tenant.branchId);

      const session = await base.paymentSession.findUnique({
        where: { paymentId: result.paymentId },
      });
      expect(session).not.toBeNull();
      expect(session!.clientSecret).toBe('https://init.mercadopago.com/happy');
      expect(session!.expiresAt.getTime()).toBe(result.expiresAt.getTime());

      expect(mp.createPreference).toHaveBeenCalledTimes(1);
      const params = mp.createPreference.mock.calls[0][0];
      expect(params.amount).toBe(150);
      expect(params.currency).toBe('MXN');
      expect(params.metadata.orderId).toBe(order.id);
      expect(params.metadata.paymentId).toBe(result.paymentId);
      expect(params.notificationUrl).toContain(`branchId=${tenant.branchId}`);
    });

    it('lanza ORDER_NOT_FOUND si la orden no existe', async () => {
      await expect(payPublicOrder.execute({ orderId: 'no-existe' })).rejects.toMatchObject({
        code: 'ORDER_NOT_FOUND',
      });
    });

    it('lanza ORDER_ALREADY_PAID si la orden ya está pagada', async () => {
      const order = await createPublicOrder({ status: true });
      await expect(payPublicOrder.execute({ orderId: order.id })).rejects.toMatchObject({
        code: 'ORDER_ALREADY_PAID',
      });
    });

    it('lanza VALIDATION_ERROR si la orden tiene userId (solo públicas)', async () => {
      const order = await createPublicOrder({ userId: tenant.userId });
      await expect(payPublicOrder.execute({ orderId: order.id })).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
      });
    });

    it('reutiliza un pago MP pendiente con sesión vigente sin crear duplicados', async () => {
      const order = await createPublicOrder();
      const existing = await createPendingMPPayment(order.id, 'pref-reuse-e2e');
      await base.paymentSession.create({
        data: {
          paymentId: existing.id,
          clientSecret: 'https://init.mercadopago.com/reuse',
          expiresAt: new Date(Date.now() + 60_000),
          branchId: tenant.branchId,
        },
      });

      const result = await payPublicOrder.execute({ orderId: order.id });

      expect(result.paymentId).toBe(existing.id);
      expect(result.preferenceId).toBe('pref-reuse-e2e');
      expect(result.initPoint).toBe('https://init.mercadopago.com/reuse');
      expect(mp.createPreference).not.toHaveBeenCalled();

      const count = await base.payment.count({ where: { orderId: order.id } });
      expect(count).toBe(1);
    });

    it('sesión expirada: cancela el pago viejo y crea uno nuevo', async () => {
      const order = await createPublicOrder();
      const existing = await createPendingMPPayment(order.id, 'pref-expired-e2e');
      await base.paymentSession.create({
        data: {
          paymentId: existing.id,
          clientSecret: 'https://init.mercadopago.com/expired',
          expiresAt: new Date(Date.now() - 60_000),
          branchId: tenant.branchId,
        },
      });
      mp.createPreference.mockResolvedValue({
        id: 'pref-new-e2e',
        initPoint: 'https://init.mercadopago.com/new',
        sandboxInitPoint: '',
        expirationDate: null,
      });

      const result = await payPublicOrder.execute({ orderId: order.id });

      expect(result.paymentId).not.toBe(existing.id);

      const oldPayment = await base.payment.findUnique({ where: { id: existing.id } });
      expect(oldPayment!.status).toBe(PaymentStatus.CANCELED);

      const oldSession = await base.paymentSession.findUnique({ where: { paymentId: existing.id } });
      expect(oldSession).toBeNull();

      const newSession = await base.paymentSession.findUnique({ where: { paymentId: result.paymentId } });
      expect(newSession).not.toBeNull();
      expect(mp.createPreference).toHaveBeenCalledTimes(1);
    });

    it('soporta órdenes sin branchId (fallback legacy)', async () => {
      const order = await createPublicOrder({ branchId: null });
      mp.createPreference.mockResolvedValue({
        id: 'pref-legacy-e2e',
        initPoint: 'https://init.mercadopago.com/legacy',
        sandboxInitPoint: '',
        expirationDate: null,
      });

      const result = await payPublicOrder.execute({ orderId: order.id });

      expect(result.preferenceId).toBe('pref-legacy-e2e');
      const params = mp.createPreference.mock.calls[0][0];
      expect(params.branchId).toBeUndefined();
    });
  });

  describe('GetPaymentSessionUseCase', () => {
    it('devuelve la sesión vigente', async () => {
      const order = await createPublicOrder();
      const payment = await createPendingMPPayment(order.id, 'pref-session-e2e');
      const session = await base.paymentSession.create({
        data: {
          paymentId: payment.id,
          clientSecret: 'secret-e2e',
          connectionId: 'conn-1',
          expiresAt: new Date(Date.now() + 60_000),
          branchId: tenant.branchId,
        },
      });

      const result = await runWithTenant(
        { organizationId: tenant.orgId, branchId: tenant.branchId },
        () => getPaymentSession.execute({ payment_id: payment.id })
      );

      expect(result.id).toBe(session.id);
      expect(result.clientSecret).toBe('secret-e2e');
      expect(result.connectionId).toBe('conn-1');
    });

    it('lanza PAYMENT_SESSION_NOT_FOUND si no existe', async () => {
      await runWithTenant(
        { organizationId: tenant.orgId, branchId: tenant.branchId },
        async () => {
          await expect(getPaymentSession.execute({ payment_id: 'no-session' })).rejects.toMatchObject({
            code: 'PAYMENT_SESSION_NOT_FOUND',
          });
        }
      );
    });

    it('lanza PAYMENT_SESSION_EXPIRED si la sesión venció', async () => {
      const order = await createPublicOrder();
      const payment = await createPendingMPPayment(order.id, 'pref-session-expired-e2e');
      await base.paymentSession.create({
        data: {
          paymentId: payment.id,
          clientSecret: 'secret-expired',
          expiresAt: new Date(Date.now() - 60_000),
          branchId: tenant.branchId,
        },
      });

      await runWithTenant(
        { organizationId: tenant.orgId, branchId: tenant.branchId },
        async () => {
          await expect(getPaymentSession.execute({ payment_id: payment.id })).rejects.toMatchObject({
            code: 'PAYMENT_SESSION_EXPIRED',
          });
        }
      );
    });
  });

  describe('GetQRPaymentStatusUseCase', () => {
    it('lanza PAYMENT_NOT_FOUND si no hay pago MP para la orden', async () => {
      const order = await createPublicOrder();
      await runWithTenant(
        { organizationId: tenant.orgId, branchId: tenant.branchId },
        async () => {
          await expect(getQRStatus.execute({ orderId: order.id })).rejects.toMatchObject({
            code: 'PAYMENT_NOT_FOUND',
          });
        }
      );
    });

    it('devuelve el estado local cuando es terminal (sin llamar a MP)', async () => {
      const order = await createPublicOrder();
      await base.payment.create({
        data: {
          orderId: order.id,
          userId: null,
          amount: 150,
          currency: 'MXN',
          status: PaymentStatus.SUCCEEDED,
          paymentMethod: PaymentMethod.QR_MERCADO_PAGO,
          gateway: PaymentGateway.MERCADO_PAGO,
          gatewayTransactionId: 'mp-terminal-1',
          branchId: tenant.branchId,
        },
      });

      const result = await runWithTenant(
        { organizationId: tenant.orgId, branchId: tenant.branchId },
        () => getQRStatus.execute({ orderId: order.id })
      );

      expect(result.status).toBe(PaymentStatus.SUCCEEDED);
      expect(mp.getPayment).not.toHaveBeenCalled();
    });

    it('consulta MP cuando está PENDING y actualiza a SUCCEEDED si fue aprobado', async () => {
      const order = await createPublicOrder();
      const payment = await createPendingMPPayment(order.id, 'mp-pending-live');
      mp.getPayment.mockResolvedValue({
        id: 555,
        status: 'approved',
        statusDetail: 'accredited',
        externalReference: order.id,
        transactionAmount: 150,
        currencyId: 'MXN',
        paymentMethodId: 'visa',
        paymentTypeId: 'credit_card',
        dateApproved: new Date().toISOString(),
        feeDetails: [],
      });

      const result = await runWithTenant(
        { organizationId: tenant.orgId, branchId: tenant.branchId },
        () => getQRStatus.execute({ orderId: order.id })
      );

      expect(result.status).toBe(PaymentStatus.SUCCEEDED);
      const updated = await base.payment.findUnique({ where: { id: payment.id } });
      expect(updated!.status).toBe(PaymentStatus.SUCCEEDED);
    });
  });

  describe('ListPaymentsUseCase', () => {
    it('lista los pagos del branch (aislados por tenant)', async () => {
      const order = await createPublicOrder();
      await base.payment.create({
        data: {
          orderId: order.id,
          userId: null,
          amount: 150,
          currency: 'MXN',
          status: PaymentStatus.SUCCEEDED,
          paymentMethod: PaymentMethod.QR_MERCADO_PAGO,
          gateway: PaymentGateway.MERCADO_PAGO,
          gatewayTransactionId: 'list-paid-1',
          branchId: tenant.branchId,
        },
      });
      await base.payment.create({
        data: {
          orderId: order.id,
          userId: null,
          amount: 150,
          currency: 'MXN',
          status: PaymentStatus.FAILED,
          paymentMethod: PaymentMethod.QR_MERCADO_PAGO,
          gateway: PaymentGateway.MERCADO_PAGO,
          gatewayTransactionId: 'list-failed-1',
          branchId: tenant.branchId,
        },
      });

      const all = await runWithTenant(
        { organizationId: tenant.orgId, branchId: tenant.branchId },
        () => listPayments.execute()
      );
      expect(all.length).toBeGreaterThanOrEqual(2);
      expect(all.every((p) => p.gateway === PaymentGateway.MERCADO_PAGO)).toBe(true);

      const failed = await runWithTenant(
        { organizationId: tenant.orgId, branchId: tenant.branchId },
        () => listPayments.execute({ status: PaymentStatus.FAILED })
      );
      expect(failed.length).toBe(1);
      expect(failed[0].status).toBe(PaymentStatus.FAILED);
    });
  });

  describe('PaymentConfigService', () => {
    it('get() sin tenant cae a la config del .env', async () => {
      const previous = process.env.MP_ACCESS_TOKEN;
      process.env.MP_ACCESS_TOKEN = 'APP_USR-env-token';
      try {
        const config = await paymentConfig.get();
        expect(config.mercadoPago.accessToken).toBe('APP_USR-env-token');
      } finally {
        if (previous === undefined) delete process.env.MP_ACCESS_TOKEN;
        else process.env.MP_ACCESS_TOKEN = previous;
      }
    });

    it('getForCharging() sin branch lanza MERCHANT_PAYMENT_ACCOUNT_NOT_CONFIGURED', async () => {
      await expect(paymentConfig.getForCharging()).rejects.toMatchObject({
        code: 'MERCHANT_PAYMENT_ACCOUNT_NOT_CONFIGURED',
      });
    });

    it('getForCharging() no cae al .env cuando el branch no configuró cuenta', async () => {
      process.env.MP_ACCESS_TOKEN = 'APP_USR-debe-ignorarse';
      try {
        await runWithTenant(
          { organizationId: tenant.orgId, branchId: tenant.branchId },
          async () => {
            await expect(paymentConfig.getForCharging()).rejects.toMatchObject({
              code: 'MERCHANT_PAYMENT_ACCOUNT_NOT_CONFIGURED',
            });
          }
        );
      } finally {
        delete process.env.MP_ACCESS_TOKEN;
      }
    });

    it('save() persiste encriptado y get()/getForCharging() lo devuelven', async () => {
      await runWithTenant(
        { organizationId: tenant.orgId, branchId: tenant.branchId },
        async () => {
          await paymentConfig.save({
            mercadoPago: {
              accessToken: 'APP_USR-branch-token',
              webhookSecret: 'webhook-secret',
            },
          });

          const branch = await base.branch.findUnique({ where: { id: tenant.branchId } });
          expect(branch!.paymentConfig).toMatch(/^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/);
          const decrypted = JSON.parse(decrypt(branch!.paymentConfig!));
          expect(decrypted.mercadoPago.accessToken).toBe('APP_USR-branch-token');

          const got = await paymentConfig.get();
          expect(got.mercadoPago.accessToken).toBe('APP_USR-branch-token');

          const charging = await paymentConfig.getForCharging();
          expect(charging.mercadoPago.accessToken).toBe('APP_USR-branch-token');
        }
      );
    });

    it('clearCache() fuerza la relectura desde la BD', async () => {
      await runWithTenant(
        { organizationId: tenant.orgId, branchId: tenant.branchId },
        async () => {
          await paymentConfig.save({
            mercadoPago: { accessToken: 'APP_USR-cached', webhookSecret: 'ws' },
          });
          paymentConfig.clearCache(tenant.branchId);

          const branch = await base.branch.findUnique({ where: { id: tenant.branchId } });
          const decrypted = JSON.parse(decrypt(branch!.paymentConfig!));
          decrypted.mercadoPago.accessToken = 'APP_USR-db-direct';
          await base.branch.update({
            where: { id: tenant.branchId },
            data: { paymentConfig: encrypt(JSON.stringify(decrypted)) },
          });

          const got = await paymentConfig.get();
          expect(got.mercadoPago.accessToken).toBe('APP_USR-db-direct');
        }
      );
    });
  });
});
