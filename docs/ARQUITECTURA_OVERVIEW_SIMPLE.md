# Restify — Vista General (Simple)

Diagramas pensados para una **vista general fácil de entender**: quién usa el
sistema, cómo habla el frontend con el backend y las dos pasarelas de pago
externas (**Mercado Pago** y **Stripe**). Sintaxis [Mermaid](https://mermaid.js.org/).

---

## Diagrama 1 — ¿Quién usa Restify y cómo se conecta todo?

```mermaid
graph LR
    Staff["👨‍🍳 Personal del<br/>restaurante"]
    Cliente["🙋 Cliente<br/>en la mesa"]

    App["📱 Restify App<br/>(Frontend)"]

    Server["⚙️ Restify<br/>(Backend)"]

    MP["💳 Mercado Pago<br/>(pago con QR)"]
    Stripe["💳 Stripe<br/>(pago con tarjeta)"]

    Staff -->|usa| App
    Cliente -->|usa| App

    App <-->|"pide y recibe<br/>información"| Server

    Server -->|cobra| MP
    Server -->|cobra| Stripe

    classDef person fill:#e0e7ff,stroke:#4f46e5,color:#000;
    classDef app fill:#dbeafe,stroke:#2563eb,color:#000;
    classDef pay fill:#fef3c7,stroke:#d97706,color:#000;
    class Staff,Cliente person;
    class App,Server app;
    class MP,Stripe pay;
```

**Idea clave:** las personas usan la **App**, la App habla con el **Backend**,
y el Backend es el único que se conecta con las pasarelas de pago externas.

---

## Diagrama 2 — Comunicación entre Frontend y Backend

```mermaid
graph LR
    subgraph Front["📱 Frontend"]
        UI["Pantallas<br/>(menú, órdenes, pagos)"]
    end

    subgraph Back["⚙️ Backend"]
        API["Recibe peticiones<br/>y responde"]
        RT["Avisos en<br/>tiempo real"]
    end

    UI -->|"1 · Pregunta<br/>(ver menú, crear orden, pagar)"| API
    API -->|"2 · Responde<br/>(datos, confirmación)"| UI
    RT -.->|"3 · Avisa al instante<br/>(¡pago confirmado!, nueva orden)"| UI

    classDef f fill:#dbeafe,stroke:#2563eb,color:#000;
    classDef b fill:#dcfce7,stroke:#16a34a,color:#000;
    class UI f;
    class API,RT b;
```

**Idea clave:** normalmente el Frontend **pregunta** y el Backend **responde**.
Además, el Backend puede **avisar al instante** (tiempo real) cuando algo pasa,
como un pago confirmado o una nueva orden.

---

## Diagrama 3 — El proceso de un pago, paso a paso

```mermaid
flowchart LR
    A["🙋 Cliente<br/>pide pagar"] --> B["📱 App<br/>muestra opciones"]
    B --> C{"¿Cómo paga?"}
    C -->|QR| D["💳 Mercado Pago"]
    C -->|Tarjeta| E["💳 Stripe"]
    D --> F["⚙️ Backend<br/>confirma el pago"]
    E --> F
    F --> G["✅ App avisa:<br/>¡Pago confirmado!"]

    classDef start fill:#e0e7ff,stroke:#4f46e5,color:#000;
    classDef pay fill:#fef3c7,stroke:#d97706,color:#000;
    classDef ok fill:#dcfce7,stroke:#16a34a,color:#000;
    class A start;
    class D,E pay;
    class G ok;
```

**Idea clave:** el cliente elige cómo pagar (QR o tarjeta), el pago pasa por la
pasarela externa, el Backend lo confirma y la App avisa al instante.

---

### Resumen en una frase

> Las personas usan la **App**, que habla con el **Backend**; cuando hay que
> cobrar, el Backend usa **Mercado Pago** (QR) o **Stripe** (tarjeta), y avisa
> al instante cuando el pago se confirma.
