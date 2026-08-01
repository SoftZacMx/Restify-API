import request from 'supertest';
import { PrismaClient, OrganizationPlan, UserRole } from '@prisma/client';
import { JwtUtil } from '../../../src/shared/utils/jwt.util';
import type { Express } from 'express';
import { ensureTestEnv as ensureBaseTestEnv, shouldSkipIntegration } from '../utils';

/**
 * Ciclo de vida completo de una orden vía HTTP (supertest + DB real):
 *  create → list → get → update → pay (efectivo) → re-pay (rechazado) →
 *  amount mismatch (rechazado) → tickets (cocina/venta) → delivery-status
 *  (solo órdenes online) → aislamiento de sucursal → RBAC (WAITER no borra) → delete.
 *
 * Patrón de branches.integration.test.ts: JWT directo + skip automático si no
 * hay BD de test local. BILLING_ENABLED=false para no depender de suscripciones.
 */

function ensureTestEnv(): void {
  ensureBaseTestEnv();
  process.env.BILLING_ENABLED = 'false';
  process.env.EMAIL_ENABLED = 'false';
}

describe('Order Lifecycle API Integration', () => {
  const prisma = new PrismaClient();
  let app: Express;
  let skipped = true;

  let organizationId: string;
  let branchAId: string;
  let branchBId: string;
  let adminUserId: string;
  let menuItemAId: string;
  let menuItemBId: string;
  let adminToken: string;
  let waiterToken: string;

  let paidOrderId: string;

  beforeAll(async () => {
    skipped = shouldSkipIntegration();
    if (skipped) {
      return;
    }

    ensureTestEnv();

    try {
      const org = await prisma.organization.create({
        data: { name: `Order Lifecycle Org ${Date.now()}`, plan: OrganizationPlan.FREE },
      });
      organizationId = org.id;

      const admin = await prisma.user.create({
        data: {
          email: `order-admin-${Date.now()}@test.local`,
          password: 'hash',
          name: 'Admin',
          last_name: 'Test',
          rol: UserRole.ADMIN,
          organizationId,
        },
      });
      adminUserId = admin.id;

      const waiter = await prisma.user.create({
        data: {
          email: `order-waiter-${Date.now()}@test.local`,
          password: 'hash',
          name: 'Waiter',
          last_name: 'Test',
          rol: UserRole.WAITER,
          organizationId,
        },
      });

      const mkBranch = (name: string, slug: string) =>
        prisma.branch.create({
          data: {
            organizationId,
            name,
            slug,
            state: 'CDMX',
            city: 'CDMX',
            street: 'Calle',
            exteriorNumber: '1',
            phone: '5551111111',
            timezone: 'America/Mexico_City',
            currency: 'MXN',
          },
        });

      branchAId = (await mkBranch('Centro A', `order-a-${Date.now()}`)).id;
      branchBId = (await mkBranch('Norte B', `order-b-${Date.now()}`)).id;

      const mkMenuItem = (branchId: string, name: string, price: number) =>
        prisma.menuItem.create({
          data: { name, price, userId: adminUserId, branchId, status: true, isExtra: false },
        });

      menuItemAId = (await mkMenuItem(branchAId, 'Hamburguesa Clásica', 50)).id;
      menuItemBId = (await mkMenuItem(branchBId, 'Taco de Suadero', 30)).id;

      const { default: LocalServer } = await import('../../../src/server/server');
      app = new LocalServer().getApp();

      const mkToken = (user: typeof admin, rol: string) =>
        JwtUtil.generateToken({
          sub: user.id,
          email: user.email,
          rol,
          org: organizationId,
          branch: branchAId,
          tokenVersion: user.tokenVersion,
          emailVerified: user.emailVerifiedAt !== null,
          mustChangePassword: user.mustChangePassword,
        });

      adminToken = mkToken(admin, 'ADMIN');
      waiterToken = mkToken(waiter, 'WAITER');
    } catch {
      skipped = true;
    }
  });

  afterAll(async () => {
    if (skipped) {
      await prisma.$disconnect();
      return;
    }

    // Los pagos CASH se crean con el cliente base de Prisma (PayOrderUseCase), sin
    // branchId ni tenant extension: borrarlos por userId de las órdenes ANTES de borrar
    // órdenes/branches, o quedarían huérfanos con orderId/branchId SetNull.
    await prisma.payment.deleteMany({ where: { userId: adminUserId } });
    // Order.branchId es onDelete:SetNull → borrar órdenes antes que branches/orgs.
    await prisma.order.deleteMany({
      where: { branchId: { in: [branchAId, branchBId] } },
    });
    await prisma.branch.deleteMany({ where: { id: { in: [branchAId, branchBId] } } });
    await prisma.user.deleteMany({ where: { id: adminUserId } });
    await prisma.organization.delete({ where: { id: organizationId } });
    await prisma.$disconnect();
  });

  const authRequest = (method: 'get' | 'post' | 'put' | 'delete', path: string, token = adminToken) =>
    request(app)[method](path)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', [`token=${token}`]);

  const createOrder = async (overrides: Record<string, unknown> = {}) => {
    const res = await authRequest('post', '/api/orders')
      .send({
        paymentMethod: 1,
        origin: 'Local',
        tip: 0,
        paymentDiffer: false,
        userId: adminUserId,
        orderItems: [{ menuItemId: menuItemAId, quantity: 1, price: 50, extras: [] }],
        ...overrides,
      })
      .expect(200);
    expect(res.body.success).toBe(true);
    return res.body.data as { id: string; status: boolean; total: number };
  };

  it('POST /api/orders crea una orden POS con items', async () => {
    if (skipped) return;

    const order = await createOrder();
    paidOrderId = order.id;

    expect(order.status).toBe(false);
    expect(order.total).toBe(50);
  });

  it('GET /api/orders lista las órdenes con paginación', async () => {
    if (skipped) return;

    const res = await authRequest('get', '/api/orders').expect(200);
    expect(Array.isArray(res.body.data.data)).toBe(true);
    expect(res.body.data.pagination.total).toBeGreaterThanOrEqual(1);
  });

  it('GET /api/orders/:id devuelve la orden con sus items', async () => {
    if (skipped) return;

    const res = await authRequest('get', `/api/orders/${paidOrderId}`).expect(200);
    expect(res.body.data.id).toBe(paidOrderId);
    expect(res.body.data.orderItems).toHaveLength(1);
    expect(res.body.data.orderItems[0].menuItemId).toBe(menuItemAId);
  });

  it('PUT /api/orders/:id actualiza la orden (nota)', async () => {
    if (skipped) return;

    const res = await authRequest('put', `/api/orders/${paidOrderId}`)
      .send({ note: 'Nota de prueba' })
      .expect(200);

    expect(res.body.data.note).toBe('Nota de prueba');
  });

  it('POST /api/orders/:id/pay paga en efectivo', async () => {
    if (skipped) return;

    const res = await authRequest('post', `/api/orders/${paidOrderId}/pay`)
      .send({ paymentMethod: 'CASH', amount: 50 })
      .expect(200);

    expect(res.body.data.order.status).toBe(true);
    expect(res.body.data.order.delivered).toBe(true);
    expect(res.body.data.payment.paymentMethod).toBe('CASH');
  });

  it('Pagar dos veces devuelve ORDER_ALREADY_PAID', async () => {
    if (skipped) return;

    const res = await authRequest('post', `/api/orders/${paidOrderId}/pay`)
      .send({ paymentMethod: 'CASH', amount: 50 })
      .expect(400);

    expect(res.body.error.code).toBe('ORDER_ALREADY_PAID');
  });

  it('Pagar monto incorrecto devuelve PAYMENT_AMOUNT_MISMATCH', async () => {
    if (skipped) return;

    const order = await createOrder();
    const res = await authRequest('post', `/api/orders/${order.id}/pay`)
      .send({ paymentMethod: 'CASH', amount: 1 })
      .expect(400);

    expect(res.body.error.code).toBe('PAYMENT_AMOUNT_MISMATCH');
  });

  it('GET tickets de cocina y venta', async () => {
    if (skipped) return;

    const kitchen = await authRequest('get', `/api/orders/${paidOrderId}/ticket/kitchen-ticket`).expect(200);
    expect(kitchen.body.data.orderId).toBe(paidOrderId);
    expect(kitchen.body.data.lines).toContain('--- COCINA ---');

    const sale = await authRequest('get', `/api/orders/${paidOrderId}/ticket/sale-ticket`).expect(200);
    expect(sale.body.data.orderId).toBe(paidOrderId);
  });

  it('delivery-status rechaza órdenes que no son online', async () => {
    if (skipped) return;

    const res = await authRequest('put', `/api/orders/${paidOrderId}/delivery-status`)
      .send({ status: 'PREPARING' })
      .expect(400);

    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('delivery-status flujo completo para órdenes online (PREPARING → DELIVERED)', async () => {
    if (skipped) return;

    const order = await createOrder({ origin: 'online-delivery' });

    const prepping = await authRequest('put', `/api/orders/${order.id}/delivery-status`)
      .send({ status: 'PREPARING' })
      .expect(200);
    expect(prepping.body.data.deliveryStatus).toBe('PREPARING');

    const delivered = await authRequest('put', `/api/orders/${order.id}/delivery-status`)
      .send({ status: 'DELIVERED' })
      .expect(200);
    expect(delivered.body.data.delivered).toBe(true);
  });

  it('Aislamiento HTTP: un item de otra sucursal se rechaza (MENU_ITEM_NOT_FOUND)', async () => {
    if (skipped) return;

    const res = await authRequest('post', '/api/orders')
      .send({
        paymentMethod: 1,
        origin: 'Local',
        userId: adminUserId,
        orderItems: [{ menuItemId: menuItemBId, quantity: 1, price: 30, extras: [] }],
      })
      .expect(404);

    expect(res.body.error.code).toBe('MENU_ITEM_NOT_FOUND');
  });

  it('RBAC: WAITER no puede borrar órdenes (403)', async () => {
    if (skipped) return;

    const res = await authRequest('delete', `/api/orders/${paidOrderId}`, waiterToken).expect(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('ADMIN borra la orden y luego GET devuelve 404', async () => {
    if (skipped) return;

    const res = await authRequest('delete', `/api/orders/${paidOrderId}`).expect(200);
    expect(res.body.data.message).toBe('Order deleted successfully');

    const after = await authRequest('get', `/api/orders/${paidOrderId}`).expect(404);
    expect(after.body.error.code).toBe('ORDER_NOT_FOUND');
  });
});
