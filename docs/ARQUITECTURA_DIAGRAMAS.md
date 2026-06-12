# Arquitectura de Restify — Diagramas

Documento con diagramas de arquitectura de la aplicación **Restify**, incluyendo
WebSockets y las APIs de terceros que integra. Los diagramas están en sintaxis
[Mermaid](https://mermaid.js.org/) y se renderizan directamente en GitHub, VS Code
(con extensión de Mermaid) y la mayoría de visores de Markdown.

## Stack principal

| Capa            | Tecnología                                              |
| --------------- | ------------------------------------------------------- |
| Frontend        | React + Vite + TypeScript (Nginx en prod)               |
| Backend / API   | Node.js + Express + TypeScript (tsyringe DI)            |
| Tiempo real     | Socket.IO (`/socket.io`)                                |
| Base de datos   | MySQL vía Prisma ORM                                     |
| Pagos           | Stripe (tarjeta + suscripciones) · Mercado Pago (QR)    |
| Almacenamiento  | AWS S3 / MinIO (imágenes, apagable con `S3_ENABLED`)    |
| Mensajería      | AWS SQS (notificaciones de pagos y órdenes)             |
| Email           | AWS SES (apagable con `EMAIL_ENABLED`)                  |
| Jobs            | node-cron (limpieza de usuarios no verificados, etc.)   |

---

## Diagrama 1 — Arquitectura general del sistema

Vista de alto nivel: cliente, API, persistencia, WebSockets y servicios de terceros.

```mermaid
graph TB
    subgraph Clients["🖥️ Clientes"]
        Staff["Panel Staff / Admin<br/>(React + Vite)"]
        Public["Cliente Público<br/>(menú QR de mesa)"]
    end

    subgraph Edge["🌐 Edge"]
        Nginx["Nginx<br/>(sirve SPA + reverse proxy)"]
    end

    subgraph Backend["⚙️ Restify API (Node.js + Express)"]
        REST["REST API<br/>/api/*<br/>(controllers + use cases)"]
        WS["WebSocket Server<br/>Socket.IO /socket.io"]
        Cron["Cron Scheduler<br/>(node-cron)"]
        ConnMgr["WS Connection Manager<br/>(sockets por user/payment)"]
        Tenant["Tenant Context<br/>(multi-tenancy)"]
    end

    subgraph Data["💾 Persistencia"]
        MySQL[("MySQL<br/>(Prisma ORM)")]
    end

    subgraph ThirdParty["🔌 APIs de Terceros"]
        Stripe["Stripe API<br/>(pagos tarjeta + suscripciones)"]
        MP["Mercado Pago API<br/>(pago QR)"]
        SES["AWS SES<br/>(email)"]
        S3["AWS S3 / MinIO<br/>(imágenes)"]
        SQS["AWS SQS<br/>(colas notificaciones)"]
    end

    Staff -->|HTTPS| Nginx
    Public -->|HTTPS| Nginx
    Staff -.->|WSS| WS
    Public -.->|WSS| WS

    Nginx -->|/api| REST
    Nginx -.->|/socket.io| WS

    REST --> Tenant
    REST --> MySQL
    REST --> ConnMgr
    WS --> ConnMgr
    Cron --> MySQL

    REST -->|crear pago / refund| Stripe
    REST -->|crear preferencia QR| MP
    REST -->|enviar correos| SES
    REST -->|subir/leer imágenes| S3
    REST -->|publicar eventos| SQS

    Stripe -.->|webhook firmado| REST
    MP -.->|webhook| REST
    SQS -.->|mensajes| REST

    WS ==>|payment_confirmed<br/>order_created / updated| Staff
    WS ==>|payment_confirmed / failed| Public

    classDef tp fill:#fef3c7,stroke:#d97706,color:#000;
    classDef be fill:#dbeafe,stroke:#2563eb,color:#000;
    classDef db fill:#dcfce7,stroke:#16a34a,color:#000;
    class Stripe,MP,SES,S3,SQS tp;
    class REST,WS,Cron,ConnMgr,Tenant be;
    class MySQL db;
```

**Leyenda de flechas:**
- `——>` línea sólida: petición/llamada síncrona (HTTP/SDK).
- `-.->` línea punteada: comunicación asíncrona o entrante (WebSocket, webhook, cola).
- `==>` línea gruesa: eventos *push* del servidor a los clientes vía WebSocket.

---

## Diagrama 2 — Flujo de pago con WebSockets y APIs de terceros

Secuencia de un pago de orden por QR (Mercado Pago) y por tarjeta (Stripe),
mostrando cómo el cliente recibe la confirmación en tiempo real vía Socket.IO.

```mermaid
sequenceDiagram
    autonumber
    actor Cliente as Cliente (navegador)
    participant FE as Frontend (React)
    participant API as Restify API (REST)
    participant WS as WebSocket Server (Socket.IO)
    participant DB as MySQL (Prisma)
    participant MP as Mercado Pago API
    participant Stripe as Stripe API

    Note over Cliente,Stripe: 1) Apertura de sesión de pago + canal WebSocket

    Cliente->>FE: Selecciona "Pagar"
    FE->>WS: connect + register_connection<br/>(connectionId, paymentId, token?)
    WS->>DB: Valida PaymentSession / usuario
    WS-->>FE: connection_ack

    alt Pago con QR (Mercado Pago)
        FE->>API: POST /payments/qr (orderId)
        API->>MP: Crear preferencia (QR)
        MP-->>API: init_point + QR (expira en 5 min)
        API->>DB: Guarda PaymentSession (pending)
        API-->>FE: QR + paymentId
        FE-->>Cliente: Muestra QR
        Cliente->>MP: Escanea y paga (app MP)
        MP-->>API: Webhook de pago
        API->>MP: Consulta estado del pago
        API->>DB: Actualiza pago = confirmed
    else Pago con tarjeta (Stripe)
        FE->>API: POST /payments/card (orderId)
        API->>Stripe: Crea PaymentIntent
        Stripe-->>API: clientSecret
        API-->>FE: clientSecret
        FE->>Stripe: Confirma pago (Stripe.js)
        Stripe-->>API: Webhook firmado (constructEvent)
        API->>DB: Actualiza pago = confirmed
    end

    Note over API,WS: 2) Notificación en tiempo real

    API->>WS: Emitir payment_confirmed (paymentId)
    WS-->>FE: payment_confirmed
    FE-->>Cliente: ✅ Pago confirmado
    WS-->>FE: order_updated (staff)
```

### Eventos WebSocket que emite el servidor

| Evento              | Descripción                                   |
| ------------------- | --------------------------------------------- |
| `connection_ack`    | Confirma registro de la conexión              |
| `payment_confirmed` | Pago aprobado                                 |
| `payment_failed`    | Pago rechazado                                |
| `payment_pending`   | Pago pendiente de confirmación                |
| `order_created`     | Nueva orden creada                            |
| `order_updated`     | Orden modificada                              |
| `order_delivered`   | Orden entregada                               |
| `order_canceled`    | Orden cancelada                               |
| `order_new_online`  | Nueva orden online (notifica al staff)        |
| `error`             | Error de validación / autenticación           |

---

## Notas de integración

- **Multi-tenancy:** cada petición resuelve su `Tenant Context`; los datos se aíslan por organización/sucursal (branch).
- **Webhooks de pago:** Stripe valida la firma del webhook (`webhooks.constructEvent`) y su endpoint usa `express.raw`. El webhook de Mercado Pago tiene la validación de firma desactivada por un bug conocido de MP (decisión consciente, no un descuido de seguridad).
- **QR Mercado Pago:** las sesiones de pago por QR expiran en **5 minutos**.
- **Servicios apagables:** `EMAIL_ENABLED` (SES) y `S3_ENABLED` (S3/MinIO) permiten correr en dev/test sin credenciales; cuando están en `false` solo loggean.
- **Colas SQS:** se usan para desacoplar notificaciones de pagos y de órdenes.
- **Cron jobs:** controlados por `RUN_CRONS`; incluyen limpieza de usuarios no verificados.
