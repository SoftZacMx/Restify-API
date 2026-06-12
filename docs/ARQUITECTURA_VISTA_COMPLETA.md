# Restify — Vista Completa del Sistema

Un solo diagrama que muestra **todo el concepto del proyecto** en una vista:
los actores, el frontend, el backend con sus piezas internas, la base de datos,
la comunicación en tiempo real y todas las integraciones externas.
Sintaxis [Mermaid](https://mermaid.js.org/).

```mermaid
graph TB
    %% ===== ACTORES =====
    subgraph Actores["👥 Actores"]
        Staff["👨‍🍳 Personal<br/>(admin / mesero / cocina)"]
        Cliente["🙋 Cliente<br/>(menú QR en la mesa)"]
    end

    %% ===== FRONTEND =====
    subgraph Frontend["📱 Frontend — React + Vite"]
        UI["Pantallas:<br/>Menú · Órdenes · Mesas<br/>Pagos · Reportes · Config"]
    end

    %% ===== BACKEND =====
    subgraph Backend["⚙️ Backend — Node.js + Express"]
        REST["🔵 API REST<br/>(/api/*)"]
        WS["🟢 Tiempo Real<br/>(Socket.IO)"]
        Logic["🧩 Lógica de negocio<br/>(use cases + multi-tenant)"]
        Cron["⏰ Tareas programadas<br/>(cron jobs)"]
    end

    %% ===== DATOS =====
    DB[("🗄️ MySQL<br/>Base de datos")]

    %% ===== SERVICIOS EXTERNOS =====
    subgraph Externos["🔌 Servicios Externos"]
        Stripe["💳 Stripe<br/>tarjeta + suscripciones"]
        MP["💳 Mercado Pago<br/>pago con QR"]
        SES["📧 AWS SES<br/>emails"]
        S3["🖼️ AWS S3 / MinIO<br/>imágenes"]
        SQS["📬 AWS SQS<br/>colas de notificaciones"]
    end

    %% ===== CONEXIONES =====
    Staff --> UI
    Cliente --> UI

    UI -->|"pide / envía datos (HTTPS)"| REST
    REST -->|"responde"| UI
    WS -.->|"avisos al instante<br/>(pago confirmado, nueva orden)"| UI

    REST --> Logic
    WS --> Logic
    Logic --> DB
    Cron --> DB

    Logic -->|cobra tarjeta / suscripción| Stripe
    Logic -->|cobra con QR| MP
    Logic -->|envía correos| SES
    Logic -->|guarda imágenes| S3
    Logic -->|publica eventos| SQS

    Stripe -.->|webhook: pago ok| REST
    MP -.->|webhook: pago ok| REST
    SQS -.->|mensajes| Logic

    %% ===== ESTILOS =====
    classDef person fill:#e0e7ff,stroke:#4f46e5,color:#000;
    classDef front fill:#dbeafe,stroke:#2563eb,color:#000;
    classDef back fill:#dcfce7,stroke:#16a34a,color:#000;
    classDef data fill:#fae8ff,stroke:#a21caf,color:#000;
    classDef ext fill:#fef3c7,stroke:#d97706,color:#000;

    class Staff,Cliente person;
    class UI front;
    class REST,WS,Logic,Cron back;
    class DB data;
    class Stripe,MP,SES,S3,SQS ext;
```

---

## Cómo leer el diagrama

| Color        | Qué representa                                              |
| ------------ | ---------------------------------------------------------- |
| 🟣 Morado    | **Actores** — las personas que usan el sistema             |
| 🔵 Azul      | **Frontend** — la app que ven los usuarios                 |
| 🟢 Verde     | **Backend** — el cerebro del sistema y su lógica           |
| 🟪 Lila      | **Base de datos** — donde se guarda toda la información     |
| 🟡 Amarillo  | **Servicios externos** — APIs de terceros que se integran  |

**Tipos de flecha:**
- `——>` línea sólida → petición o llamada directa (alguien pide algo).
- `-.->` línea punteada → comunicación al instante o entrante (tiempo real, webhooks, colas).

## El concepto en una frase

> Los **usuarios** (personal y clientes) usan el **Frontend**, que se comunica con el
> **Backend**; el Backend guarda todo en **MySQL**, avisa al instante por **tiempo real**,
> y se apoya en **servicios externos** para cobrar (**Stripe** y **Mercado Pago**),
> enviar emails, guardar imágenes y procesar notificaciones.
