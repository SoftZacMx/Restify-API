# 📋 Contexto de Desarrollo - Restify API

**Última actualización:** $(date)  
**Propósito:** Documento de contexto para mantener consistencia en desarrollo y ayudar a futuros chats de IA a entender el proyecto.

---

## 🎯 Principios Fundamentales

### 1. **Seguridad Primero**
- **NUNCA** usar fallbacks para credenciales sensibles (JWT_SECRET, STRIPE_SECRET_KEY, etc.)
- **SIEMPRE** validar entrada con Zod antes de procesar
- **SIEMPRE** usar Prisma ORM (previene SQL injection automáticamente)
- **SIEMPRE** implementar rate limiting en endpoints de autenticación
- **NUNCA** exponer stack traces o información sensible en errores al cliente

### 2. **Clean Architecture**
- Separación clara de capas: Domain → Application → Infrastructure
- Use Cases contienen la lógica de negocio
- Repositorios abstraen el acceso a datos
- Handlers solo coordinan, no contienen lógica de negocio

### 3. **Type Safety**
- Minimizar uso de `any`
- Definir tipos específicos para todas las entidades
- Usar interfaces para contratos entre capas

### 4. **Validación Consistente**
- **TODOS** los endpoints deben validar entrada con Zod
- Validar body, query parameters y path parameters
- Usar DTOs tipados para validación

---

## 🏗️ Arquitectura del Proyecto

### Estructura de Carpetas
```
Restify/src/
├── core/                    # Lógica de negocio (Clean Architecture)
│   ├── domain/             # Entidades y interfaces
│   │   ├── entities/       # Entidades de dominio
│   │   └── interfaces/     # Interfaces de repositorios
│   ├── application/        # Casos de uso y DTOs
│   │   ├── use-cases/     # Lógica de negocio
│   │   └── dto/           # Data Transfer Objects (con Zod)
│   └── infrastructure/    # Implementaciones técnicas
│       ├── database/      # Prisma y repositorios
│       ├── payment-gateways/ # Stripe, etc.
│       └── config/        # Configuración (DI, Prisma)
├── handlers/               # Handlers Lambda/Middy
├── server/                 # Servidor Express local
│   ├── routes/             # Definición de rutas
│   ├── middleware/        # Middlewares (auth, rate-limit, etc.)
│   └── config/            # Configuración del servidor
└── shared/                 # Utilidades compartidas
    ├── middleware/         # Middlewares compartidos (Zod validator, error handler)
    ├── utils/             # Utilidades (JWT, Bcrypt)
    └── errors/            # Manejo de errores centralizado
```

### Flujo de Datos
```
Request → Handler → Zod Validator → Use Case → Repository → Prisma → Database
                ↓
         Error Handler → Response
```

---

## 🔒 Reglas de Seguridad

### Variables de Entorno
```typescript
// ✅ CORRECTO - Falla si no está definido
const SECRET = (() => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required');
  }
  return secret;
})();

// ❌ INCORRECTO - Nunca hacer esto
const SECRET = process.env.JWT_SECRET || 'default-secret';
```

### Autenticación
- **TODAS** las rutas (excepto `/health` y `/api/auth/*`) deben usar `AuthMiddleware.authenticate`
- JWT tokens validados con `JwtUtil.verifyToken()`
- Tokens expiran en 24h por defecto (configurable con `JWT_EXPIRES_IN`)

### Rate Limiting
- **Login:** 5 intentos cada 15 minutos por IP
- **Verificación/Cambio de contraseña:** 3 intentos cada 15 minutos
- **Endpoints generales:** 100 requests por minuto por IP
- Los intentos exitosos NO cuentan (solo fallidos)

### Validación de Entrada
```typescript
// ✅ SIEMPRE usar Zod
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

// En el handler
.use(zodValidator({ schema: loginSchema, eventKey: 'body' }))
```

### Manejo de Errores
```typescript
// ✅ CORRECTO - No exponer información sensible
catch (error) {
  console.error('Operation error:', error instanceof Error ? error.message : 'Unknown error');
  throw new AppError('INTERNAL_ERROR', 'An error occurred');
}

// ❌ INCORRECTO - Nunca hacer esto
catch (error) {
  response.data = error; // Expone stack traces
}
```

### Base de Datos
- **SIEMPRE** usar Prisma ORM (nunca queries SQL directas)
- **SIEMPRE** usar transacciones para operaciones que crean múltiples registros
- **SIEMPRE** usar batch queries (`findMany` con `IN`) en lugar de loops con queries individuales

```typescript
// ✅ CORRECTO - Prisma previene SQL injection
const users = await prisma.user.findMany({
  where: { status: true, rol: 'Admin' }
});

// ❌ INCORRECTO - Nunca hacer esto
const query = `SELECT * FROM users WHERE status = ${status}`;
```

---

## 📝 Estándares de Código

### Nombres de Archivos
- **Handlers:** `kebab-case.handler.ts` (ej: `create-user.handler.ts`)
- **Use Cases:** `kebab-case.use-case.ts` (ej: `create-user.use-case.ts`)
- **Repositorios:** `kebab-case.repository.ts` (ej: `user.repository.ts`)
- **DTOs:** `kebab-case.dto.ts` (ej: `user.dto.ts`)
- **Middlewares:** `kebab-case.middleware.ts` (ej: `rate-limit.middleware.ts`)

### Estructura de Handlers
```typescript
import middy from '@middy/core';
import httpJsonBodyParser from '@middy/http-json-body-parser';
import { zodValidator } from '../../shared/middleware/zod-validator.middleware';
import { customErrorHandler } from '../../shared/middleware/error-handler.middleware';
import { responseFormatter } from '../../shared/middleware/response-formatter.middleware';

const handlerBase = async (event: APIGatewayProxyEvent): Promise<any> => {
  const validatedData = event.body as any;
  const useCase = container.resolve(UseCase);
  const result = await useCase.execute(validatedData);
  return result;
};

export const handler = middy(handlerBase)
  .use(httpEventNormalizer())
  .use(httpJsonBodyParser())
  .use(zodValidator({ schema: schema, eventKey: 'body' }))
  .use(customErrorHandler())
  .use(responseFormatter());
```

### Estructura de Use Cases
```typescript
import { inject, injectable } from 'tsyringe';
import { AppError } from '../../../../shared/errors';

@injectable()
export class CreateUserUseCase {
  constructor(
    @inject('IUserRepository') private readonly userRepository: IUserRepository
  ) {}

  async execute(input: CreateUserInput): Promise<CreateUserResult> {
    // Validaciones de negocio
    // Llamadas a repositorios
    // Retornar resultado
  }
}
```

### Estructura de Repositorios
```typescript
import { PrismaClient } from '@prisma/client';
import { injectable } from 'tsyringe';
import { IUserRepository } from '../../../domain/interfaces/user-repository.interface';

@injectable()
export class UserRepository implements IUserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    return user ? User.fromPrisma(user) : null;
  }
}
```

---

## 🛠️ Tecnologías y Herramientas

### Stack Principal
- **Runtime:** Node.js con TypeScript
- **Framework:** Express (local) + AWS Lambda (producción)
- **ORM:** Prisma (MySQL)
- **Validación:** Zod
- **Autenticación:** JWT (jsonwebtoken)
- **Hashing:** bcryptjs (10 salt rounds)
- **DI:** tsyringe
- **Testing:** Jest

### Dependencias Críticas
```json
{
  "@prisma/client": "^5.7.1",
  "zod": "^3.22.4",
  "express-rate-limit": "^7.x",
  "jsonwebtoken": "^9.0.2",
  "bcryptjs": "^2.4.3",
  "tsyringe": "^4.8.0"
}
```

---

## 📦 Patrones Implementados

### 1. Dependency Injection (tsyringe)
```typescript
// Registrar en dependency-injection.ts
container.register<IUserRepository>('IUserRepository', {
  useFactory: () => new UserRepository(prismaClient),
});

// Usar en Use Cases
@injectable()
export class CreateUserUseCase {
  constructor(
    @inject('IUserRepository') private readonly userRepository: IUserRepository
  ) {}
}
```

### 2. Repository Pattern
- Interfaces en `domain/interfaces/`
- Implementaciones en `infrastructure/database/repositories/`
- Use Cases dependen de interfaces, no de implementaciones

### 3. Use Case Pattern
- Cada operación de negocio es un Use Case
- Use Cases son inyectables y testables
- No dependen de frameworks (Express, Lambda, etc.)

### 4. DTO Pattern
- DTOs definen la estructura de entrada/salida
- Validación con Zod integrada
- Tipos TypeScript generados automáticamente

---

## ✅ Checklist para Nuevos Módulos

Antes de crear un nuevo módulo, verificar:

### Seguridad
- [ ] Variables de entorno sin fallbacks hardcodeados
- [ ] Autenticación en todas las rutas (excepto auth y health)
- [ ] Rate limiting en endpoints críticos
- [ ] Validación con Zod en todos los inputs
- [ ] Manejo de errores sin exponer información sensible

### Arquitectura
- [ ] Entidad de dominio creada
- [ ] Interface de repositorio definida
- [ ] Repositorio implementado con Prisma
- [ ] DTOs con validación Zod
- [ ] Use Case con lógica de negocio
- [ ] Handler con middlewares apropiados
- [ ] Ruta registrada en `routes/index.ts`

### Base de Datos
- [ ] Modelo Prisma definido en `schema.prisma`
- [ ] Transacciones para operaciones atómicas
- [ ] Batch queries (no N+1 queries)
- [ ] Índices apropiados en campos de búsqueda

### Funcionalidad
- [ ] Paginación en listados (máximo 100 items por página)
- [ ] Filtros validados y sanitizados
- [ ] Respuestas consistentes con formato estándar
- [ ] Tests unitarios y E2E

---

## 🚫 Anti-Patrones (NUNCA Hacer)

### ❌ SQL Injection
```typescript
// NUNCA hacer esto
const query = `SELECT * FROM users WHERE id = ${userId}`;
```

### ❌ Fallbacks Inseguros
```typescript
// NUNCA hacer esto
const secret = process.env.JWT_SECRET || 'default-secret';
```

### ❌ Exponer Errores
```typescript
// NUNCA hacer esto
catch (error) {
  res.json({ error: error.stack });
}
```

### ❌ Queries N+1
```typescript
// NUNCA hacer esto
for (const item of items) {
  const product = await prisma.product.findUnique({ where: { id: item.id } });
}

// Hacer esto en su lugar
const productIds = items.map(item => item.id);
const products = await prisma.product.findMany({ where: { id: { in: productIds } } });
```

### ❌ Sin Validación
```typescript
// NUNCA hacer esto
const handler = async (event) => {
  const data = event.body; // Sin validar
  // ...
};
```

---

## 📊 Configuraciones Importantes

### Rate Limiting
- **Login:** 5 intentos / 15 minutos
- **Password Reset:** 3 intentos / 15 minutos
- **API General:** 100 requests / minuto

### Bcrypt
- **Salt Rounds:** 10 (estándar recomendado)

### JWT
- **Expiración:** 24h (configurable con `JWT_EXPIRES_IN`)
- **Secret:** Requerido, sin fallback

### CORS
- Configurado por `CORS_ORIGIN` (comma-separated)
- En producción debe estar definido (no usar `*`)

---

## 🔍 Cómo Trabajar con Este Proyecto

### Para Agregar un Nuevo Endpoint

1. **Crear DTO con Zod:**
   ```typescript
   // core/application/dto/user.dto.ts
   export const createUserSchema = z.object({
     name: z.string().min(1),
     email: z.string().email(),
   });
   ```

2. **Crear Use Case:**
   ```typescript
   // core/application/use-cases/users/create-user.use-case.ts
   @injectable()
   export class CreateUserUseCase {
     // ...
   }
   ```

3. **Crear Handler:**
   ```typescript
   // handlers/users/create-user.handler.ts
   export const createUserHandler = middy(handlerBase)
     .use(zodValidator({ schema: createUserSchema }))
     .use(customErrorHandler())
     .use(responseFormatter());
   ```

4. **Crear Ruta:**
   ```typescript
   // server/routes/user.routes.ts
   router.post('/users', AuthMiddleware.authenticate, async (req, res) => {
     // Adaptar request y llamar handler
   });
   ```

### Para Modificar un Módulo Existente

1. Verificar que sigue los principios de seguridad
2. Asegurar que usa Prisma (no SQL directo)
3. Validar que tiene rate limiting si es crítico
4. Verificar que maneja errores correctamente
5. Actualizar tests si es necesario

---

## 📚 Referencias Importantes

- **Prisma Docs:** https://www.prisma.io/docs
- **Zod Docs:** https://zod.dev
- **OWASP Top 10:** https://owasp.org/www-project-top-ten/
- **Express Rate Limit:** https://github.com/express-rate-limit/express-rate-limit

---

## 🎯 Objetivos del Proyecto

1. **Seguridad:** Protección contra vulnerabilidades comunes
2. **Escalabilidad:** Arquitectura que crece con el negocio
3. **Mantenibilidad:** Código limpio y bien estructurado
4. **Testabilidad:** Fácil de testear y validar
5. **Performance:** Queries optimizadas, sin N+1, con paginación

---

## ⚠️ Recordatorios Críticos

1. **NUNCA** hardcodear credenciales o API keys
2. **SIEMPRE** usar transacciones para operaciones que crean múltiples registros
3. **SIEMPRE** usar batch queries en lugar de loops
4. **SIEMPRE** agregar paginación a listados
5. **SIEMPRE** proteger rutas con autenticación
6. **SIEMPRE** validar entrada con Zod
7. **NUNCA** exponer stack traces al cliente
8. **SIEMPRE** usar Prisma (nunca SQL directo)

---

**Este documento debe ser leído y seguido en todos los desarrollos futuros.**

