import request from 'supertest';
import { randomUUID } from 'crypto';
import { PrismaClient, OrganizationPlan, UserRole } from '@prisma/client';
import { JwtUtil } from '../../../src/shared/utils/jwt.util';
import type { Express } from 'express';
import { ensureTestEnv as ensureBaseTestEnv, shouldSkipIntegration } from '../utils';

/**
 * Flujo de pedidos públicos vía HTTP (sin auth, sujeta a rate-limiters):
 *  resolve branch por slug → menú público → crear pedido (trackingToken) →
 *  status por trackingToken → status por orderId → branch inexistente → error.
 *  Además: delivery-status interno (ADMIN) actualiza el status público de tracking.
 *
 * BILLING_ENABLED=false: /api/public pasa por SubscriptionMiddleware.
 */

function ensureTestEnv(): void {
  ensureBaseTestEnv();
  process.env.BILLING_ENABLED = 'false';
  process.env.EMAIL_ENABLED = 'false';
}

describe('Public Orders Integration', () => {
  const prisma = new PrismaClient();
  let app: Express;
  let skipped = true;

  let organizationId: string;
  let branchId: string;
  let branchSlug: string;
  let menuItemId: string;
  const menuItemName = 'Hamburguesa Clásica';

  let adminToken: string;
  let trackingToken: string;
  let createdOrderId: string;

  beforeAll(async () => {
    skipped = shouldSkipIntegration();
    if (skipped) {
      return;
    }

    ensureTestEnv();

    try {
      const org = await prisma.organization.create({
        data: { name: `Public Org ${Date.now()}`, plan: OrganizationPlan.FREE },
      });
      organizationId = org.id;

      const owner = await prisma.user.create({
        data: {
          email: `public-owner-${Date.now()}@test.local`,
          password: 'hash',
          name: 'Owner',
          last_name: 'Test',
          rol: UserRole.OWNER,
          organizationId,
        },
      });

      branchSlug = `public-branch-${Date.now()}`;
      const branch = await prisma.branch.create({
        data: {
          organizationId,
          name: 'Sucursal Pública',
          slug: branchSlug,
          state: 'CDMX',
          city: 'CDMX',
          street: 'Reforma',
          exteriorNumber: '100',
          phone: '5555555555',
          timezone: 'America/Mexico_City',
          currency: 'MXN',
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

      adminToken = JwtUtil.generateToken({
        sub: owner.id,
        email: owner.email,
        rol: 'OWNER',
        org: organizationId,
        branch: branchId,
        tokenVersion: owner.tokenVersion,
        emailVerified: owner.emailVerifiedAt !== null,
        mustChangePassword: owner.mustChangePassword,
      });
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
    await prisma.branch.deleteMany({ where: { id: branchId } });
    await prisma.organization.deleteMany({ where: { id: organizationId } });
    await prisma.$disconnect();
  });

  const publicRequest = (method: 'get' | 'post', path: string) => request(app)[method](path);
  const authRequest = (method: 'get' | 'post' | 'put' | 'delete', path: string) =>
    request(app)[method](path)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Cookie', [`token=${adminToken}`]);

  it('GET /api/public/branch/:slug resuelve la sucursal pública', async () => {
    if (skipped) return;

    const res = await publicRequest('get', `/api/public/branch/${branchSlug}`).expect(200);
    expect(res.body.data.branchId).toBe(branchId);
    expect(res.body.data.name).toBe('Sucursal Pública');
    expect(res.body.data.organizationName).toBeDefined();
  });

  it('GET /api/public/branch/:slug con slug inexistente → BRANCH_NOT_FOUND', async () => {
    if (skipped) return;

    const res = await publicRequest('get', `/api/public/branch/slug-inexistente-${Date.now()}`).expect(404);
    expect(res.body.error.code).toBe('BRANCH_NOT_FOUND');
  });

  it('GET /api/public/menu?branchId= devuelve el menú público del branch', async () => {
    if (skipped) return;

    const res = await publicRequest('get', `/api/public/menu?branchId=${branchId}`).expect(200);
    const uncategorized = res.body.data.categories.find(
      (c: { id: string }) => c.id === '__uncategorized__'
    );
    expect(uncategorized).toBeDefined();
    expect(uncategorized.items.some((i: { id: string }) => i.id === menuItemId)).toBe(true);
  });

  it('POST /api/public/orders crea un pedido público con trackingToken', async () => {
    if (skipped) return;

    const res = await publicRequest('post', '/api/public/orders')
      .send({
        branchId,
        customerName: 'Cliente Demo',
        customerPhone: '5551234567',
        orderType: 'DELIVERY',
        deliveryAddress: 'Av. Siempre Viva 123',
        items: [{ menuItemId, quantity: 2 }],
      })
      .expect(200);

    expect(res.body.data.trackingToken).toBeDefined();
    expect(res.body.data.total).toBe(100);
    expect(res.body.data.origin).toBe('online-delivery');

    trackingToken = res.body.data.trackingToken;
    createdOrderId = res.body.data.id;
  });

  it('GET /api/public/orders/:trackingToken/status reporta PENDING_PAYMENT', async () => {
    if (skipped) return;

    const res = await publicRequest('get', `/api/public/orders/${trackingToken}/status`).expect(200);
    expect(res.body.data.status).toBe('PENDING_PAYMENT');
    expect(res.body.data.customerName).toBe('Cliente Demo');
    expect(res.body.data.orderType).toBe('DELIVERY');
    expect(res.body.data.items[0].name).toBe(menuItemName);
  });

  it('GET /api/public/orders/by-order-id/:orderId/status resuelve por orderId', async () => {
    if (skipped) return;

    const res = await publicRequest('get', `/api/public/orders/by-order-id/${createdOrderId}/status`).expect(200);
    expect(res.body.data.status).toBe('PENDING_PAYMENT');
    expect(res.body.data.trackingToken).toBe(trackingToken);
  });

  it('PUT /api/orders/:id/delivery-status (interno) actualiza el status público de tracking', async () => {
    if (skipped) return;

    const res = await authRequest('put', `/api/orders/${createdOrderId}/delivery-status`)
      .send({ status: 'READY' })
      .expect(200);
    expect(res.body.data.deliveryStatus).toBe('READY');

    const status = await publicRequest('get', `/api/public/orders/${trackingToken}/status`).expect(200);
    expect(status.body.data.status).toBe('READY');
  });

  it('POST /api/public/orders con branch inexistente → BRANCH_NOT_FOUND', async () => {
    if (skipped) return;

    const res = await publicRequest('post', '/api/public/orders')
      .send({
        branchId: randomUUID(),
        customerName: 'Cliente Fantasma',
        customerPhone: '5557654321',
        orderType: 'PICKUP',
        items: [{ menuItemId, quantity: 1 }],
      })
      .expect(404);

    expect(res.body.error.code).toBe('BRANCH_NOT_FOUND');
  });
});
