# Reglas del proyecto — Restify API

## Cómo escribir código
- La solución más simple posible, sin sacrificar seguridad ni escalabilidad.
- Código legible por sí solo. Nombres semánticos en variables, funciones,
  clases y métodos.
- Comentarios al mínimo: solo el "por qué" en puntos no obvios.
- Identificadores en inglés; comentarios en español.

## Verifica tu trabajo
- `npm run lint`
- `npm run build`  → typecheck (tsc)
- `npm test` / `npm run test:unit` / `npm run test:integration`
- Cambios de esquema: `npm run prisma:migrate:dev -- --name <nombre>`

## Arquitectura (Clean Architecture — depende de interfaces, no de clases)
- core/domain/        → entidades, interfaces (contratos), tipos. Sin dependencias externas.
- core/application/   → use-cases (un caso = una acción), DTOs (Zod), mappers, services.
- core/infrastructure/→ implementaciones: database/repositories + Prisma, storage (S3),
  payment-gateways, messaging, tenant, websocket, scheduler, config (DI).
- controllers/        → finos; usa makeController(UseCase, { mapper }). Sin lógica de negocio.
- Inyección de dependencias con tsyringe (tokens tipo 'IProductRepository').
- Validación de entrada con Zod en los DTOs.
- Errores: lanza AppError con código del catálogo (shared/errors), nunca throw de strings.

## Multi-tenant (CRÍTICO — fail-closed)
- Toda consulta corre con contexto de tenant; SIN contexto la query falla a
  propósito. Usa runWithTenant / withoutTenant según el caso.
- Dentro de $transaction el filtro de tenant SÍ aplica (Prisma 5.22): usa getPrisma().
- Nunca expongas datos de otra organización/sucursal.

## Base de datos
- Cambios de esquema SIEMPRE por migración de Prisma versionada y commiteada.
- El contenedor aplica migraciones al arrancar (migrate deploy).

## Pagos y efectos externos (TRAMPAS del proyecto)
- Órdenes y reembolsos: SOLO Mercado Pago. Stripe quedó únicamente para
  suscripciones (todo el Stripe de órdenes se eliminó).
- Webhook de MP: la verificación de firma está DESACTIVADA a propósito (bug
  conocido de MP); la seguridad viene del re-fetch + idempotencia. No la
  "arregles" reactivándola sin contexto.
- Efectos externos de limpieza (p. ej. borrar imagen en S3) son best-effort:
  si fallan, se loggean pero NO rompen la operación principal.
- Railway ya no se usa (railway.json es config muerta).
