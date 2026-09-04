import { PrismaClient } from '@prisma/client';
import { createTenantExtension } from './tenant-extension';

// Un solo pool: el cliente extendido deriva del base y comparte sus conexiones.
let basePrismaClient: PrismaClient | null = null;
let prismaClientWithExtension: ReturnType<typeof createTenantExtension> | null = null;

// Lazy: no depende de que el .env ya esté cargado al importar este módulo.
function getOrCreateBaseClient(): PrismaClient {
  if (!basePrismaClient) {
    basePrismaClient = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    });
  }

  return basePrismaClient;
}

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
    prismaClientWithExtension = createTenantExtension(getOrCreateBaseClient());
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
  return getOrCreateBaseClient();
}
