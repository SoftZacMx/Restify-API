import request from 'supertest';
import { randomUUID } from 'crypto';
import { PrismaClient, OrganizationPlan, UserRole, PaymentStatus, PendingCheckoutStatus } from '@prisma/client';
import { encrypt } from '../../../src/shared/utils/crypto.util';
import type { Express } from 'express';
import { ensureTestEnv as ensureBaseTestEnv, shouldSkipIntegration } from '../utils';

/**
 * Checkout diferido público (Opción A) vía HTTP: POST /api/public/checkout.
 * El checkout NO crea la orden todavía: valida el carrito, precia el total, guarda
 * el borrador (PendingCheckout WAITING) + Payment PENDING + PaymentSession, y devuelve
 * initPoint/trackingToken. La orden real se materializa al confirmar el pago (webhook).
 *
 * BILLING_ENABLED=false: /api/public pasa por SubscriptionMiddleware.
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

describe('Public Checkout Integration', () => {
  const prisma = new PrismaClient();
  let app: Express;
  let skipped = true;

  let organizationId: string;
  let branchId: string;
  let noConfigBranchId: string;
  let menuItemId: string;
  const menuItemName = 'Hamburguesa Clásica';

  let checkoutId: string;
  let trackingToken: string;
  let paymentId: string;

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
        data: { name: `Checkout Org ${Date.now()}`, plan: OrganizationPlan.FREE },
      });
      organizationId = org.id;

      const owner = await prisma.user.create({
        data: {
          email: `checkout-owner-${Date.now()}@test.local`,
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
          name: 'Sucursal Checkout',
          slug: `checkout-branch-${Date.now()}`,
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

      const noConfigBranch = await prisma.branch.create({
        data: {
          organizationId,
          name: 'Sucursal Sin Cuenta MP',
          slug: `checkout-noconfig-${Date.now()}`,
          state: 'CDMX',
          city: 'CDMX',
          street: 'Reforma',
          exteriorNumber: '200',
          phone: '5555555556',
          timezone: 'America/Mexico_City',
          currency: 'MXN',
        },
      });
      noConfigBranchId = noConfigBranch.id;

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
    await prisma.order.deleteMany({ where: { branchId } });
    await prisma.paymentSession.deleteMany({ where: { branchId } });
    await prisma.payment.deleteMany({ where: { branchId } });
    await prisma.pendingCheckout.deleteMany({ where: { branchId } });
    await prisma.branch.deleteMany({
      where: { id: { in: [branchId, noConfigBranchId] } },
    });
    await prisma.organization.deleteMany({ where: { id: organizationId } });
    await prisma.$disconnect();
  });

  const publicRequest = (method: 'get' | 'post', path: string) => request(app)[method](path);

  it('POST /api/public/checkout inicia el pago sin crear orden (borrador + Payment PENDING)', async () => {
    if (skipped) return;

    const res = await publicRequest('post', '/api/public/checkout')
      .send({
        branchId,
        customerName: 'Cliente Checkout',
        customerPhone: '5550001111',
        orderType: 'DELIVERY',
        deliveryAddress: 'Calle Falsa 123',
        items: [{ menuItemId, quantity: 2 }],
      })
      .expect(200);

    expect(res.body.data.checkoutId).toBeDefined();
    expect(res.body.data.trackingToken).toBeDefined();
    expect(res.body.data.paymentId).toBeDefined();
    expect(res.body.data.preferenceId).toBeDefined();
    expect(res.body.data.initPoint).toBeDefined();
    expect(res.body.data.total).toBe(100);

    checkoutId = res.body.data.checkoutId;
    trackingToken = res.body.data.trackingToken;
    paymentId = res.body.data.paymentId;

    const checkout = await prisma.pendingCheckout.findUnique({ where: { id: checkoutId } });
    expect(checkout).not.toBeNull();
    expect(checkout?.status).toBe(PendingCheckoutStatus.WAITING);
    expect(checkout?.orderId).toBeNull();
    expect(checkout?.trackingToken).toBe(trackingToken);
    expect(checkout?.branchId).toBe(branchId);
    expect(Number(checkout?.total)).toBe(100);
    expect(checkout?.mpPreferenceId).toBe(res.body.data.preferenceId);

    const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
    expect(payment).not.toBeNull();
    expect(payment?.status).toBe(PaymentStatus.PENDING);
    expect(payment?.orderId).toBeNull();
    expect(Number(payment?.amount)).toBe(100);
    expect(payment?.gatewayTransactionId).toBe(res.body.data.preferenceId);

    const session = await prisma.paymentSession.findFirst({ where: { paymentId } });
    expect(session).not.toBeNull();
    expect(session?.clientSecret).toBe(res.body.data.initPoint);
  });

  it('GET /api/public/orders/by-checkout-id/:checkoutId/status reporta PENDING_PAYMENT antes de pagar', async () => {
    if (skipped) return;

    const res = await publicRequest('get', `/api/public/orders/by-checkout-id/${checkoutId}/status`).expect(200);
    expect(res.body.data.status).toBe('PENDING_PAYMENT');
    expect(res.body.data.trackingToken).toBe(trackingToken);
    expect(res.body.data.customerName).toBe('Cliente Checkout');
    expect(res.body.data.orderType).toBe('DELIVERY');
    expect(res.body.data.total).toBe(100);
    expect(res.body.data.items[0].name).toBe(menuItemName);
  });

  it('POST /api/public/checkout sin cuenta de cobro configurada → MERCHANT_PAYMENT_ACCOUNT_NOT_CONFIGURED', async () => {
    if (skipped) return;

    const res = await publicRequest('post', '/api/public/checkout')
      .send({
        branchId: noConfigBranchId,
        customerName: 'Cliente Sin Cuenta',
        customerPhone: '5550001112',
        orderType: 'PICKUP',
        items: [{ menuItemId, quantity: 1 }],
      })
      .expect(409);

    expect(res.body.error.code).toBe('MERCHANT_PAYMENT_ACCOUNT_NOT_CONFIGURED');

    const checkouts = await prisma.pendingCheckout.count({ where: { branchId: noConfigBranchId } });
    expect(checkouts).toBe(0);
  });

  it('POST /api/public/checkout con menu item inexistente → MENU_ITEM_NOT_FOUND', async () => {
    if (skipped) return;

    const res = await publicRequest('post', '/api/public/checkout')
      .send({
        branchId,
        customerName: 'Cliente Fantasma',
        customerPhone: '5550001113',
        orderType: 'PICKUP',
        items: [{ menuItemId: randomUUID(), quantity: 1 }],
      })
      .expect(404);

    expect(res.body.error.code).toBe('MENU_ITEM_NOT_FOUND');
  });

  it('GET /api/public/orders/by-checkout-id/:checkoutId/status con checkout inexistente → ORDER_NOT_FOUND', async () => {
    if (skipped) return;

    const res = await publicRequest('get', `/api/public/orders/by-checkout-id/${randomUUID()}/status`).expect(404);
    expect(res.body.error.code).toBe('ORDER_NOT_FOUND');
  });
});
