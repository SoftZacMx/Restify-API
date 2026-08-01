import request from 'supertest';
import { randomUUID } from 'crypto';
import {
  PrismaClient,
  OrganizationPlan,
  UserRole,
  PaymentStatus,
  PendingCheckoutStatus,
  ExpenseType,
} from '@prisma/client';
import { encrypt } from '../../../src/shared/utils/crypto.util';
import type { Express } from 'express';
import { ensureTestEnv as ensureBaseTestEnv, shouldSkipIntegration } from '../utils';

/**
 * Webhook de Mercado Pago (POST /api/payments/webhooks/mercado-pago) sobre el flujo
 * de checkout diferido (Opción A): un pago aprobado materializa la orden real a partir
 * del borrador (PendingCheckout), confirma el Payment y registra el gasto de comisión.
 *
 * MercadoPagoService se mockea por módulo (jest.mock): createPreference se usa al crear
 * el checkout vía HTTP; getPayment devuelve el estado del pago según el escenario.
 * Se cubren: aprobado → materialización + gasto, idempotencia del doble webhook,
 * rechazado → PAYMENT_FAILED, monto distinto → no materializa, in_process → auto-cancel,
 * y branch inexistente → webhook ignorado (200 received).
 */

const mockCreatePreference = jest.fn();
const mockGetPayment = jest.fn();
const mockCancelPayment = jest.fn();

jest.mock('../../../src/core/infrastructure/payment-gateways/mercado-pago.service', () => ({
  MercadoPagoService: jest.fn().mockImplementation(() => ({
    createPreference: mockCreatePreference,
    getPayment: mockGetPayment,
    cancelPayment: mockCancelPayment,
  })),
}));

function ensureTestEnv(): void {
  ensureBaseTestEnv();
  process.env.BILLING_ENABLED = 'false';
  process.env.EMAIL_ENABLED = 'false';
}

describe('Mercado Pago Webhook Integration', () => {
  const prisma = new PrismaClient();
  let app: Express;
  let skipped = true;

  let organizationId: string;
  let branchId: string;
  let menuItemId: string;
  const menuItemName = 'Hamburguesa Clásica';

  const MP_APPROVED = 20001;
  const MP_DUPLICATE = 20006;
  const MP_REJECTED = 20002;
  const MP_AMOUNT_MISMATCH = 20003;
  const MP_IN_PROCESS = 20004;
  const MP_UNKNOWN_BRANCH = 20005;

  beforeAll(async () => {
    skipped = shouldSkipIntegration();
    if (skipped) {
      return;
    }

    ensureTestEnv();

    let preferenceCounter = 0;
    mockCreatePreference.mockImplementation((params: { expirationDate?: string }) => {
      preferenceCounter += 1;
      return Promise.resolve({
        id: `pref_${Date.now()}_${preferenceCounter}`,
        initPoint: 'https://sandbox.mercadopago.com.mx/checkout/v1/preview',
        sandboxInitPoint: 'https://sandbox.mercadopago.com.mx/checkout/v1/preview',
        expirationDate: params.expirationDate ?? null,
      });
    });

    try {
      const org = await prisma.organization.create({
        data: { name: `Webhook Org ${Date.now()}`, plan: OrganizationPlan.FREE },
      });
      organizationId = org.id;

      const owner = await prisma.user.create({
        data: {
          email: `webhook-owner-${Date.now()}@test.local`,
          password: 'hash',
          name: 'Owner',
          last_name: 'Test',
          rol: UserRole.OWNER,
          organizationId,
        },
      });

      const branch = await prisma.branch.create({
        data: {
          organizationId,
          name: 'Sucursal Webhook',
          slug: `webhook-branch-${Date.now()}`,
          state: 'CDMX',
          city: 'CDMX',
          street: 'Reforma',
          exteriorNumber: '100',
          phone: '5555555555',
          timezone: 'America/Mexico_City',
          currency: 'MXN',
          paymentConfig: encrypt(
            JSON.stringify({
              mercadoPago: {
                accessToken: 'TEST-0000',
                webhookSecret: 'whsec_test',
              },
            })
          ),
        },
      });
      branchId = branch.id;

      const menuItem = await prisma.menuItem.create({
        data: {
          name: menuItemName,
          price: 50,
          userId: owner.id,
          branchId,
          status: true,
          isExtra: false,
        },
      });
      menuItemId = menuItem.id;

      const { default: LocalServer } = await import('../../../src/server/server');
      app = new LocalServer().getApp();
    } catch {
      skipped = true;
    }
  });

  afterAll(async () => {
    if (skipped) {
      await prisma.$disconnect();
      return;
    }

    // Order.branchId es onDelete:SetNull → borrar órdenes antes que branches/orgs.
    await prisma.expense.deleteMany({ where: { branchId } });
    await prisma.paymentSession.deleteMany({ where: { branchId } });
    await prisma.payment.deleteMany({ where: { branchId } });
    await prisma.pendingCheckout.deleteMany({ where: { branchId } });
    await prisma.order.deleteMany({ where: { branchId } });
    await prisma.branch.deleteMany({ where: { id: branchId } });
    await prisma.organization.deleteMany({ where: { id: organizationId } });
    await prisma.$disconnect();
  });

  const startCheckout = async () => {
    const res = await request(app)
      .post('/api/public/checkout')
      .send({
        branchId,
        customerName: 'Cliente MP',
        customerPhone: '5550002222',
        orderType: 'DELIVERY',
        deliveryAddress: 'Calle 1',
        items: [{ menuItemId, quantity: 2 }],
      })
      .expect(200);

    return res.body.data as {
      checkoutId: string;
      trackingToken: string;
      paymentId: string;
      preferenceId: string;
      initPoint: string;
      total: number;
    };
  };

  const makePayment = (opts: {
    id: number;
    checkoutId: string;
    total: number;
    status?: string;
    fee?: number;
  }) => ({
    id: opts.id,
    status: opts.status ?? 'approved',
    statusDetail: 'accredited',
    externalReference: `checkout:${opts.checkoutId}:${branchId}`,
    transactionAmount: opts.total,
    currencyId: 'MXN',
    paymentMethodId: 'qr',
    paymentTypeId: 'bank_transfer',
    dateApproved: new Date().toISOString(),
    feeDetails:
      opts.fee && opts.fee > 0
        ? [{ type: 'mercadopago_fee', amount: opts.fee, feePayer: 'collector' }]
        : [],
  });

  const sendWebhook = (mpPaymentId: number) =>
    request(app)
      .post('/api/payments/webhooks/mercado-pago')
      .query({ branchId })
      .send({ type: 'payment', data: { id: mpPaymentId } });

  it('webhook con pago aprobado materializa la orden, confirma el Payment y registra el gasto de comisión', async () => {
    if (skipped) return;

    const checkout = await startCheckout();
    mockGetPayment.mockResolvedValue(
      makePayment({ id: MP_APPROVED, checkoutId: checkout.checkoutId, total: checkout.total, fee: 5 })
    );

    const res = await sendWebhook(MP_APPROVED).expect(200);
    expect(res.body.data.received).toBe(true);

    const order = await prisma.order.findUnique({ where: { trackingToken: checkout.trackingToken } });
    expect(order).not.toBeNull();
    expect(order?.branchId).toBe(branchId);
    expect(order?.status).toBe(true);
    expect(order?.paymentMethod).toBe(4);
    expect(order?.delivered).toBe(false);
    expect(order?.deliveryStatus).toBe('PAID');
    expect(order?.origin).toBe('online-delivery');
    expect(Number(order?.total)).toBe(checkout.total);

    const orderItems = await prisma.orderItem.count({ where: { orderId: order!.id } });
    expect(orderItems).toBe(1);

    const payment = await prisma.payment.findUnique({ where: { id: checkout.paymentId } });
    expect(payment).not.toBeNull();
    expect(payment?.status).toBe(PaymentStatus.SUCCEEDED);
    expect(payment?.gatewayTransactionId).toBe(String(MP_APPROVED));
    expect(payment?.orderId).toBe(order!.id);

    const expense = await prisma.expense.findFirst({ where: { paymentId: checkout.paymentId } });
    expect(expense).not.toBeNull();
    expect(expense?.type).toBe(ExpenseType.MERCADO_PAGO_FEE);
    expect(Number(expense?.total)).toBe(5);

    const persistedCheckout = await prisma.pendingCheckout.findUnique({ where: { id: checkout.checkoutId } });
    expect(persistedCheckout?.status).toBe(PendingCheckoutStatus.CONSUMED);
    expect(persistedCheckout?.orderId).toBe(order!.id);

    const status = await request(app)
      .get(`/api/public/orders/by-checkout-id/${checkout.checkoutId}/status`)
      .expect(200);
    expect(status.body.data.status).toBe('PAID');
  });

  it('webhook reenviado para el mismo pago no duplica orden ni gasto (idempotencia)', async () => {
    if (skipped) return;

    const checkout = await startCheckout();
    mockGetPayment.mockResolvedValue(
      makePayment({ id: MP_DUPLICATE, checkoutId: checkout.checkoutId, total: checkout.total, fee: 5 })
    );

    await sendWebhook(MP_DUPLICATE).expect(200);
    await sendWebhook(MP_DUPLICATE).expect(200);

    const orders = await prisma.order.count({ where: { trackingToken: checkout.trackingToken } });
    expect(orders).toBe(1);

    const expenses = await prisma.expense.count({ where: { paymentId: checkout.paymentId } });
    expect(expenses).toBe(1);

    const payment = await prisma.payment.findUnique({ where: { id: checkout.paymentId } });
    expect(payment?.status).toBe(PaymentStatus.SUCCEEDED);

    const persistedCheckout = await prisma.pendingCheckout.findUnique({ where: { id: checkout.checkoutId } });
    expect(persistedCheckout?.status).toBe(PendingCheckoutStatus.CONSUMED);
  });

  it('webhook con pago rechazado no crea orden y deja el checkout EXPIRED → PAYMENT_FAILED', async () => {
    if (skipped) return;

    const checkout = await startCheckout();
    mockGetPayment.mockResolvedValue(
      makePayment({
        id: MP_REJECTED,
        checkoutId: checkout.checkoutId,
        total: checkout.total,
        status: 'rejected',
        fee: 0,
      })
    );

    await sendWebhook(MP_REJECTED).expect(200);

    const order = await prisma.order.findUnique({ where: { trackingToken: checkout.trackingToken } });
    expect(order).toBeNull();

    const payment = await prisma.payment.findUnique({ where: { id: checkout.paymentId } });
    expect(payment?.status).toBe(PaymentStatus.FAILED);
    expect(payment?.orderId).toBeNull();

    const persistedCheckout = await prisma.pendingCheckout.findUnique({ where: { id: checkout.checkoutId } });
    expect(persistedCheckout?.status).toBe(PendingCheckoutStatus.EXPIRED);

    const status = await request(app)
      .get(`/api/public/orders/by-checkout-id/${checkout.checkoutId}/status`)
      .expect(200);
    expect(status.body.data.status).toBe('PAYMENT_FAILED');
  });

  it('webhook con monto cobrado distinto al total no materializa la orden', async () => {
    if (skipped) return;

    const checkout = await startCheckout();
    mockGetPayment.mockResolvedValue(
      makePayment({
        id: MP_AMOUNT_MISMATCH,
        checkoutId: checkout.checkoutId,
        total: checkout.total - 1,
        fee: 5,
      })
    );

    await sendWebhook(MP_AMOUNT_MISMATCH).expect(200);

    const order = await prisma.order.findUnique({ where: { trackingToken: checkout.trackingToken } });
    expect(order).toBeNull();

    const payment = await prisma.payment.findUnique({ where: { id: checkout.paymentId } });
    expect(payment?.status).toBe(PaymentStatus.PROCESSING);

    const persistedCheckout = await prisma.pendingCheckout.findUnique({ where: { id: checkout.checkoutId } });
    expect(persistedCheckout?.status).toBe(PendingCheckoutStatus.WAITING);

    const status = await request(app)
      .get(`/api/public/orders/by-checkout-id/${checkout.checkoutId}/status`)
      .expect(200);
    expect(status.body.data.status).toBe('PENDING_PAYMENT');
  });

  it('webhook con pago in_process se cancela automáticamente (autoservicio)', async () => {
    if (skipped) return;

    const checkout = await startCheckout();
    mockGetPayment.mockResolvedValue(
      makePayment({
        id: MP_IN_PROCESS,
        checkoutId: checkout.checkoutId,
        total: checkout.total,
        status: 'in_process',
        fee: 5,
      })
    );
    mockCancelPayment.mockResolvedValue({ status: 'cancelled', statusDetail: 'cancelled' });

    await sendWebhook(MP_IN_PROCESS).expect(200);

    const order = await prisma.order.findUnique({ where: { trackingToken: checkout.trackingToken } });
    expect(order).toBeNull();

    const payment = await prisma.payment.findUnique({ where: { id: checkout.paymentId } });
    expect(payment?.status).toBe(PaymentStatus.CANCELED);

    const persistedCheckout = await prisma.pendingCheckout.findUnique({ where: { id: checkout.checkoutId } });
    expect(persistedCheckout?.status).toBe(PendingCheckoutStatus.EXPIRED);

    const status = await request(app)
      .get(`/api/public/orders/by-checkout-id/${checkout.checkoutId}/status`)
      .expect(200);
    expect(status.body.data.status).toBe('PAYMENT_FAILED');
  });

  it('webhook con branch inexistente se ignora (200 received, sin cambios)', async () => {
    if (skipped) return;

    mockGetPayment.mockResolvedValue(
      makePayment({ id: MP_UNKNOWN_BRANCH, checkoutId: randomUUID(), total: 100, fee: 5 })
    );

    const res = await request(app)
      .post('/api/payments/webhooks/mercado-pago')
      .query({ branchId: randomUUID() })
      .send({ type: 'payment', data: { id: MP_UNKNOWN_BRANCH } })
      .expect(200);

    expect(res.body.data.received).toBe(true);
  });
});
