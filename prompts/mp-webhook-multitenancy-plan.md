# Plan: Robustecer multitenancy en pagos Mercado Pago (webhooks)

## Contexto

Hoy el flujo de pagos MP tiene 3 bugs de multitenancy:

1. **Cliente MP cacheado globalmente (crítico).** `MercadoPagoService` es singleton (`payment.module.ts:31`) y `initClient()` (`mercado-pago.service.ts:69`) inicializa el cliente una sola vez con `if (this.client) return`. El primer branch que opera fija su access token para todo el proceso: con cuentas MP distintas por branch, los cobros del branch B irían a la cuenta del branch A.
2. **El webhook resuelve el tenant DESPUÉS de llamar a MP.** `confirm-mercado-pago-payment.use-case.ts:63` llama `getPayment()` sin tenant context (usa el token global del env o el cacheado del bug 1), y recién en la línea 71-87 extrae el `branchId` del `external_reference`. Con tokens por branch, la consulta a MP se haría con credenciales equivocadas.
3. **Fallback legacy sin tenant context.** `confirm-mercado-pago-payment.use-case.ts:92-93` procesa pagos sin `runWithTenant`, por lo que la extensión Prisma no filtra por organización y se salta el check de organización `ACTIVE`.

**Principio del plan:** sin sobreingeniería. No se agregan colas, ni tablas nuevas, ni abstracciones de gateway. Solo se corrige el orden de resolución del tenant y el manejo de credenciales por branch.

**Fuera de alcance:** validación de firma del webhook — deshabilitada intencionalmente por un bug conocido en la implementación HMAC de MP. No reintroducir.

---

## Flujo resultante (post-plan)

### Creación del pago (Fase 1 + Tarea 2.1)

```
 POS / Cliente        UseCase PayOrderWithQR       MercadoPagoService           API Mercado Pago
      |               (tenant context activo)    (Map de clientes x branch)
      |                        |                            |                          |
      |--- pagar orden ------->|                            |                          |
      |                        |--- createPreference() ---->|                          |
      |                        |                            |                          |
      |                        |       PaymentConfigService.get()                     |
      |                        |       -> config del branch en contexto               |
      |                        |       -> cachea cliente en Map[branchId]             |
      |                        |          (ya NO un cliente global)                   |
      |                        |                            |                          |
      |                        |                            |--- crear preferencia --->|
      |                        |                            |    con token DEL BRANCH  |
      |                        |                            |                          |
      |                        |     notification_url incluye  ?branchId=X            |
      |                        |     external_reference     =  "orderId:branchId"     |
      |                        |                            |                          |
      |<-------------------- init_point (QR) --------------------------------------- -|
```

### Webhook (Fases 2 y 3)

```
 POST /webhooks/mercado-pago?branchId=X
      |
      v
 Controller: extrae branchId del query
      |
      v
 ¿branchId presente? ---- no (preferencia pre-plan) ----> Fallback temporal:
      |                                                   flujo actual via external_reference
      | sí                                                (se retira en Tarea 3.3)
      v
 Validar branch existe y organización ACTIVE ---- inválido ----> return null + warning
      |
      | ok
      v
 +--- runWithTenant({ branchId, orgId }) -------------------------------------------+
 |                                                                                  |
 |   getPayment() con token del branch (via Map de Fase 1)                          |
 |        |                                                                         |
 |        v                                                                         |
 |   ¿external_reference.branchId == query.branchId? -- no --> return null + warning|
 |        |                                                    (webhook cruzado     |
 |        | sí                                                  o forjado)          |
 |        v                                                                         |
 |   processPayment(): queries Prisma filtradas por tenant                          |
 |        |                                                                         |
 |        v                                                                         |
 |   update Payment/Order, liberar mesa, fee expense                                |
 |                                                                                  |
 +----------------------------------------------------------------------------------+
      |
      v
 log de auditoría (Tarea 4.3)
```

**Diferencia clave con el flujo actual:** hoy `getPayment` corre *antes* de conocer el tenant (con token global) y el tenant se deduce del contenido del pago; en el flujo nuevo el tenant se resuelve desde la URL *primero*, y tanto la llamada a MP como todas las queries corren dentro del contexto, con el `external_reference` solo como verificación cruzada. El path "sin contexto" (línea 93 actual) desaparece.

---

## Fase 1 — Credenciales MP por branch (fix del singleton)

Objetivo: que cada llamada a la API de MP use el token del branch en contexto, sin depender del orden de inicialización.

### Tarea 1.1 — Cachear clientes MP por branch en `MercadoPagoService`
- Archivo: `src/core/infrastructure/payment-gateways/mercado-pago.service.ts`
- Reemplazar los campos `client` / `preference` / `paymentClient` por un `Map<string, { preference: Preference; payment: PaymentMP }>` keyed por `branchId` (usar `'__env__'` como key cuando no hay tenant context).
- `initClient()` pasa a ser `getClients(): Promise<{ preference; payment }>`: lee `getBranchId()`, busca en el map, y si no existe crea el cliente con `paymentConfigService.get()` y lo guarda.
- Criterio de aceptación: dos branches con `paymentConfig` distinto obtienen clientes con tokens distintos en el mismo proceso. No cambia ninguna firma pública del servicio.

### Tarea 1.2 — Invalidar el cliente cacheado al guardar config
- Archivos: `mercado-pago.service.ts`, `src/core/application/services/payment-config.service.ts`
- Agregar `clearClient(branchId?: string)` en `MercadoPagoService` (espejo de `PaymentConfigService.clearCache`).
- Llamarlo donde hoy se llama `clearCache` (use case `save-payment-config.use-case.ts`), para que cambiar el token no requiera reiniciar el proceso.
- Criterio de aceptación: tras `save()` de una nueva config, la siguiente llamada a MP del branch usa el token nuevo.

---

## Fase 2 — Resolver el tenant ANTES de consultar MP en el webhook

Objetivo: eliminar el problema huevo-y-gallina (el tenant viene de adentro del pago, pero leer el pago requiere el token del tenant).

### Tarea 2.1 — Incluir `branchId` en la `notification_url`
- Archivos: `pay-order-with-qr-mercado-pago.use-case.ts:75`, `pay-public-order.use-case.ts:98`
- Al construir la URL, anexar el branch en contexto como query param: `${MP_NOTIFICATION_URL}?branchId=${getBranchId()}`.
- Mantener `external_reference` con formato `orderId:branchId` tal como está (sirve como verificación cruzada en 2.3).
- Criterio de aceptación: las preferencias nuevas se crean con `notification_url` que incluye `branchId`.

### Tarea 2.2 — El controller del webhook extrae `branchId` y lo pasa al use case
- Archivo: `src/controllers/payments/mercado-pago-webhook.controller.ts`
- Leer `req.query.branchId` (string opcional) y pasarlo en el input del use case: `{ mpPaymentId, action, branchId }`.
- Criterio de aceptación: cambio mínimo, solo plumbing; el controller no toma decisiones de tenant.

### Tarea 2.3 — Reordenar el use case: tenant primero, `getPayment` adentro
- Archivo: `confirm-mercado-pago-payment.use-case.ts`
- Nuevo orden en `execute()`:
  1. Si llega `branchId` (query param): validar branch + organización `ACTIVE` (lógica que ya existe en líneas 77-84) y hacer **todo** dentro de `runWithTenant`, incluido `getPayment()`.
  2. Dentro del contexto: tras obtener el pago, verificar que el `branchId` del `external_reference` coincida con el del query param; si no coinciden, loguear y devolver `null` (posible webhook cruzado o forjado).
  3. Si NO llega `branchId` por query (preferencias creadas antes de este cambio): mantener el flujo actual (getPayment → external_reference → runWithTenant) como compatibilidad temporal.
- Criterio de aceptación: con `branchId` en la URL, ninguna query ni llamada a MP corre fuera de tenant context.

---

## Fase 3 — Eliminar el path legacy sin contexto

Objetivo: que ningún pago se procese jamás sin tenant context.

### Tarea 3.1 — Rechazar `external_reference` sin `branchId`
- Archivo: `confirm-mercado-pago-payment.use-case.ts:92-93`
- Reemplazar `return this.processPayment(orderId, mpPayment)` por: loguear warning con `mpPaymentId` y `external_reference`, y devolver `null`.
- Justificación de seguridad de despliegue: las sesiones QR expiran en 5 minutos, así que no quedan preferencias vivas con formato legacy; cualquier webhook con ese formato es un reenvío viejo o un request forjado.
- Criterio de aceptación: no existe ningún call path hacia `processPayment` fuera de `runWithTenant`.

### Tarea 3.2 — (Limpieza, junto con 3.1) Tipar `processPayment`
- Mismo archivo: cambiar el parámetro `mpPayment: any` por `MPPaymentResult` (ya exportado en `mercado-pago.service.ts:38`). Cero costo, evita errores al tocar este código en la fase 2/3.

### Tarea 3.3 — (Posterior, opcional) Retirar el fallback de la Tarea 2.3.3
- Cuando todas las preferencias creadas antes de la Fase 2 hayan expirado (días, no semanas), eliminar el camino "sin `branchId` en query" y exigirlo siempre.
- Dejar un TODO con fecha en el código al implementar 2.3 para no olvidarlo.

---

## Fase 4 — Tests y observabilidad mínima

### Tarea 4.1 — Tests unitarios del use case
- Casos:
  - `branchId` en query → todo corre dentro de `runWithTenant` con ese branch (verificar que `getPayment` se llama dentro del contexto).
  - Mismatch entre `branchId` de query y de `external_reference` → `null` + warning.
  - `external_reference` sin `branchId` → `null` (no procesa).
  - Organización no `ACTIVE` → `null`.
  - Idempotencia existente: sin pago `PENDING` → `null` (no debe romperse).

### Tarea 4.2 — Test unitario de `MercadoPagoService` multi-branch
- Con dos branches con tokens distintos en contexto, el servicio construye dos clientes distintos; `clearClient(branchId)` fuerza re-creación.

### Tarea 4.3 — Log de auditoría en el webhook
- Archivo: `mercado-pago-webhook.controller.ts` o el use case.
- Un solo log estructurado por webhook procesado: `{ mpPaymentId, branchId resuelto, organizationId, resultado (procesado/ignorado/mismatch) }` con el `logger` existente.
- Sin métricas ni dashboards nuevos — solo el log.

---

## Orden de revisión sugerido (PRs)

| PR | Fases | Riesgo | Notas |
|----|-------|--------|-------|
| 1 | Fase 1 | Bajo | Aislado al servicio MP; sin cambios de contrato |
| 2 | Fase 2 + Tarea 3.2 | Medio | Cambia el flujo del webhook; compatible hacia atrás |
| 3 | Fase 3.1 + Fase 4 | Bajo | Elimina el path legacy; tests cubren todo lo anterior |

La Tarea 3.3 se hace días después del deploy del PR 2, como follow-up trivial.
