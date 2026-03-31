# Mejoras Backend - Plan de Implementación

Plan de mejoras organizado en 3 fases, de lo más urgente a lo menos crítico.

---

## Fase 1 - Seguridad Crítica

Tareas que deben resolverse antes de cualquier release a producción.

| # | Tarea | Detalle | Status |
|---|-------|---------|--------|
| 1.1 | Reactivar validación de webhook MercadoPago | El controller no valida la firma del webhook. Cualquiera puede forjar confirmaciones de pago. El método `validateWebhookSignature` existe pero no se usa | Pendiente |
| 1.2 | Implementar middleware de autorización por roles | El JWT tiene `rol` pero ningún middleware lo valida. Un mesero puede borrar usuarios, ver reportes, gestionar suscripciones | Pendiente |
| 1.3 | Agregar autenticación a rutas desprotegidas | `/api/users`, `/api/products`, `/api/tables`, `/api/menu-categories`, `/api/menu-items` no aplican `AuthMiddleware.authenticate` | Pendiente |
| 1.4 | Proteger `/api/auth/set-password/:user_id` | Cualquiera con un user_id puede setear contraseña. Debería requerir token de invitación o autenticación | Pendiente |
| 1.5 | Agregar `helmet` para headers de seguridad | Faltan headers como X-Frame-Options, HSTS, X-Content-Type-Options, etc. | Pendiente |
| 1.6 | Limitar tamaño de body en `express.json()` | Permite payloads arbitrariamente grandes (DoS). Agregar `{ limit: '1mb' }` | Pendiente |

---

## Fase 2 - Robustez y Configuración

Tareas que mejoran la estabilidad y correcta operación del sistema.

| # | Tarea | Detalle | Status |
|---|-------|---------|--------|
| 2.1 | Reactivar middleware de suscripción | Las rutas que requieren suscripción activa están desprotegidas. El middleware está comentado en `routes/index.ts` | Pendiente |
| 2.2 | Soportar múltiples orígenes en CORS | `CORS_ALLOWED_ORIGINS` array está definido pero no se usa. Solo acepta un origen. Necesario para staging + producción | Pendiente |
| 2.3 | Corregir SubscriptionMiddleware que traga errores | Si la BD falla, llama `next()` sin error. Los usuarios bypasean la validación de suscripción. Debe fallar cerrado | Pendiente |
| 2.4 | Hacer `JwtUtil` lazy | Evalúa SECRET al importar. Si se importa antes de `dotenv.config()` (ej: tests), falla. Hacerlo lazy o inyectar config | Pendiente |
| 2.5 | Implementar logging estructurado | Todo es `console.log/error`. Adoptar pino o winston con JSON output, log levels y request correlation IDs | Pendiente |
| 2.6 | Mover `@types/socket.io` a devDependencies | Los paquetes de tipos no deben ir en producción | Pendiente |

---

## Fase 3 - Mantenibilidad y Código Limpio

Tareas que mejoran la calidad del código y reducen deuda técnica.

| # | Tarea | Detalle | Status |
|---|-------|---------|--------|
| 3.1 | Unificar validación Zod en middleware | Algunos controllers parsean Zod manualmente en vez de usar `zodValidator` consistentemente en las rutas | Pendiente |
| 3.2 | Corregir AuthMiddleware para usar `next(error)` | Envía JSON directamente, creando un path de error paralelo al error handler global | Pendiente |
| 3.3 | Refactorizar login para no monkey-patchear `res.json` | Intercepta la respuesta para setear cookies. Patrón frágil. El controller debería retornar el token y setear la cookie directamente | Pendiente |
| 3.4 | Dividir `dependency-injection.ts` por módulo | Es un archivo de ~200 líneas que hay que editar para cada nueva entidad. Separar por dominio | Pendiente |
| 3.5 | Crear factory para controllers | ~30 controllers tienen boilerplate idéntico: try/catch → resolve → execute → sendSuccess. Un `makeController(UseCaseClass)` lo eliminaría | Pendiente |
| 3.6 | Reemplazar `any` por `unknown` en error handler | `expressErrorHandler` usa `error: any`. Usar `unknown` y narrowing explícito es más seguro | Pendiente |
