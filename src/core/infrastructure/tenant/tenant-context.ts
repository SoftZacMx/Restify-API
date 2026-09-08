import { AsyncLocalStorage } from 'async_hooks';

export interface TenantStore {
  organizationId?: string;
  branchId?: string;
  // Distingue un bypass a propósito (withoutTenant) de un contexto ausente por olvido.
  bypass?: boolean;
}

const storage = new AsyncLocalStorage<TenantStore>();

export function runWithTenant<T>(store: TenantStore, fn: () => T): T {
  return storage.run(store, fn);
}

export function getTenant(): TenantStore | undefined {
  return storage.getStore();
}

export function getOrganizationId(): string {
  const orgId = storage.getStore()?.organizationId;
  if (!orgId) {
    throw new Error('Tenant context is not set');
  }
  return orgId;
}

export function getBranchId(): string | undefined {
  return storage.getStore()?.branchId;
}

/**
 * Execute function without tenant context.
 *
 * Use cases:
 * - Signup (creating new organization)
 * - Cross-tenant cron jobs
 * - Admin scripts that operate across all organizations
 *
 * ⚠️ WARNING: Operations inside withoutTenant bypass tenant filtering.
 * Only use when you explicitly need to work across organizations.
 *
 * @example
 * // Signup - create new organization
 * await withoutTenant(async () => {
 *   const org = await prisma.organization.create({...});
 *   const user = await prisma.user.create({...});
 * });
 *
 * @example
 * // Cron job - process all organizations
 * await withoutTenant(async () => {
 *   const orgs = await prisma.organization.findMany();
 *   for (const org of orgs) {
 *     await runWithTenant({ organizationId: org.id }, async () => {
 *       await processOrganization(org.id);
 *     });
 *   }
 * });
 */
export async function withoutTenant<T>(fn: () => Promise<T>): Promise<T> {
  return storage.run({ bypass: true }, fn);
}
