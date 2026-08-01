import { PrismaClient, OrganizationPlan } from '@prisma/client';
import { getPrisma } from '../../src/core/infrastructure/database/prisma/get-prisma';
import {
  MercadoPagoService,
  MPPreferenceResult,
  MPPaymentResult,
} from '../../src/core/infrastructure/payment-gateways/mercado-pago.service';

/**
 * Helpers compartidos para los e2e de pagos.
 *
 * Los e2e de pagos usan la BD local real (MySQL vía docker-compose) con las
 * repositorios Prisma reales; solo se falsifica el gateway externo
 * (MercadoPagoService). Si no hay BD local, la suite se salta.
 */

export function ensurePaymentE2EEnv(): void {
  process.env.NODE_ENV = process.env.NODE_ENV || 'test';
  process.env.DATABASE_URL =
    process.env.DATABASE_URL || 'mysql://restify_user:restify_password@localhost:3306/restify';
  if (!process.env.PAYMENT_CONFIG_ENCRYPTION_KEY) {
    process.env.PAYMENT_CONFIG_ENCRYPTION_KEY = 'a'.repeat(64);
  }
  process.env.MP_NOTIFICATION_URL =
    process.env.MP_NOTIFICATION_URL || 'https://webhook.example.com/mercado-pago';
  process.env.MP_BACK_URL = process.env.MP_BACK_URL || 'https://restify.app';
  process.env.MP_PUBLIC_BACK_URL = process.env.MP_PUBLIC_BACK_URL || 'https://restify.app';
}

/** Solo corre contra BD local: nunca contra QA/producción remota. */
export function shouldSkipPaymentE2E(): boolean {
  ensurePaymentE2EEnv();
  const url = process.env.DATABASE_URL || '';
  return !/localhost|127\.0\.0\.1/.test(url);
}

export interface PaymentE2ETenant {
  orgId: string;
  branchId: string;
  userId: string;
}

export async function createPaymentE2ETenant(
  prisma: PrismaClient
): Promise<PaymentE2ETenant> {
  const ts = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const org = await prisma.organization.create({
    data: { name: `E2E Payments Org ${ts}`, plan: OrganizationPlan.FREE },
  });

  const branch = await prisma.branch.create({
    data: {
      organizationId: org.id,
      name: `E2E Payments Branch ${ts}`,
      state: 'CDMX',
      city: 'CDMX',
      street: 'Reforma',
      exteriorNumber: '100',
      phone: '5550000000',
      timezone: 'America/Mexico_City',
      currency: 'MXN',
    },
  });

  const user = await prisma.user.create({
    data: {
      name: 'E2E',
      last_name: 'Payments',
      email: `e2e-payments-${ts}@test.local`,
      password: 'not-a-real-password',
      rol: 'ADMIN',
      organizationId: org.id,
      status: true,
    },
  });

  return { orgId: org.id, branchId: branch.id, userId: user.id };
}

export async function cleanupPaymentE2ETenant(
  prisma: PrismaClient,
  branchId: string,
  orgId: string
): Promise<void> {
  await prisma.expense.deleteMany({ where: { branchId } });
  await prisma.paymentSession.deleteMany({ where: { branchId } });
  await prisma.payment.deleteMany({ where: { branchId } });
  await prisma.pendingCheckout.deleteMany({ where: { branchId } });
  await prisma.orderItemExtra.deleteMany({ where: { branchId } });
  await prisma.orderItem.deleteMany({ where: { branchId } });
  await prisma.order.deleteMany({ where: { branchId } });
  await prisma.table.deleteMany({ where: { branchId } });
  await prisma.userBranchAccess.deleteMany({ where: { branchId } });
  await prisma.branch.deleteMany({ where: { id: branchId } });
  await prisma.user.deleteMany({ where: { organizationId: orgId } });
  await prisma.organization.deleteMany({ where: { id: orgId } });
}

export function buildMPPayment(overrides: Partial<MPPaymentResult>): MPPaymentResult {
  return {
    id: 1000000,
    status: 'approved',
    statusDetail: 'accredited',
    externalReference: 'order-id',
    transactionAmount: 100,
    currencyId: 'MXN',
    paymentMethodId: 'visa',
    paymentTypeId: 'credit_card',
    dateApproved: new Date().toISOString(),
    feeDetails: [],
    ...overrides,
  };
}

/** Fake del gateway de MP: mismo shape que MercadoPagoService pero con jest.fn(). */
export function createFakeMercadoPagoService() {
  const createPreference = jest.fn();
  const getPayment = jest.fn();
  const getPreference = jest.fn();
  const cancelPayment = jest.fn();
  const clearClient = jest.fn();

  const service = {
    createPreference,
    getPayment,
    getPreference,
    cancelPayment,
    clearClient,
  } as unknown as MercadoPagoService;

  return { service, createPreference, getPayment, getPreference, cancelPayment, clearClient };
}

export { getPrisma };

/**
 * Cliente Prisma con extensión de tenant listo para los repositorios.
 * El tipo se casta a PrismaClient igual que en el DI (prisma.module.ts).
 */
export const prismaClient = getPrisma() as unknown as PrismaClient;
