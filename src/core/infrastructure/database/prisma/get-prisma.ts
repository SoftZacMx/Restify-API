import { PrismaClient } from '@prisma/client';
import { createTenantExtension } from './tenant-extension';

/**
 * Singleton Prisma client with tenant extension
 */
let prismaClientWithExtension: ReturnType<typeof createTenantExtension> | null = null;

/**
 * Get Prisma client with tenant filtering extension.
 *
 * This is the ONLY way repositories should access Prisma.
 * Do NOT inject PrismaClient directly - always use getPrisma().
 *
 * @returns Prisma client with automatic tenant filtering
 */
export function getPrisma() {
  if (!prismaClientWithExtension) {
    const baseClient = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    });

    prismaClientWithExtension = createTenantExtension(baseClient);
  }

  return prismaClientWithExtension;
}

/**
 * Get base Prisma client WITHOUT tenant extension.
 *
 * ⚠️ WARNING: Only use this for operations that should NOT be filtered:
 * - Database health checks
 * - Migrations
 * - System-level operations
 *
 * For normal application code, ALWAYS use getPrisma() instead.
 */
export function getBasePrisma(): PrismaClient {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });
}
