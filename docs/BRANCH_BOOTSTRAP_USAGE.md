# Branch Bootstrap - Guía de Uso

Servicios implementados en **Fase 2.4** para la creación de la primera sucursal durante signup.

## Servicios Disponibles

### 1. CreateFirstBranchUseCase

**Propósito:** Crea la primera sucursal de una organización durante el signup.

**Características:**
- NO valida límites de plan (la primera branch siempre se permite)
- Trabaja dentro de transacciones
- NO requiere contexto tenant (usa `getBasePrisma()`)
- Toma `organizationId` explícitamente como input

**Ubicación:** `src/core/application/use-cases/branches/create-first-branch.use-case.ts`

### 2. BootstrapBranchService

**Propósito:** Crea datos iniciales para reducir fricción en onboarding.

**Crea:**
- 4 categorías de menú predeterminadas: Entradas, Platos principales, Bebidas, Postres
- 1 mesa inicial: "Mesa 1"

**Ubicación:** `src/core/application/services/bootstrap-branch.service.ts`

---

## Cómo Usar en Signup (Etapa 4.1)

### Ejemplo de Implementación

```typescript
import { getBasePrisma } from '../infrastructure/database/prisma/get-prisma';
import { CreateFirstBranchUseCase } from '../use-cases/branches/create-first-branch.use-case';
import { BootstrapBranchService } from '../services/bootstrap-branch.service';
import { container } from 'tsyringe';

export class SignupUseCase {
  async execute(input: SignupInput): Promise<SignupResult> {
    const prisma = getBasePrisma(); // NO usar getPrisma() - sin tenant extension
    
    const createFirstBranch = container.resolve(CreateFirstBranchUseCase);
    const bootstrapBranch = container.resolve(BootstrapBranchService);

    // Todo en una transacción atómica
    const result = await prisma.$transaction(async (tx) => {
      // 1. Crear organización
      const organization = await tx.organization.create({
        data: {
          name: input.organizationName,
          slug: generateSlug(input.organizationName),
          plan: 'FREE',
          status: 'ACTIVE',
        },
      });

      // 2. Crear usuario owner
      const user = await tx.user.create({
        data: {
          name: input.userName,
          last_name: input.userLastName,
          email: input.email,
          password: await hashPassword(input.password),
          rol: 'OWNER',
          organizationId: organization.id,
          accountStatus: 'ACTIVE',
          tokenVersion: 0,
        },
      });

      // 3. Crear primera sucursal (sin validar límites)
      const branch = await createFirstBranch.execute(tx, {
        organizationId: organization.id,
        name: input.branchName,
        state: input.branchState,
        city: input.branchCity,
        street: input.branchStreet,
        exteriorNumber: input.branchExteriorNumber,
        phone: input.branchPhone,
        rfc: input.branchRfc,
        timezone: input.timezone, // desde navegador
        startOperations: input.startOperations,
        endOperations: input.endOperations,
      });

      // 4. Bootstrap con datos iniciales (categorías + mesa)
      await bootstrapBranch.execute(tx, branch.id, user.id);

      // 5. Crear suscripción Free
      await tx.subscription.create({
        data: {
          organizationId: organization.id,
          status: 'FREE',
          // ... otros campos según schema
        },
      });

      return { organization, user, branch };
    });

    // 6. Generar JWT con branchId inicial
    const token = JwtUtil.generateToken({
      sub: result.user.id,
      org: result.organization.id,
      branch: result.branch.id, // ← Primera branch activa
      role: 'OWNER',
      tokenVersion: 0,
      emailVerified: false,
      mustChangePassword: false,
    }, '8h');

    // 7. Enviar email de verificación (opcional)
    await emailService.sendVerificationEmail(result.user.email);

    return {
      token,
      user: mapUserResponse(result.user),
      organization: mapOrgResponse(result.organization),
      branch: mapBranchResponse(result.branch),
    };
  }
}
```

---

## Tests de Integración

Ver ejemplo completo en: `tests/integration/branches/bootstrap-first-branch.integration.test.ts`

El test demuestra:
- ✅ Creación de branch + bootstrap en transacción
- ✅ Verificación de categorías (4 creadas)
- ✅ Verificación de mesa inicial
- ✅ Rollback si falla el bootstrap

---

## Datos Creados por Bootstrap

### Categorías de Menú (4)
1. **Entradas** - status: `true`
2. **Platos principales** - status: `true`
3. **Bebidas** - status: `true`
4. **Postres** - status: `true`

El usuario puede editarlas, eliminarlas o agregar más según su tipo de negocio.

### Mesa Inicial (1)
- **Nombre:** "Mesa 1"
- **Status:** `true`
- **Availability:** `true`
- **Owner:** userId del owner

Permite tomar órdenes inmediatamente después del signup.

---

## Notas Importantes

### ⚠️ Usar getBasePrisma() NO getPrisma()

```typescript
// ✅ CORRECTO - Sin tenant extension
const prisma = getBasePrisma();

// ❌ INCORRECTO - Con tenant extension (requiere contexto)
const prisma = getPrisma(); // Lanzará error "Tenant context is not set"
```

### ⚠️ Siempre en Transacción

```typescript
// ✅ CORRECTO - Transacción atómica
await prisma.$transaction(async (tx) => {
  const branch = await createFirstBranch.execute(tx, input);
  await bootstrapBranch.execute(tx, branch.id, userId);
});

// ❌ INCORRECTO - Sin transacción (puede quedar inconsistente)
const branch = await createFirstBranch.execute(prisma, input);
await bootstrapBranch.execute(prisma, branch.id, userId);
```

### ⚠️ Order Matters

El bootstrap **debe ejecutarse DESPUÉS** de crear la branch:

```typescript
// ✅ CORRECTO
const branch = await createFirstBranch.execute(tx, input);
await bootstrapBranch.execute(tx, branch.id, userId); // branch.id ya existe

// ❌ INCORRECTO
await bootstrapBranch.execute(tx, branchId, userId); // branchId no existe aún
const branch = await createFirstBranch.execute(tx, input);
```

---

## Registro en DI Container

Ya está configurado en: `src/core/infrastructure/config/dependency-injection/branch.module.ts`

```typescript
container.registerSingleton(BootstrapBranchService);
container.register(CreateFirstBranchUseCase, CreateFirstBranchUseCase);
```

Para usar:

```typescript
import { container } from 'tsyringe';

const createFirstBranch = container.resolve(CreateFirstBranchUseCase);
const bootstrapBranch = container.resolve(BootstrapBranchService);
```

---

## Próximos Pasos

1. **Implementar Etapa 4.1 (Signup público)**
   - Endpoint `POST /api/auth/signup`
   - Orquestación: org + user + branch + bootstrap
   - JWT con branchId inicial
   - Email verification

2. **Integrar en Frontend (Etapa 4.2)**
   - Wizard signup multi-paso
   - Paso 1: Org + Owner
   - Paso 2: Primera sucursal (datos de 2.4)

3. **Validaciones adicionales**
   - Email único
   - Slug único
   - Password policy
   - Rate limiting signup

---

## Soporte

Para dudas o mejoras, consultar:
- Plan completo: `docs/PLAN_MULTI_TENANCY.md` (Fase 2.4)
- Tests: `tests/integration/branches/bootstrap-first-branch.integration.test.ts`
