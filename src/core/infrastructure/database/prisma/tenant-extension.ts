import { Prisma, PrismaClient } from '@prisma/client';
import { getTenant } from '../../tenant/tenant-context';

/**
 * Prisma extension that automatically filters queries by organizationId/branchId
 * based on tenant context.
 *
 * Security: Prevents IDOR by ensuring users can only access data from their organization/branch.
 */

// Models that require organization-level filtering
// Usar nombres exactos como llegan de Prisma (PascalCase)
const ORG_LEVEL_MODELS = new Set(['User', 'Subscription']);

// Models that require branch-level filtering
const BRANCH_LEVEL_MODELS = new Set([
  'Order',
  'OrderItem',
  'OrderItemExtra',
  'Payment',
  'PaymentSession',
  'PaymentDifferentiation',
  'Table',
  'MenuCategory',
  'MenuItem',
  'Product',
  'Expense',
  'ExpenseItem',
  'Refund',
  'EmployeeSalaryPayment',
]);

// Models that should NOT be filtered (global data)
const GLOBAL_MODELS = new Set(['Organization', 'Branch', 'UserBranchAccess', 'SubscriptionPlan']);

/**
 * Creates Prisma extension with tenant filtering
 */
export function createTenantExtension(client: PrismaClient) {
  return client.$extends({
    name: 'tenant-filter',
    query: {
      // Organization-level filtering
      $allModels: {
        async findUnique({ model, args, query }) {
          return applyTenantFilter(model, args, query, 'findUnique');
        },
        async findUniqueOrThrow({ model, args, query }) {
          return applyTenantFilter(model, args, query, 'findUniqueOrThrow');
        },
        async findFirst({ model, args, query }) {
          return applyTenantFilter(model, args, query, 'findFirst');
        },
        async findFirstOrThrow({ model, args, query }) {
          return applyTenantFilter(model, args, query, 'findFirstOrThrow');
        },
        async findMany({ model, args, query }) {
          return applyTenantFilter(model, args, query, 'findMany');
        },
        async create({ model, args, query }) {
          return applyTenantFilter(model, args, query, 'create');
        },
        async createMany({ model, args, query }) {
          return applyTenantFilter(model, args, query, 'createMany');
        },
        async update({ model, args, query }) {
          return applyTenantFilter(model, args, query, 'update');
        },
        async updateMany({ model, args, query }) {
          return applyTenantFilter(model, args, query, 'updateMany');
        },
        async upsert({ model, args, query }) {
          return applyTenantFilter(model, args, query, 'upsert');
        },
        async delete({ model, args, query }) {
          return applyTenantFilter(model, args, query, 'delete');
        },
        async deleteMany({ model, args, query }) {
          return applyTenantFilter(model, args, query, 'deleteMany');
        },
        async count({ model, args, query }) {
          return applyTenantFilter(model, args, query, 'count');
        },
        async aggregate({ model, args, query }) {
          return applyTenantFilter(model, args, query, 'aggregate');
        },
        async groupBy({ model, args, query }) {
          return applyTenantFilter(model, args, query, 'groupBy');
        },
      },
    },
  });
}

/**
 * Apply tenant filtering based on model type
 */
function applyTenantFilter(
  model: string,
  args: any,
  query: any,
  operation: string
): any {
  const tenant = getTenant();

  // Sin contexto de tenant → no filtrar (rutas públicas: login, signup, webhooks)
  if (!tenant?.organizationId) {
    return query(args);
  }

  // Global models - no filtering
  if (GLOBAL_MODELS.has(model)) {
    return query(args);
  }

  // Organization-level filtering
  if (ORG_LEVEL_MODELS.has(model)) {
    return applyOrgFilter(args, query, tenant.organizationId, operation);
  }

  // Branch-level filtering
  if (BRANCH_LEVEL_MODELS.has(model)) {
    if (!tenant.branchId) {
      throw new Error(
        `TENANT_BRANCH_REQUIRED: Operation on ${model} requires branch context. Use switch-branch or ensure branch is in JWT.`
      );
    }

    return applyBranchFilter(args, query, tenant.branchId, operation);
  }

  // Unknown model - no filtering (permissive for new models)
  return query(args);
}

/**
 * Apply organizationId filter
 */
function applyOrgFilter(args: any, query: any, organizationId: string, operation: string): any {
  if (operation === 'create' || operation === 'createMany') {
    if (operation === 'create') {
      args.data = args.data || {};
      args.data.organizationId = organizationId;
    } else {
      args.data = (args.data || []).map((item: any) => ({
        ...item,
        organizationId,
      }));
    }
    return query(args);
  }

  // findUnique: verificar post-query que pertenece a la org
  if (operation === 'findUnique' || operation === 'findUniqueOrThrow') {
    return query(args).then((result: any) => {
      if (!result) return result;
      if (result.organizationId && result.organizationId !== organizationId) {
        return null;
      }
      return result;
    });
  }

  // update/delete/upsert por @id: agregar organizationId al where con AND
  // Prisma acepta campos extra si no contradicen el constraint único
  if (operation === 'update' || operation === 'delete' || operation === 'upsert') {
    args.where = args.where || {};
    // Usar AND para no romper el where del campo único
    args.where = {
      ...args.where,
      AND: [...(args.where.AND || []), { organizationId }],
    };
    return query(args);
  }

  // Para el resto (findMany, findFirst, updateMany, deleteMany, count, etc.)
  args.where = args.where || {};
  args.where.organizationId = organizationId;
  return query(args);
}

/**
 * Apply branchId filter
 */
function applyBranchFilter(args: any, query: any, branchId: string, operation: string): any {
  if (operation === 'create' || operation === 'createMany') {
    if (operation === 'create') {
      args.data = args.data || {};
      args.data.branchId = branchId;
    } else {
      args.data = (args.data || []).map((item: any) => ({
        ...item,
        branchId,
      }));
    }
    return query(args);
  }

  // findUnique: verificar post-query que pertenece al branch
  if (operation === 'findUnique' || operation === 'findUniqueOrThrow') {
    return query(args).then((result: any) => {
      if (!result) return result;
      if (result.branchId && result.branchId !== branchId) {
        return null;
      }
      return result;
    });
  }

  // update/delete/upsert por @id: agregar branchId al where con AND
  if (operation === 'update' || operation === 'delete' || operation === 'upsert') {
    args.where = args.where || {};
    args.where = {
      ...args.where,
      AND: [...(args.where.AND || []), { branchId }],
    };
    return query(args);
  }

  // Para el resto (findMany, findFirst, updateMany, deleteMany, count, etc.)
  args.where = args.where || {};
  args.where.branchId = branchId;
  return query(args);
}
