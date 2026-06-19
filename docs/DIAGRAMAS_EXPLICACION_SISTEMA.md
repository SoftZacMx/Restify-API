# Restify — Explicación del sistema en 3 diagramas

> Documento pensado para explicar el proyecto **de forma simple y rápida**.
> Contiene una **vista panorámica (overview)** + 3 vistas de detalle: **Arquitectura**, **Funcionamiento** y **Entidades + Tecnologías**.

**Restify** es una API multi-tenant (multi-empresa) para restaurantes: maneja órdenes,
menú, inventario/stock, pagos (MercadoPago QR y Stripe), suscripciones, sucursales y
reportes. Cada organización vive aislada del resto.

---

## 0) Vista panorámica (Overview tipo "mapa") 🗺️

Un solo lienzo con **actores → canales → proceso interno → datos → integraciones**,
para entender todo el sistema de un vistazo (estilo board de Miro).

```mermaid
flowchart LR
    %% ===================== ACTORES =====================
    subgraph ACTORES["👥 ACTORES"]
        direction TB
        A1["🍽️ Comensal<br/><i>escanea QR / ordena</i>"]
        A2["🧑‍💼 Staff<br/><i>OWNER · ADMIN · MESERO · CHEF</i>"]
        A3["🏢 Dueño de negocio<br/><i>se registra · paga plan</i>"]
        A4["⚙️ Sistemas externos<br/><i>webhooks de pago</i>"]
    end

    %% ===================== CANALES =====================
    subgraph CANALES["🌐 CANALES DE ENTRADA"]
        direction TB
        C1["📱 App / Frontend"]
        C2["🔓 API Pública<br/><i>menú · orden · tracking</i>"]
        C3["🔔 Webhooks<br/><i>MercadoPago · Stripe</i>"]
        C4["⚡ WebSocket<br/><i>tiempo real</i>"]
    end

    %% ===================== PLATAFORMA =====================
    subgraph PLATAFORMA["🧩 RESTIFY API · TypeScript + Express (Clean / Hexagonal · Multi-tenant)"]
        direction TB
        SEC["🛡️ Borde de seguridad<br/>JWT · Helmet · CORS · RateLimit · Zod"]
        TEN["🏠 Tenant Context<br/><i>AsyncLocalStorage: org + branch</i>"]
        subgraph DOMINIOS["📦 Dominios de negocio (Use-Cases)"]
            direction LR
            D1["🛒 Órdenes"]
            D2["💳 Pagos"]
            D3["📋 Menú & Recetas"]
            D4["📦 Inventario / Stock"]
            D5["🪑 Mesas"]
            D6["💵 Gastos"]
            D7["🏬 Sucursales"]
            D8["🔑 Auth & Org"]
            D9["⭐ Suscripciones"]
            D10["📊 Reportes"]
        end
        DI{{"tsyringe · Inyección de dependencias"}}
    end

    %% ===================== DATOS =====================
    subgraph DATOS["🗄️ DATOS"]
        direction TB
        DB[("MySQL 8<br/>via Prisma ORM")]
        LEDGER["📒 Ledger de Stock<br/><i>inmutable</i>"]
    end

    %% ===================== INTEGRACIONES =====================
    subgraph INTEGRACIONES["☁️ INTEGRACIONES"]
        direction TB
        I1["💳 MercadoPago<br/><i>QR</i>"]
        I2["⭐ Stripe<br/><i>tarjetas + suscripción</i>"]
        I3["🪣 AWS S3<br/><i>imágenes</i>"]
        I4["📧 AWS SES<br/><i>email</i>"]
        I5["📨 SQS · EventBridge"]
        I6["⏰ node-cron"]
    end

    %% ===================== FLUJOS =====================
    A1 --> C1 & C2
    A2 --> C1
    A3 --> C1
    A4 --> C3
    C1 & C2 & C3 --> SEC
    C4 -. push .- TEN
    SEC --> TEN --> DOMINIOS
    DI -. inyecta .-> DOMINIOS

    D1 & D2 & D3 & D4 & D5 & D6 & D7 & D8 & D9 & D10 --> DB
    D4 --> LEDGER
    D2 --> I1 & I2
    D9 --> I2
    D3 --> I3
    D8 --> I4
    D1 -. eventos .-> I5
    I6 -. limpieza / jobs .-> DOMINIOS
    D1 & D2 -. notifica .-> C4

    %% ===================== ESTILOS =====================
    classDef actor fill:#ede9fe,stroke:#7c3aed,color:#4c1d95,font-weight:bold
    classDef canal fill:#dbeafe,stroke:#2563eb,color:#1e3a8a
    classDef plat fill:#dcfce7,stroke:#16a34a,color:#14532d
    classDef dom fill:#bbf7d0,stroke:#15803d,color:#14532d
    classDef datos fill:#fef9c3,stroke:#ca8a04,color:#713f12
    classDef integ fill:#fee2e2,stroke:#dc2626,color:#7f1d1d
    classDef infra fill:#e0f2fe,stroke:#0284c7,color:#075985

    class A1,A2,A3,A4 actor
    class C1,C2,C3,C4 canal
    class SEC,TEN plat
    class D1,D2,D3,D4,D5,D6,D7,D8,D9,D10 dom
    class DB,LEDGER datos
    class I1,I2,I3,I4,I5,I6 integ
    class DI infra
```

**Cómo leerlo (izquierda → derecha):** los **actores** entran por distintos **canales** →
toda petición cruza el **borde de seguridad** y se resuelve el **tenant** (qué organización/sucursal) →
se ejecuta el **dominio de negocio** correspondiente → se persiste en **MySQL** y/o se llama a una
**integración externa** (pago, email, storage). Los eventos en **tiempo real** vuelven al cliente por **WebSocket**.

---

### 📌 Versión para importar en Miro (Mermaid simplificado)

> **Cómo usarla:** en Miro → herramienta **Diagrams** → **Mermaid / "Diagram as code"** → pega este bloque → **Create**.
> Es la misma vista panorámica pero **saneada para el importador de Miro**: sin `classDef`/colores,
> sin `direction` en subgraphs y sin flechas encadenadas con `&` (Miro no las procesa).
> Los colores por zona los aplicas en Miro seleccionando cada grupo.

```mermaid
flowchart LR
    %% ACTORES
    subgraph ACTORES["👥 ACTORES"]
        A1["🍽️ Comensal<br/>escanea QR / ordena"]
        A2["🧑‍💼 Staff<br/>OWNER · ADMIN · MESERO · CHEF"]
        A3["🏢 Dueño de negocio<br/>se registra / paga plan"]
        A4["⚙️ Sistemas externos<br/>webhooks de pago"]
    end

    %% CANALES
    subgraph CANALES["🌐 CANALES DE ENTRADA"]
        C1["📱 App / Frontend"]
        C2["🔓 API Pública<br/>menú · orden · tracking"]
        C3["🔔 Webhooks<br/>MercadoPago · Stripe"]
        C4["⚡ WebSocket<br/>tiempo real"]
    end

    %% PLATAFORMA
    subgraph PLATAFORMA["🧩 RESTIFY API · TypeScript + Express · Multi-tenant"]
        SEC["🛡️ Borde de seguridad<br/>JWT · Helmet · CORS · RateLimit · Zod"]
        TEN["🏠 Tenant Context<br/>AsyncLocalStorage: org + branch"]
        DI["tsyringe<br/>Inyección de dependencias"]
        subgraph DOMINIOS["📦 Dominios de negocio"]
            D1["🛒 Órdenes"]
            D2["💳 Pagos"]
            D3["📋 Menú & Recetas"]
            D4["📦 Inventario / Stock"]
            D5["🪑 Mesas"]
            D6["💵 Gastos"]
            D7["🏬 Sucursales"]
            D8["🔑 Auth & Org"]
            D9["⭐ Suscripciones"]
            D10["📊 Reportes"]
        end
    end

    %% DATOS
    subgraph DATOS["🗄️ DATOS"]
        DB["MySQL 8 · Prisma ORM"]
        LEDGER["📒 Ledger de Stock (inmutable)"]
    end

    %% INTEGRACIONES
    subgraph INTEGRACIONES["☁️ INTEGRACIONES"]
        I1["💳 MercadoPago QR"]
        I2["⭐ Stripe"]
        I3["🪣 AWS S3"]
        I4["📧 AWS SES"]
        I5["📨 SQS / EventBridge"]
        I6["⏰ node-cron"]
    end

    %% FLUJOS (una flecha por línea)
    A1 --> C1
    A1 --> C2
    A2 --> C1
    A3 --> C1
    A4 --> C3
    C1 --> SEC
    C2 --> SEC
    C3 --> SEC
    SEC --> TEN
    TEN --> DOMINIOS
    DI --> DOMINIOS
    DOMINIOS --> DB
    D4 --> LEDGER
    D2 --> I1
    D2 --> I2
    D9 --> I2
    D3 --> I3
    D8 --> I4
    D1 --> I5
    I6 --> DOMINIOS
    D1 --> C4
    D2 --> C4
    C4 --> A1
```

---

## 1) Arquitectura — Clean / Hexagonal por capas

Cómo está organizado el código y cómo viaja una petición HTTP hasta la base de datos.

```mermaid
flowchart TB
    Client["📱 Cliente / Frontend / Webhooks"]

    subgraph Presentation["🟦 Presentación (server/)"]
        Routes["Routes (Express)"]
        MW["Middlewares<br/>Auth (JWT) · Tenant (AsyncLocalStorage) · Zod · RateLimit · Helmet"]
        Controllers["Controllers"]
    end

    subgraph Application["🟩 Aplicación (core/application/)"]
        UseCases["Use-Cases<br/>(orquestan el flujo de negocio)"]
        Services["Services<br/>Stock · PaymentConfig · BranchLimit · Bootstrap"]
        DTO["DTOs / Mappers (Zod)"]
    end

    subgraph Domain["🟨 Dominio (core/domain/)"]
        Entities["Entities (reglas de negocio)"]
        Interfaces["Interfaces<br/>(contratos: IOrderRepository, IPaymentRepository...)"]
    end

    subgraph Infra["🟥 Infraestructura (core/infrastructure/)"]
        Repos["Repositories (Prisma)"]
        Gateways["Payment Gateways<br/>MercadoPago · Stripe"]
        AWS["AWS<br/>S3 · SES · SQS · EventBridge · Secrets"]
        RT["WebSockets (Socket.IO) · Cron"]
    end

    DB[("🗄️ MySQL")]
    DI{{"tsyringe<br/>(Inyección de dependencias)"}}

    Client --> Routes --> MW --> Controllers --> UseCases
    UseCases --> Services
    UseCases --> Interfaces
    Services --> Interfaces
    Interfaces -. implementadas por .-> Repos
    UseCases --> Gateways
    UseCases --> AWS
    Repos --> DB
    Domain -.-> Application
    DI -. inyecta .-> Application
    DI -. inyecta .-> Infra

    classDef pres fill:#dbeafe,stroke:#2563eb,color:#1e3a8a
    classDef app fill:#dcfce7,stroke:#16a34a,color:#14532d
    classDef dom fill:#fef9c3,stroke:#ca8a04,color:#713f12
    classDef inf fill:#fee2e2,stroke:#dc2626,color:#7f1d1d
    class Routes,MW,Controllers pres
    class UseCases,Services,DTO app
    class Entities,Interfaces dom
    class Repos,Gateways,AWS,RT inf
```

**Idea clave:** las dependencias apuntan **hacia adentro**. El dominio define *interfaces*
(contratos) y la infraestructura las *implementa*. `tsyringe` conecta todo por inyección
de dependencias. El **aislamiento multi-tenant** se logra con `AsyncLocalStorage`: el JWT
trae el `org`, el `TenantMiddleware` lo guarda en contexto y los repositorios filtran
automáticamente por `organizationId` / `branchId`.

---

## 2) Funcionamiento — Flujo de un pago con QR de MercadoPago

El flujo más representativo del sistema: crear una orden, cobrarla con QR y confirmarla
vía webhook (aplica igual para órdenes públicas, sin login).

```mermaid
sequenceDiagram
    autonumber
    actor U as Cliente
    participant API as Restify API
    participant TC as Tenant Context
    participant DB as MySQL (Prisma)
    participant MP as MercadoPago
    participant WS as WebSocket

    U->>API: POST /orders (crear orden)
    API->>TC: Resuelve tenant (org + branch desde JWT)
    API->>DB: $transaction → Order + OrderItems + descuento de Stock
    DB-->>API: Orden creada (status = no pagada)

    U->>API: POST /payments/qr-mercado-pago
    API->>MP: Crear preferencia (QR, expira 5 min)
    MP-->>API: QR + preferenceId
    API-->>U: Muestra QR

    U->>MP: Escanea y paga 💳
    MP->>API: Webhook (notification con branchId)
    API->>TC: runWithTenant(org, branch)
    API->>MP: Consulta estado real del pago
    API->>DB: Actualiza Payment + Order (pagada) · libera mesa
    API->>DB: Registra comisión MP como Expense
    API->>WS: Notifica en tiempo real (orden pagada)
    WS-->>U: ✅ Pago confirmado
```

**Otros flujos clave (misma lógica de capas):**
- **Signup:** crea Organization (plan FREE) → Subscription → primer Branch → Usuario OWNER, todo en una transacción (`withoutTenant`).
- **Suscripciones:** checkout con Stripe → webhook activa el plan → habilita más sucursales.
- **Stock:** cada venta descuenta inventario por receta o producto directo; movimientos quedan en un ledger inmutable (`StockMovement`).

---

## 3) Entidades y Tecnologías

### 3a) Modelo de datos (entidades principales)

```mermaid
erDiagram
    Organization ||--o{ Branch : tiene
    Organization ||--o{ User : tiene
    Organization ||--|| Subscription : tiene
    Subscription }o--|| SubscriptionPlan : usa
    User }o--o{ Branch : "acceso (UserBranchAccess)"

    Branch ||--o{ Order : registra
    Branch ||--o{ Product : inventario
    Branch ||--o{ MenuItem : menú
    Branch ||--o{ MenuCategory : categorías
    Branch ||--o{ Table : mesas
    Branch ||--o{ Expense : gastos

    Order ||--o{ OrderItem : contiene
    OrderItem ||--o{ OrderItemExtra : extras
    Order ||--o{ Payment : pagos
    Payment ||--o{ Refund : reembolsos

    MenuItem ||--o{ MenuItemIngredient : "receta"
    MenuItem }o--o| Product : "link directo"
    Product ||--o{ StockMovement : "ledger (inmutable)"
    Product ||--o{ MenuItemIngredient : ingrediente

    Expense ||--o{ ExpenseItem : items
```

| Entidad | Rol en el sistema |
|---|---|
| **Organization** | Raíz multi-tenant (plan: FREE/PRO/ENTERPRISE) |
| **Subscription / SubscriptionPlan** | Facturación vía Stripe |
| **Branch** | Sucursal (horarios, moneda, config de pagos) |
| **User** | Usuario con rol (OWNER/ADMIN/MANAGER/WAITER/CHEF) |
| **Order / OrderItem / OrderItemExtra** | Órdenes y su detalle |
| **Payment / Refund** | Pagos y reembolsos (estados y gateway) |
| **Product / StockMovement** | Inventario y bitácora de movimientos |
| **MenuItem / MenuCategory / MenuItemIngredient** | Menú y recetas |
| **Table** | Mesas y su disponibilidad |
| **Expense / ExpenseItem** | Gastos (incluye comisión MercadoPago) |

### 3b) Stack tecnológico

```mermaid
flowchart LR
    subgraph Core["🧩 Núcleo"]
        TS["TypeScript"]
        Node["Node.js 20"]
        Exp["Express 4"]
        TSY["tsyringe (DI)"]
        Zod["Zod (validación)"]
    end
    subgraph Data["🗄️ Datos"]
        Prisma["Prisma ORM"]
        MySQL["MySQL 8"]
    end
    subgraph Pay["💳 Pagos"]
        MP["MercadoPago (QR)"]
        Stripe["Stripe (tarjetas + suscripciones)"]
    end
    subgraph AWS["☁️ AWS"]
        S3["S3 (imágenes)"]
        SES["SES (email)"]
        SQS["SQS (colas)"]
        EB["EventBridge"]
        SM["Secrets Manager"]
    end
    subgraph Cross["🔧 Transversal"]
        JWT["JWT + bcrypt"]
        Helmet["Helmet + CORS + RateLimit"]
        SIO["Socket.IO (tiempo real)"]
        Cron["node-cron"]
        Pino["Pino (logs)"]
    end
    subgraph DevOps["🚀 DevOps / Calidad"]
        Jest["Jest + Supertest"]
        ESLint["ESLint + Prettier"]
        Docker["Docker"]
        Dokploy["Railway / Dokploy"]
    end

    Core --> Data
    Core --> Pay
    Core --> AWS
    Core --> Cross
    Core --> DevOps
```

---

### Resumen en una frase
> **Restify** es una API en **TypeScript + Express** con **arquitectura limpia/hexagonal**,
> **multi-tenant** (aislamiento por organización/sucursal con `AsyncLocalStorage`),
> persistida en **MySQL vía Prisma**, con pagos **MercadoPago/Stripe**, servicios **AWS**,
> tiempo real con **Socket.IO** y desplegada con **Docker** en **Railway/Dokploy**.
