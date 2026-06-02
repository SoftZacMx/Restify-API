import request from 'supertest';
import { PrismaClient, OrganizationPlan, UserRole } from '@prisma/client';
import { JwtUtil } from '../../../src/shared/utils/jwt.util';
import bcrypt from 'bcryptjs';
import type { Express } from 'express';

function ensureTestEnv(): void {
  process.env.NODE_ENV = process.env.NODE_ENV || 'test';
  process.env.DATABASE_URL =
    process.env.DATABASE_URL || 'mysql://root:root_password@localhost:3306/restify';
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    process.env.JWT_SECRET = 'integration_test_jwt_secret_min_32_chars_ok';
  }
  process.env.STRIPE_SECRET_KEY =
    process.env.STRIPE_SECRET_KEY || 'sk_test_integration_branch_api_mock';
  process.env.PAYMENT_CONFIG_ENCRYPTION_KEY =
    process.env.PAYMENT_CONFIG_ENCRYPTION_KEY || 'a'.repeat(64);
}

function shouldSkipIntegration(): boolean {
  ensureTestEnv();
  return !process.env.DATABASE_URL || process.env.DATABASE_URL.includes('test');
}

describe('Branches API Integration', () => {
  const prisma = new PrismaClient();
  let app: Express;
  let skipped = true;

  let organizationId: string;
  let adminToken: string;
  let adminUserId: string;

  beforeAll(async () => {
    skipped = shouldSkipIntegration();
    if (skipped) {
      return;
    }

    ensureTestEnv();

    try {
      const org = await prisma.organization.create({
        data: {
          name: `Test Org ${Date.now()}`,
          plan: OrganizationPlan.FREE,
        },
      });
      organizationId = org.id;

      const passwordHash = await bcrypt.hash('Test1234!', 10);
      const admin = await prisma.user.create({
        data: {
          email: `branch-admin-${Date.now()}@test.local`,
          password: passwordHash,
          name: 'Admin',
          last_name: 'Test',
          rol: UserRole.ADMIN,
        },
      });
      adminUserId = admin.id;

      const subscription = await prisma.subscription.findFirst();
      if (!subscription) {
        await prisma.subscription.create({
          data: {
            stripeCustomerId: `cus_branch_test_${Date.now()}`,
            status: 'ACTIVE',
            currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
        });
      } else if (
        subscription.status !== 'ACTIVE' &&
        subscription.status !== 'TRIALING'
      ) {
        await prisma.subscription.update({
          where: { id: subscription.id },
          data: {
            status: 'ACTIVE',
            currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
        });
      }

      const { default: LocalServer } = await import('../../../src/server/server');
      app = new LocalServer().getApp();

      adminToken = JwtUtil.generateToken({
        email: admin.email,
        userId: admin.id,
        rol: 'ADMIN',
        org: organizationId,
      });
    } catch {
      skipped = true;
    }
  });

  afterAll(async () => {
    if (skipped || !adminUserId || !organizationId) {
      await prisma.$disconnect();
      return;
    }

    await prisma.userBranchAccess.deleteMany({ where: { userId: adminUserId } });
    await prisma.branch.deleteMany({ where: { organizationId } });
    await prisma.user.delete({ where: { id: adminUserId } });
    await prisma.organization.delete({ where: { id: organizationId } });
    await prisma.$disconnect();
  });

  const authRequest = () =>
    request(app).set('Authorization', `Bearer ${adminToken}`).set('Cookie', [`token=${adminToken}`]);

  it('POST /api/branches creates branch and GET lists it', async () => {
    if (skipped) {
      return;
    }

    const createRes = await authRequest()
      .post('/api/branches')
      .send({
        name: 'Sucursal Centro',
        state: 'CDMX',
        city: 'Ciudad de México',
        street: 'Reforma',
        exteriorNumber: '100',
        phone: '5555555555',
        timezone: 'America/Mexico_City',
      })
      .expect(201);

    expect(createRes.body.success).toBe(true);
    expect(createRes.body.data.id).toBeDefined();
    expect(createRes.body.data.organizationId).toBe(organizationId);

    const listRes = await authRequest().get('/api/branches').expect(200);

    expect(listRes.body.data).toHaveLength(1);
    expect(listRes.body.data[0].name).toBe('Sucursal Centro');
  });

  it('POST /api/branches returns 409 when branch limit reached', async () => {
    if (skipped) {
      return;
    }

    const limitOrg = await prisma.organization.create({
      data: { name: `Limit Org ${Date.now()}`, plan: OrganizationPlan.FREE },
    });

    const limitToken = JwtUtil.generateToken({
      email: 'limit@test.local',
      userId: adminUserId,
      rol: 'ADMIN',
      org: limitOrg.id,
    });

    const limitRequest = () =>
      request(app)
        .set('Authorization', `Bearer ${limitToken}`)
        .set('Cookie', [`token=${limitToken}`]);

    const payload = {
      state: 'CDMX',
      city: 'Ciudad de México',
      street: 'Insurgentes',
      exteriorNumber: '200',
      phone: '5555555556',
      timezone: 'America/Mexico_City',
    };

    await limitRequest()
      .post('/api/branches')
      .send({ ...payload, name: 'Branch 1' });
    await limitRequest()
      .post('/api/branches')
      .send({ ...payload, name: 'Branch 2' });
    await limitRequest()
      .post('/api/branches')
      .send({ ...payload, name: 'Branch 3' });

    const res = await limitRequest()
      .post('/api/branches')
      .send({ ...payload, name: 'Branch 4' })
      .expect(409);

    expect(res.body.error.code).toBe('BRANCH_LIMIT_REACHED');

    await prisma.branch.deleteMany({ where: { organizationId: limitOrg.id } });
    await prisma.organization.delete({ where: { id: limitOrg.id } });
  });
});
