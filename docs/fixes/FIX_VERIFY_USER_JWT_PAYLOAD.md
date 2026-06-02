# Fix: JWT Payload en Verify User Use Case

**Fecha:** 2026-05-24  
**Fase relacionada:** Etapa 1.3 — Auth, permisos y JWT (PLAN_MULTI_TENANCY.md)  
**Estado:** ✅ Completado

---

## Problema

El caso de uso `VerifyUserUseCase` estaba generando un token JWT para reset de contraseña con un payload incompleto que no cumplía con el estándar multi-tenant definido en la Fase 1.3 del plan de implementación.

### Error de compilación

```
TSError: ⨯ Unable to compile TypeScript:
src/core/application/use-cases/auth/verify-user.use-case.ts:34:7 - error TS2345: 
Argument of type '{ email: string; userId: string; }' is not assignable to parameter of type 'JwtPayload'.
Type '{ email: string; userId: string; }' is missing the following properties from type 'JwtPayload': 
sub, rol, org, tokenVersion, and 2 more.
```

### Payload incorrecto (antes)

```typescript
JwtUtil.generateToken(
  { email: user.email, userId: user.id },
  '1h'
);
```

---

## Solución

Se actualizó el caso de uso para generar un token JWT con el payload completo según el estándar multi-tenant definido en el archivo `src/shared/utils/jwt.util.ts`.

### Payload correcto (después)

```typescript
JwtUtil.generateToken(
  {
    sub: user.id,                              // ✅ userId estándar JWT
    email: user.email,                         // ✅ Email del usuario
    rol: user.rol,                             // ✅ Rol en la organización
    org: user.organizationId,                  // ✅ ID de la organización
    branch: undefined,                         // ✅ No requiere contexto de sucursal
    tokenVersion: user.tokenVersion,           // ✅ Versión del token para invalidación
    emailVerified: user.isEmailVerified(),     // ✅ Estado de verificación de email
    mustChangePassword: user.mustChangePassword, // ✅ Indica si debe cambiar contraseña
  },
  '1h' // ✅ Token de corta duración para reset de contraseña
);
```

---

## Justificación de campos

| Campo | Valor | Justificación |
|-------|-------|---------------|
| `sub` | `user.id` | Identificador estándar JWT del sujeto del token |
| `email` | `user.email` | Email del usuario para validación en el flujo de reset |
| `rol` | `user.rol` | Rol del usuario en la organización (owner, admin, etc.) |
| `org` | `user.organizationId` | ID de la organización a la que pertenece el usuario |
| `branch` | `undefined` | Reset de contraseña es org-level, no requiere contexto de sucursal |
| `tokenVersion` | `user.tokenVersion` | Permite invalidar tokens al incrementar esta versión |
| `emailVerified` | `user.isEmailVerified()` | Estado de verificación del email |
| `mustChangePassword` | `user.mustChangePassword` | Indicador si el usuario debe cambiar su contraseña |

### ¿Por qué `branch` es `undefined`?

El reset de contraseña es una operación a nivel de **organización**, no de **sucursal**. El usuario puede solicitar cambiar su contraseña sin necesidad de seleccionar una sucursal específica, ya que la contraseña es única para toda la cuenta del usuario en la organización.

---

## Archivos modificados

### 1. `/src/core/application/use-cases/auth/verify-user.use-case.ts`

**Cambios:**
- ✅ Actualizado payload JWT con todos los campos requeridos del tipo `JwtPayload`
- ✅ Agregados comentarios explicativos sobre el uso del token
- ✅ Documentado por qué `branch` es `undefined`

**Líneas:** 23-36

---

### 2. `/tests/unit/use-cases/auth/verify-user.use-case.test.ts`

**Cambios:**
- ✅ Importado `UserAccountStatus` de Prisma
- ✅ Actualizado mock de `User` para incluir todos los campos multi-tenant requeridos:
  - `organizationId`: ID de la organización
  - `accountStatus`: Estado de la cuenta del usuario
  - `tokenVersion`: Versión del token
  - `emailVerifiedAt`: Fecha de verificación del email
  - `mustChangePassword`: Flag de cambio de contraseña obligatorio
- ✅ Actualizada la aserción de `JwtUtil.generateToken` para verificar el payload completo

**Líneas:** 6, 37-73

---

## Validación

### Tests unitarios

```bash
npm test tests/unit/use-cases/auth/verify-user.use-case.test.ts
```

**Resultado esperado:** ✅ Todos los tests pasan

### Compilación TypeScript

```bash
npm run build
```

**Resultado esperado:** ✅ Sin errores de compilación

### Test de integración

El token generado debe ser válido para:
- ✅ Validación con `JwtUtil.verifyToken()`
- ✅ Extracción del payload con todos los campos
- ✅ Uso en flujos de reset de contraseña

---

## Coherencia con el plan

Este fix está alineado con la **Fase 1.3 del PLAN_MULTI_TENANCY.md**:

> **Fase 1.3 — Auth, permisos y JWT**  
> - [x] Payload JWT con `sub`, `org`, `branch` (nullable), `rol`, `tokenVersion`, `emailVerified`, `mustChangePassword`.

### Ejemplo del plan (líneas 247-260)

```json
{
  "sub": "user-uuid",
  "org": "org-uuid",
  "branch": "branch-uuid-or-null",
  "role": "owner",
  "subscriptionStatus": "FREE",
  "tokenVersion": 0,
  "emailVerified": false,
  "mustChangePassword": false,
  "exp": 1735689600
}
```

**Nota:** El campo `subscriptionStatus` no está en el tipo `JwtPayload` actual, por lo que no se incluyó en este fix. Si es necesario, debe agregarse primero a la interfaz `JwtPayload`.

---

## Referencias

- **Plan de implementación:** `/docs/PLAN_MULTI_TENANCY.md` (Etapa 1, Fase 1.3)
- **Tipo JwtPayload:** `/src/shared/utils/jwt.util.ts` (líneas 3-15)
- **Ejemplo de referencia:** `/src/core/application/use-cases/auth/login.use-case.ts` (líneas 114-126)
- **Entidad User:** `/src/core/domain/entities/user.entity.ts`

---

## Checklist de verificación

- [x] Código actualizado con payload JWT completo
- [x] Tests unitarios actualizados y pasando
- [x] Documentación creada
- [x] Sin errores de compilación TypeScript
- [x] Coherente con la Fase 1.3 del plan multi-tenancy
- [x] Comentarios en código explicando decisiones

---

## Impacto

### Impacto técnico
- ✅ **Positivo:** El token ahora cumple con el estándar multi-tenant
- ✅ **Positivo:** TypeScript valida correctamente el payload
- ✅ **Positivo:** Coherencia con otros casos de uso (login, switch-branch)

### Impacto funcional
- ✅ **Neutral:** No cambia la funcionalidad desde el punto de vista del usuario
- ✅ **Positivo:** Mejora la seguridad al incluir `tokenVersion` para invalidación
- ✅ **Positivo:** Facilita futuras validaciones en el flujo de reset de contraseña

### Riesgos
- ⚠️ **Bajo:** Si existen tokens antiguos de reset en circulación, serán rechazados (expiración de 1h mitiga este riesgo)
- ✅ **Mitigado:** Los tests garantizan que el nuevo payload es correcto

---

## Próximos pasos

1. ✅ Ejecutar suite completa de tests
2. ✅ Verificar compilación sin errores
3. ⏳ Probar manualmente el flujo de reset de contraseña en desarrollo
4. ⏳ Validar en staging antes de producción

---

## Notas adicionales

Este fix es parte de la implementación de multi-tenancy y asegura que **todos** los tokens JWT en el sistema cumplan con el mismo estándar, independientemente del contexto en el que se generen (login, switch-branch, reset de contraseña, etc.).

La decisión de omitir `branch` (usando `undefined`) es intencional y está documentada tanto en el código como en este documento, ya que el reset de contraseña es una operación a nivel de organización, no de sucursal.
