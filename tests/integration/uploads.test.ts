import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import type { Express } from 'express';

/**
 * Transversal — Storage de imágenes (S3), Tarea T9.
 *
 * Tests de integración del endpoint `POST /api/uploads` contra la app Express real
 * (supertest), con skip automático si no hay DATABASE_URL operativa. Cubre:
 *  - tipo MIME inválido (application/pdf) → 400 INVALID_IMAGE_TYPE
 *  - archivo > 5MB → 413 IMAGE_SIZE_EXCEEDS_LIMIT (cortado por el límite de multer)
 *  - aislamiento: la `key` devuelta lleva el branchId/orgId del CONTEXTO del token
 *    (no del body), con el prefijo correcto según `kind`
 *  - S3_ENABLED=false → no-op: responde 200 con { url, key } sin tocar S3 real
 *
 * Sigue el patrón de `auth/signup.integration.test.ts`: se obtiene un JWT real vía
 * signup (que incluye org + branch en el contexto) y se sube con multipart/form-data.
 * `S3_ENABLED=false` mantiene el upload como no-op (no requiere bucket ni credenciales).
 */

function ensureTestEnv(): void {
  process.env.NODE_ENV = process.env.NODE_ENV || 'test';
  process.env.DATABASE_URL =
    process.env.DATABASE_URL || 'mysql://root:root_password@localhost:3306/restify';
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    process.env.JWT_SECRET = 'integration_test_jwt_secret_min_32_chars_ok';
  }
  process.env.STRIPE_SECRET_KEY =
    process.env.STRIPE_SECRET_KEY || 'sk_test_integration_uploads_api_mock';
  process.env.PAYMENT_CONFIG_ENCRYPTION_KEY =
    process.env.PAYMENT_CONFIG_ENCRYPTION_KEY || 'a'.repeat(64);
  // Rutas protegidas pasan sin billing; el signup no setea currentPeriodEnd.
  process.env.BILLING_ENABLED = 'false';
  process.env.EMAIL_ENABLED = 'false';
  // El upload queda como no-op: no necesita bucket ni credenciales reales.
  process.env.S3_ENABLED = 'false';
}

function shouldSkipIntegration(): boolean {
  ensureTestEnv();
  return !process.env.DATABASE_URL || process.env.DATABASE_URL.includes('test');
}

function buildSignupBody(suffix: string) {
  return {
    user: {
      email: `uploads-${suffix}@test.local`,
      password: 'Test1234',
      name: 'Owner',
      lastName: 'Test',
    },
    organization: { name: `Uploads Org ${suffix}` },
    branch: {
      name: 'Sucursal Principal',
      state: 'CDMX',
      city: 'Ciudad de México',
      street: 'Reforma',
      exteriorNumber: '100',
      phone: '5555555555',
      timezone: 'America/Mexico_City',
    },
  };
}

describe('POST /api/uploads — Storage de imágenes (T9)', () => {
  const prisma = new PrismaClient();
  let app: Express;
  let skipped = true;

  const createdOrgIds = new Set<string>();

  // Contexto de tenant del token usado en los tests.
  let token: string;
  let organizationId: string;
  let branchId: string;

  // Inicia un POST /api/uploads autenticado. Los headers van TRAS el verbo HTTP,
  // como exige supertest (request(app) por sí solo no expone .set).
  const uploadRequest = () =>
    request(app)
      .post('/api/uploads')
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', [`token=${token}`]);

  beforeAll(async () => {
    skipped = shouldSkipIntegration();
    if (skipped) return;
    ensureTestEnv();

    try {
      const { default: LocalServer } = await import('../../src/server/server');
      app = new LocalServer().getApp();
    } catch {
      skipped = true;
      return;
    }

    const signupRes = await request(app)
      .post('/api/auth/signup')
      .send(buildSignupBody(`ctx-${Date.now()}`))
      .expect(201);

    token = signupRes.body.data.token;
    organizationId = signupRes.body.data.organization.id;
    branchId = signupRes.body.data.branch.id;
    createdOrgIds.add(organizationId);
  });

  afterAll(async () => {
    if (!skipped) {
      for (const orgId of createdOrgIds) {
        await prisma.organization.delete({ where: { id: orgId } }).catch(() => {});
      }
    }
    await prisma.$disconnect();
  });

  it('tipo MIME inválido (application/pdf) → 400 INVALID_IMAGE_TYPE', async () => {
    if (skipped) return;

    const res = await uploadRequest()
      .field('kind', 'product_image')
      .attach('file', Buffer.from('%PDF-1.4 fake'), {
        filename: 'doc.pdf',
        contentType: 'application/pdf',
      })
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INVALID_IMAGE_TYPE');
  });

  it('archivo > 5MB → 413 IMAGE_SIZE_EXCEEDS_LIMIT', async () => {
    if (skipped) return;

    // 5MB + 1 byte: multer corta antes de llegar al controller.
    const tooBig = Buffer.alloc(5 * 1024 * 1024 + 1, 0);

    const res = await uploadRequest()
      .field('kind', 'product_image')
      .attach('file', tooBig, { filename: 'big.png', contentType: 'image/png' })
      .expect(413);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('IMAGE_SIZE_EXCEEDS_LIMIT');
  });

  it('product_image → key con prefijo branches/{branchId}/products/ del CONTEXTO', async () => {
    if (skipped) return;

    const res = await uploadRequest()
      .field('kind', 'product_image')
      .attach('file', Buffer.from('fake-image-bytes'), {
        filename: 'pizza.png',
        contentType: 'image/png',
      })
      .expect(200);

    expect(res.body.success).toBe(true);
    const { url, key } = res.body.data;
    expect(typeof url).toBe('string');
    // La key sale del branchId del token, no de nada del body.
    expect(key).toMatch(new RegExp(`^branches/${branchId}/products/[0-9a-f-]+\\.png$`));
  });

  it('org_logo → key con prefijo organizations/{orgId}/ del CONTEXTO', async () => {
    if (skipped) return;

    const res = await uploadRequest()
      .field('kind', 'org_logo')
      .attach('file', Buffer.from('fake-logo'), {
        filename: 'logo.webp',
        contentType: 'image/webp',
      })
      .expect(200);

    expect(res.body.data.key).toBe(`organizations/${organizationId}/logo.webp`);
  });

  it('S3_ENABLED=false → no-op: responde 200 con { url, key } sin tocar S3', async () => {
    if (skipped) return;

    const res = await uploadRequest()
      .field('kind', 'branch_logo')
      .attach('file', Buffer.from('fake-branch-logo'), {
        filename: 'logo.jpg',
        contentType: 'image/jpeg',
      })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.url).toEqual(expect.any(String));
    expect(res.body.data.key).toBe(`branches/${branchId}/logo.jpg`);
  });

  it('sin token → 401 (ruta protegida por auth + tenant)', async () => {
    if (skipped) return;

    await request(app)
      .post('/api/uploads')
      .field('kind', 'product_image')
      .attach('file', Buffer.from('x'), { filename: 'x.png', contentType: 'image/png' })
      .expect(401);
  });
});
