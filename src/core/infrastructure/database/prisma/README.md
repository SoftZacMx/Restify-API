# Prisma Multi-Tenant Usage Guide

## ⚠️ IMPORTANT: Always use `getPrisma()`

**All repositories MUST use `getPrisma()` instead of injecting `PrismaClient` directly.**

### ✅ Correct Usage

```typescript
import { getPrisma } from '../database/prisma/get-prisma';

export class OrderRepository implements IOrderRepository {
  async findById(id: string): Promise<Order | null> {
    const prisma = getPrisma();
    
    // Automatically filtered by branchId from tenant context
    const order = await prisma.order.findUnique({ where: { id } });
    
    return order ? this.toEntity(order) : null;
  }
}
```

### ❌ Incorrect Usage (Security Risk)

```typescript
import { PrismaClient } from '@prisma/client';

export class OrderRepository {
  constructor(private readonly prisma: PrismaClient) {} // ❌ DON'T DO THIS
  
  async findById(id: string) {
    // ☠️ DANGER: No tenant filtering! User can see ALL orders from ALL organizations
    const order = await this.prisma.order.findUnique({ where: { id } });
    return order;
  }
}
```

---

## How Tenant Filtering Works

### Automatic Filtering

The Prisma extension automatically adds tenant filters:

```typescript
// You write:
await prisma.order.findMany({ where: { status: false } });

// Extension transforms to:
await prisma.order.findMany({ 
  where: { 
    status: false,
    branchId: 'current-branch-id-from-context' // ← Injected automatically
  } 
});
```

### Automatic Injection on Create

```typescript
// You write:
await prisma.order.create({
  data: {
    total: 100,
    status: false,
    // No branchId specified
  }
});

// Extension transforms to:
await prisma.order.create({
  data: {
    total: 100,
    status: false,
    branchId: 'current-branch-id-from-context' // ← Injected automatically
  }
});
```

---

## Model Types

### Organization-Level Models
Filtered by `organizationId`:
- `user`
- `subscription`

### Branch-Level Models
Filtered by `branchId`:
- `order`, `orderItem`, `orderItemExtra`
- `payment`, `paymentSession`, `paymentDifferentiation`
- `table`
- `menuCategory`, `menuItem`
- `product`
- `expense`, `expenseItem`
- `refund`
- `employeeSalaryPayment`

### Global Models (No Filtering)
Not filtered (accessible across organizations):
- `organization`
- `branch`
- `userBranchAccess`
- `subscriptionPlan`

---

## Special Cases

### 1. Operations Without Tenant Context

Use `withoutTenant()` for operations that should NOT be filtered:

```typescript
import { withoutTenant } from '../../../tenant/tenant-context';
import { getPrisma } from '../database/prisma/get-prisma';

// Signup - creating new organization
await withoutTenant(async () => {
  const prisma = getPrisma();
  
  const org = await prisma.organization.create({
    data: { name: 'New Org' }
  });
  
  const user = await prisma.user.create({
    data: {
      name: 'Owner',
      email: 'owner@example.com',
      organizationId: org.id, // Explicit organizationId
    }
  });
});
```

### 2. Cross-Tenant Cron Jobs

```typescript
import { withoutTenant, runWithTenant } from '../../../tenant/tenant-context';
import { getPrisma } from '../database/prisma/get-prisma';

// Process all organizations
await withoutTenant(async () => {
  const prisma = getPrisma();
  const orgs = await prisma.organization.findMany();
  
  for (const org of orgs) {
    // Run each org in its own tenant context
    await runWithTenant({ organizationId: org.id }, async () => {
      await processOrganization(org.id);
    });
  }
});
```

### 3. Health Checks

For infrastructure operations (health checks, migrations), use `getBasePrisma()`:

```typescript
import { getBasePrisma } from '../database/prisma/get-prisma';

async healthCheck(): Promise<boolean> {
  const prisma = getBasePrisma(); // No filtering
  await prisma.$queryRaw`SELECT 1`;
  return true;
}
```

---

## Migration Guide for Existing Repositories

**Before (insecure):**
```typescript
export class OrderRepository {
  constructor(private readonly prisma: PrismaClient) {}
  
  async findAll(): Promise<Order[]> {
    return this.prisma.order.findMany();
  }
}
```

**After (secure):**
```typescript
import { getPrisma } from '../database/prisma/get-prisma';

export class OrderRepository {
  async findAll(): Promise<Order[]> {
    const prisma = getPrisma();
    // Automatically filtered by branchId
    return prisma.order.findMany();
  }
}
```

---

## Testing

Tests should set up tenant context:

```typescript
import { runWithTenant } from '../../../tenant/tenant-context';
import { getPrisma } from '../database/prisma/get-prisma';

describe('OrderRepository', () => {
  it('should filter orders by branch', async () => {
    await runWithTenant(
      { organizationId: 'org-id', branchId: 'branch-id' },
      async () => {
        const prisma = getPrisma();
        const orders = await prisma.order.findMany();
        
        // Orders are automatically filtered by branch-id
        expect(orders).toBeDefined();
      }
    );
  });
});
```

---

## Error Handling

### Missing Branch Context

If you query a branch-level model without `branchId` in context:

```typescript
await runWithTenant({ organizationId: 'org-id' }, async () => {
  // Missing branchId!
  await prisma.order.findMany();
  // ❌ Throws: TENANT_BRANCH_REQUIRED: Operation on Order requires branch context
});
```

**Solution:** Ensure `branchId` is in JWT and passed to `runWithTenant()`.

### Missing Organization Context

If you query without any tenant context:

```typescript
await prisma.user.findMany();
// ❌ Throws: Tenant context is not set
```

**Solution:** Ensure request goes through `TenantMiddleware.attach`.

---

## Summary

✅ **DO:**
- Use `getPrisma()` in all repositories
- Trust the automatic filtering
- Use `withoutTenant()` for signup/admin operations
- Use `getBasePrisma()` only for health checks

❌ **DON'T:**
- Inject `PrismaClient` directly in repositories
- Try to manually add `branchId` filters (extension does it)
- Use `getPrisma()` without tenant context (will throw error)
- Bypass the extension (security risk)
