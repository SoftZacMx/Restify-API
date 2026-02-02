# Despliegue en Railway

Checklist para tener la API funcionando en Railway.

## 1. Repo y build

- **Dockerfile** en la raíz (ya incluido): Railway lo detecta y usa ese build.
- **.dockerignore** (ya incluido): reduce tamaño del contexto de build.
- No hace falta `nginx.conf` ni Procfile; el arranque está en el `CMD` del Dockerfile.

## 2. Variables de entorno (obligatorias)

En el proyecto de Railway → servicio de la API → **Variables**:

| Variable        | Descripción                          | Ejemplo (QA)                    |
|-----------------|--------------------------------------|---------------------------------|
| `DATABASE_URL` | URL MySQL (Railway o externo)        | `mysql://user:pass@host:port/db` |
| `JWT_SECRET`   | Secreto para firmar tokens           | String largo y aleatorio        |
| `NODE_ENV`     | Entorno                              | `production` o `qa`             |

Sin estas tres, la API puede no arrancar o fallar en login/health.

## 3. Variables recomendadas

| Variable           | Para qué                               |
|--------------------|----------------------------------------|
| `CORS_ORIGIN`      | Origen del frontend (ej. `https://tu-app.railway.app`). Varios separados por coma. |
| `JWT_EXPIRES_IN`   | Caducidad del token (default `24h`)    |
| `STRIPE_SECRET_KEY` | Pagos con Stripe (modo test: `sk_test_...`) |
| `STRIPE_WEBHOOK_SECRET` | Webhooks de Stripe (si usas)      |

## 4. Release Command (migraciones)

En Railway → servicio → **Settings** → **Deploy**:

- **Release Command**:  
  `npx prisma migrate deploy --schema=./src/core/infrastructure/database/prisma/schema.prisma`

Así en cada deploy se aplican las migraciones antes de servir tráfico.

## 5. Opcional: AWS (SQS, DynamoDB, WebSockets)

Si en Railway **no** usas LocalStack ni AWS real, puedes omitir estas variables. Los workers (colas) y conexiones WebSocket que dependan de AWS fallarán solo cuando se usen; la API HTTP puede seguir respondiendo.

Si **sí** usas AWS en QA:

- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`
- `PAYMENT_NOTIFICATIONS_QUEUE_URL`, `ORDER_NOTIFICATIONS_QUEUE_URL`
- `WEBSOCKET_CONNECTIONS_TABLE` (DynamoDB)
- `AWS_ENDPOINT_URL` solo si apuntas a un endpoint distinto (ej. LocalStack).

## 6. Puerto

Railway asigna `PORT`; la app ya usa `process.env.PORT || 3000`. No hay que configurar nada más.

## 7. Resumen mínimo

1. Repo con **Dockerfile** y **.dockerignore** (ya está).
2. **Variables**: al menos `DATABASE_URL`, `JWT_SECRET`, `NODE_ENV`.
3. **Release Command**: `npx prisma migrate deploy --schema=./src/core/infrastructure/database/prisma/schema.prisma`.
4. (Opcional) `CORS_ORIGIN` con la URL del frontend.

Con eso basta para desplegar en Railway.
