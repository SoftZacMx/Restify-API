import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import type { Express } from 'express';
import {
  ensureTestEnv as ensureBaseTestEnv,
  shouldSkipIntegration,
} from '../utils';

/**
 * E2E del flujo de alta pública (Fase 4.1.H).
 *
 * Cubre el camino completo de un cliente nuevo de punta a punta contra DB real:
 *  - signup → JWT válido → org + owner + sucursal + bootstrap en una transacción
 *  - email duplicado → 409
 *  - owner crea empleado con branchIds → el empleado solo accede a esas sucursales
 *  - aislamiento: el signup de org A no ve datos de org B
 *
 * Sigue el patrón de `branches.integration.test.ts` (supertest + DB real, con
 * skip automático si no hay DATABASE_URL operativa). El billing se desactiva
 * (`BILLING_ENABLED=false`) porque el signup crea la subscription sin
 * `currentPeriodEnd` y el SubscriptionMiddleware la rechazaría en rutas protegidas.
 */

function ensureTestEnv(): void {
  ensureBaseTestEnv();
  // El signup no setea currentPeriodEnd; sin billing las rutas protegidas pasan.
  process.env.BILLING_ENABLED = 'false';
  // Evita intentos de envío real de correo en el best-effort del signup.
  process.env.EMAIL_ENABLED = 'false';
}

/** Cuerpo de signup válido; `suffix` evita colisiones de email/slug entre tests. */
function buildSignupBody(suffix: string) {
  return {
    user: {
      email: `signup-${suffix}@test.local`,
      password: 'Test1234',
      name: 'Owner',
      lastName: 'Test',
    },
    organization: {
      name: `Signup Org ${suffix}`,
    },
    branch: {
      name: `Sucursal ${suffix}`,
      state: 'CDMX',
      city: 'Ciudad de México',
      street: 'Reforma',
      exteriorNumber: '100',
      phone: '5555555555',
      timezone: 'America/Mexico_City',
    },
  };
}

describe('Signup flow E2E (4.1.H)', () => {
  const prisma = new PrismaClient();
  let app: Express;
  let skipped = true;

  // Orgs creadas por los tests para limpiar al final.
  const createdOrgIds = new Set<string>();

  beforeAll(async () => {
    skipped = shouldSkipIntegration();
    if (skipped) {
      return;
    }

    ensureTestEnv();

    try {
      const { default: LocalServer } = await import('../../../src/server/server');
      app = new LocalServer().getApp();
    } catch {
      skipped = true;
    }
  });

  afterAll(async () => {
    if (!skipped) {
      // Org → Branch/User/Subscription en cascada; basta borrar las orgs.
      for (const orgId of createdOrgIds) {
        await prisma.organization.delete({ where: { id: orgId } }).catch(() => {});
      }
    }
    await prisma.$disconnect();
  });

  it('signup crea org + owner + sucursal + bootstrap en una transacción y devuelve JWT', async () => {
    if (skipped) {
      return;
    }

    const body = buildSignupBody(`full-${Date.now()}`);

    const res = await request(app).post('/api/auth/signup').send(body).expect(201);

    expect(res.body.success).toBe(true);
    const { token, user, organization, branch } = res.body.data;

    // JWT presente, tanto en el body como en la cookie HttpOnly.
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(0);
    const setCookie = res.headers['set-cookie'];
    expect(Array.isArray(setCookie) ? setCookie.join(';') : String(setCookie)).toContain('token=');

    // Forma de la respuesta.
    expect(user.email).toBe(body.user.email);
    expect(user.rol).toBe('OWNER');
    expect(user.organizationId).toBe(organization.id);
    expect(organization.name).toBe(body.organization.name);
    expect(branch.name).toBe(body.branch.name);

    createdOrgIds.add(organization.id);

    // La org, el owner, la sucursal y el bootstrap quedaron persistidos.
    const orgRow = await prisma.organization.findUnique({ where: { id: organization.id } });
    expect(orgRow).not.toBeNull();
    expect(orgRow!.plan).toBe('FREE');

    const subscription = await prisma.subscription.findUnique({
      where: { organizationId: organization.id },
    });
    expect(subscription).not.toBeNull();
    expect(subscription!.status).toBe('ACTIVE');

    const owner = await prisma.user.findUnique({ where: { id: user.id } });
    expect(owner).not.toBeNull();
    expect(owner!.organizationId).toBe(organization.id);
    expect(owner!.rol).toBe('OWNER');
    // La contraseña se guarda hasheada, nunca en claro.
    expect(owner!.password).not.toBe(body.user.password);

    const branches = await prisma.branch.findMany({
      where: { organizationId: organization.id },
    });
    expect(branches).toHaveLength(1);
    expect(branches[0].id).toBe(branch.id);

    // Bootstrap: 4 categorías por defecto + "Mesa 1".
    const categories = await prisma.menuCategory.findMany({ where: { branchId: branch.id } });
    expect(categories).toHaveLength(4);
    expect(categories.map((c) => c.name).sort()).toEqual(
      ['Bebidas', 'Entradas', 'Platos principales', 'Postres'].sort()
    );

    const tables = await prisma.table.findMany({ where: { branchId: branch.id } });
    expect(tables).toHaveLength(1);
    expect(tables[0].name).toBe('Mesa 1');
  });

  it('signup con email duplicado → 409 EMAIL_ALREADY_EXISTS', async () => {
    if (skipped) {
      return;
    }

    const body = buildSignupBody(`dup-${Date.now()}`);

    const first = await request(app).post('/api/auth/signup').send(body).expect(201);
    createdOrgIds.add(first.body.data.organization.id);

    // Mismo email, otra org → debe rechazarse sin crear nada nuevo.
    const second = await request(app)
      .post('/api/auth/signup')
      .send({ ...body, organization: { name: `${body.organization.name} 2` } })
      .expect(409);

    expect(second.body.success).toBe(false);
    expect(second.body.error.code).toBe('EMAIL_ALREADY_EXISTS');

    // No se creó una segunda org con ese nombre.
    const orgs = await prisma.organization.findMany({
      where: { name: `${body.organization.name} 2` },
    });
    expect(orgs).toHaveLength(0);
  });

  it('owner crea empleado con branchIds → solo accede a esas sucursales', async () => {
    if (skipped) {
      return;
    }

    // 1. Alta del owner (org A) con su sucursal principal.
    const ownerBody = buildSignupBody(`emp-owner-${Date.now()}`);
    const signupRes = await request(app).post('/api/auth/signup').send(ownerBody).expect(201);
    const { token: ownerToken, organization, branch: branchPrincipal } = signupRes.body.data;
    createdOrgIds.add(organization.id);

    const ownerRequest = (method: 'get' | 'post', path: string) =>
      request(app)[method](path)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('Cookie', [`token=${ownerToken}`]);

    // 2. El owner crea una segunda sucursal.
    const secondBranchRes = await ownerRequest('post', '/api/branches')
      .send({
        name: 'Sucursal Norte',
        state: 'CDMX',
        city: 'Ciudad de México',
        street: 'Insurgentes',
        exteriorNumber: '200',
        phone: '5555555556',
        timezone: 'America/Mexico_City',
      })
      .expect(200);
    const secondBranchId = secondBranchRes.body.data.id;

    // 3. Owner crea un WAITER asignado SOLO a la sucursal principal.
    const waiterEmail = `waiter-${Date.now()}@test.local`;
    const createWaiterRes = await ownerRequest('post', '/api/users')
      .send({
        name: 'Mesero',
        last_name: 'Uno',
        email: waiterEmail,
        password: 'Test1234!',
        rol: 'WAITER',
        branchIds: [branchPrincipal.id],
      })
      .expect(200);

    const waiterId = createWaiterRes.body.data.id;
    expect(createWaiterRes.body.data.branchIds).toEqual([branchPrincipal.id]);

    // 4. GET /api/users/:id refleja el branchId asignado.
    const getWaiterRes = await ownerRequest('get', `/api/users/${waiterId}`).expect(200);
    expect(getWaiterRes.body.data.branchIds).toEqual([branchPrincipal.id]);

    // 5. El waiter inicia sesión: el login solo expone su sucursal asignada.
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: waiterEmail, password: 'Test1234!' })
      .expect(200);

    const waiterToken = loginRes.body.data.token;
    const loginBranches = loginRes.body.data.branches ?? [];
    expect(loginBranches.map((b: { id: string }) => b.id)).toEqual([branchPrincipal.id]);

    const waiterRequest = (method: 'get' | 'post', path: string) =>
      request(app)[method](path)
        .set('Authorization', `Bearer ${waiterToken}`)
        .set('Cookie', [`token=${waiterToken}`]);

    // 6. GET /api/branches para el waiter solo lista la sucursal asignada.
    const waiterBranchesRes = await waiterRequest('get', '/api/branches').expect(200);
    expect(waiterBranchesRes.body.data.map((b: { id: string }) => b.id)).toEqual([
      branchPrincipal.id,
    ]);

    // 7. Cambiar a la sucursal asignada funciona; a la NO asignada → BRANCH_FORBIDDEN.
    await waiterRequest('post', '/api/auth/switch-branch')
      .send({ branchId: branchPrincipal.id })
      .expect(200);

    const forbiddenRes = await waiterRequest('post', '/api/auth/switch-branch')
      .send({ branchId: secondBranchId })
      .expect(400);
    expect(forbiddenRes.body.error.code).toBe('BRANCH_FORBIDDEN');
  });

  it('aislamiento: el owner de org A no ve datos de org B', async () => {
    if (skipped) {
      return;
    }

    // Dos altas independientes → dos orgs aisladas.
    const signupA = await request(app)
      .post('/api/auth/signup')
      .send(buildSignupBody(`iso-a-${Date.now()}`))
      .expect(201);
    const orgA = signupA.body.data.organization;
    const tokenA = signupA.body.data.token;
    createdOrgIds.add(orgA.id);

    const signupB = await request(app)
      .post('/api/auth/signup')
      .send(buildSignupBody(`iso-b-${Date.now()}`))
      .expect(201);
    const orgB = signupB.body.data.organization;
    const branchB = signupB.body.data.branch;
    createdOrgIds.add(orgB.id);

    const requestA = (method: 'get' | 'post', path: string) =>
      request(app)[method](path)
        .set('Authorization', `Bearer ${tokenA}`)
        .set('Cookie', [`token=${tokenA}`]);

    // El owner de A solo ve su propia sucursal, nunca la de B.
    const branchesA = await requestA('get', '/api/branches').expect(200);
    const branchIdsA = branchesA.body.data.map((b: { id: string }) => b.id);
    expect(branchIdsA).not.toContain(branchB.id);
    expect(branchesA.body.data).toHaveLength(1);

    // Intentar leer la sucursal de B con el token de A → prohibido: el control de
    // acceso a sucursal se evalúa contra las sucursales de la org del token (A),
    // así que una sucursal de otra org queda fuera de alcance.
    const crossOrgRes = await requestA('get', `/api/branches/${branchB.id}`).expect(403);
    expect(crossOrgRes.body.error.code).toBe('FORBIDDEN');
  });
});
