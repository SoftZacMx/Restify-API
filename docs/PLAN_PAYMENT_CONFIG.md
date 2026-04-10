# Plan de Implementación — Configuración de Pagos desde UI

> **Fecha:** 2026-04-09
> **Proyecto:** Restify (Backend + Frontend)
> **Objetivo:** Mover las credenciales de Mercado Pago (pagos del tenant) de variables de entorno a la base de datos, encriptadas con AES, y gestionables desde la UI de Settings.

---

## Contexto Actual

- Las credenciales de Mercado Pago (`MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`, `MP_BACK_URL`, `MP_NOTIFICATION_URL`) se leen de `process.env`.
- El servicio `MercadoPagoService` lee las keys en el constructor y las cachea.
- No hay forma de cambiar keys sin redeploy.
- El modelo `Company` ya tiene un campo JSON (`ticketConfig`) como precedente.

### Qué NO se migra

Las credenciales de **Stripe para suscripciones** (`STRIPE_SECRET_KEY`, `STRIPE_SUBSCRIPTION_WEBHOOK_SECRET`) se quedan en `.env`. Estas son del operador del SaaS (nosotros), no del tenant. El tenant nunca las toca.

---

## Diseño

### Columna `paymentConfig` en `Company`

Una sola columna `String?` que almacena un JSON encriptado con AES-256-GCM. Al leer, se desencripta y se parsea. Al escribir, se serializa y se encripta.

```typescript
// Estructura del JSON desencriptado
interface PaymentConfig {
  mercadoPago: {
    accessToken: string;            // APP_USR-...
    webhookSecret: string;          // clave HMAC
    notificationUrl: string;        // https://...
    backUrl: string;                // https://miapp.com
  };
}
```

> **Nota:** Si en el futuro el tenant necesita Stripe para cobrar a sus clientes (pagos de órdenes), se agrega un bloque `stripe` al JSON sin necesidad de migración.

### Fallback a `process.env`

Si `paymentConfig` es `null` (no configurado aún), los servicios siguen leyendo de `process.env`. Esto permite migración gradual y no rompe nada existente.

---

## Fase 1 — Utilidad de Encriptación

### 1.1 Crear `CryptoUtil`

**Archivo:** `src/shared/utils/crypto.util.ts`

```typescript
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

/**
 * Encripta un string con AES-256-GCM.
 * Retorna: iv:tag:ciphertext (hex encoded).
 * La clave de encriptación se lee de PAYMENT_CONFIG_ENCRYPTION_KEY (env).
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
}

/**
 * Desencripta un string encriptado con encrypt().
 */
export function decrypt(encrypted: string): string {
  const key = getEncryptionKey();
  const [ivHex, tagHex, ciphertext] = encrypted.split(':');

  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

function getEncryptionKey(): Buffer {
  const key = process.env.PAYMENT_CONFIG_ENCRYPTION_KEY;
  if (!key || key.length !== 64) {
    throw new Error(
      'PAYMENT_CONFIG_ENCRYPTION_KEY must be a 64-char hex string (32 bytes). ' +
      'Generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }
  return Buffer.from(key, 'hex');
}
```

### 1.2 Agregar `PAYMENT_CONFIG_ENCRYPTION_KEY` al env

**Archivo:** `src/server/config/env.config.ts`

```typescript
// Agregar al schema de zod:
PAYMENT_CONFIG_ENCRYPTION_KEY: z.string().length(64, 'Must be 64-char hex (32 bytes)'),
```

### Checklist Fase 1

- [ ] Crear `CryptoUtil` con `encrypt()` y `decrypt()`.
- [ ] Agregar `PAYMENT_CONFIG_ENCRYPTION_KEY` al env schema.
- [ ] Generar la key y agregarla al `.env` / `.env.example`.
- [ ] Tests unitarios para encrypt/decrypt (round-trip).

---

## Fase 2 — Modelo de Datos

### 2.1 Agregar columna `paymentConfig` en `Company`

**Archivo:** `schema.prisma`

```prisma
model Company {
  // ... campos existentes ...
  paymentConfig  String?   // JSON encriptado con AES-256-GCM

  @@map("companies")
}
```

### 2.2 Actualizar entidad `Company`

**Archivo:** `src/core/domain/entities/company.entity.ts`

Agregar campo `paymentConfig: string | null` al constructor.

### 2.3 Actualizar interfaces del repositorio

**Archivo:** `src/core/domain/interfaces/company-repository.interface.ts`

Agregar `paymentConfig?: string | null` a los tipos de create/update.

### 2.4 Actualizar implementación del repositorio

**Archivo:** `src/core/infrastructure/database/repositories/company.repository.ts`

Mapear `paymentConfig` en `toEntity()`, `create()` y `update()`.

### 2.5 Generar migración

```bash
npx prisma db push
```

### Checklist Fase 2

- [ ] Agregar columna `paymentConfig` al schema de Prisma.
- [ ] Actualizar entidad `Company`.
- [ ] Actualizar interfaz y repositorio.
- [ ] Sincronizar BD.

---

## Fase 3 — Capa de Dominio

### 3.1 Crear tipo `PaymentConfig`

**Archivo:** `src/core/domain/types/payment-config.types.ts`

```typescript
export interface MercadoPagoConfig {
  accessToken: string;
  webhookSecret: string;
  notificationUrl: string;
  backUrl: string;
}

export interface PaymentConfig {
  mercadoPago: MercadoPagoConfig;
}
```

### Checklist Fase 3

- [ ] Crear types de `PaymentConfig`.

---

## Fase 4 — Servicio de Configuración de Pagos

### 4.1 Crear `PaymentConfigService`

**Archivo:** `src/core/application/services/payment-config.service.ts`

```typescript
import { inject, injectable } from 'tsyringe';
import { ICompanyRepository } from '../../domain/interfaces/company-repository.interface';
import { PaymentConfig } from '../../domain/types/payment-config.types';
import { encrypt, decrypt } from '../../../shared/utils/crypto.util';

@injectable()
export class PaymentConfigService {
  private cache: PaymentConfig | null = null;

  constructor(
    @inject('ICompanyRepository') private readonly companyRepository: ICompanyRepository
  ) {}

  /**
   * Lee la config de pagos. Usa cache en memoria para no desencriptar en cada request.
   * Fallback a process.env si no hay config en BD.
   */
  async get(): Promise<PaymentConfig> {
    if (this.cache) return this.cache;

    const company = await this.companyRepository.findFirst();
    if (company?.paymentConfig) {
      const json = decrypt(company.paymentConfig);
      this.cache = JSON.parse(json) as PaymentConfig;
      return this.cache;
    }

    // Fallback a process.env
    return this.getFromEnv();
  }

  /**
   * Guarda la config encriptada en la BD. Invalida el cache.
   */
  async save(config: PaymentConfig): Promise<void> {
    const company = await this.companyRepository.findFirst();
    if (!company) throw new Error('Company not found');

    const encrypted = encrypt(JSON.stringify(config));
    await this.companyRepository.update(company.id, { paymentConfig: encrypted });
    this.cache = config;
  }

  /** Invalida el cache (útil para tests o recarga forzada). */
  clearCache(): void {
    this.cache = null;
  }

  private getFromEnv(): PaymentConfig {
    return {
      mercadoPago: {
        accessToken: process.env.MP_ACCESS_TOKEN || '',
        webhookSecret: process.env.MP_WEBHOOK_SECRET || '',
        notificationUrl: process.env.MP_NOTIFICATION_URL || '',
        backUrl: process.env.MP_BACK_URL || '',
      },
    };
  }
}
```

### 4.2 Registrar en DI

**Archivo:** `src/core/infrastructure/config/dependency-injection/company.module.ts`

```typescript
import { PaymentConfigService } from '../../../application/services/payment-config.service';

container.registerSingleton(PaymentConfigService);
```

### Checklist Fase 4

- [ ] Crear `PaymentConfigService` con get/save/cache/fallback.
- [ ] Registrar como singleton en DI.
- [ ] Tests unitarios para get (desde BD), get (fallback env), save, cache.

---

## Fase 5 — Migrar `MercadoPagoService`

> **Nota:** `StripeService` y `StripeSubscriptionService` NO se migran. Siguen leyendo de `process.env` porque las keys de Stripe para suscripciones son del operador del SaaS, no del tenant.

### 5.1 Modificar `MercadoPagoService`

**Archivo:** `src/core/infrastructure/payment-gateways/mercado-pago.service.ts`

Cambiar el constructor para inicialización lazy desde `PaymentConfigService`. `createPreference` lee `backUrl` y `notificationUrl` de la config. `validateWebhookSignature` lee `webhookSecret` de la config.

```typescript
@injectable()
export class MercadoPagoService {
  private client: MercadoPagoConfig | null = null;
  private preference: Preference | null = null;
  private paymentClient: PaymentMP | null = null;

  constructor(
    @inject(PaymentConfigService) private readonly paymentConfigService: PaymentConfigService
  ) {}

  private async initClient(): Promise<void> {
    if (this.client) return;
    const config = await this.paymentConfigService.get();
    if (!config.mercadoPago.accessToken) {
      throw new AppError('PAYMENT_CONFIG_NOT_CONFIGURED', 'Mercado Pago access token no configurado');
    }
    this.client = new MercadoPagoConfig({ accessToken: config.mercadoPago.accessToken });
    this.preference = new Preference(this.client);
    this.paymentClient = new PaymentMP(this.client);
  }

  async createPreference(params: CreateMPPreferenceParams): Promise<MPPreferenceResult> {
    await this.initClient();
    const config = await this.paymentConfigService.get();
    const backUrl = config.mercadoPago.backUrl || 'https://restify.app';

    const preference = await this.preference!.create({
      body: {
        // ... items, metadata, external_reference ...
        notification_url: params.notificationUrl,
        back_urls: {
          success: `${backUrl}/payment/success`,
          failure: `${backUrl}/payment/failure?status=failure`,
          pending: `${backUrl}/payment/pending?status=pending`,
        },
        // ...
      },
    });
    // ...
  }

  async validateWebhookSignature(params: ValidateWebhookParams): Promise<boolean> {
    const config = await this.paymentConfigService.get();
    const secret = config.mercadoPago.webhookSecret;
    if (!secret) {
      throw new AppError('PAYMENT_CONFIG_NOT_CONFIGURED', 'Mercado Pago webhook secret no configurado');
    }
    // ... HMAC validation con secret ...
  }
}
```

### 5.2 Agregar error code

**Archivo:** `src/shared/errors/error-config.ts`

```typescript
PAYMENT_CONFIG_NOT_CONFIGURED: {
  message: 'La configuración de pagos no está completa',
  statusCode: 500,
  category: 'SYSTEM',
},
```

### 5.3 Actualizar env.config.ts

Hacer las keys de MP opcionales (ya no son obligatorias al arrancar porque pueden vivir en BD).

```typescript
// Cambiar de:
MP_ACCESS_TOKEN: z.string({ required_error: 'MP_ACCESS_TOKEN is required' }),

// A:
MP_ACCESS_TOKEN: z.string().optional(),
```

> **Nota:** `STRIPE_SECRET_KEY` sigue como `required` — es del SaaS.

### 5.4 Actualizar `validateWebhookSignature` a async

`validateWebhookSignature` pasa de síncrono a `async` porque necesita leer la config de BD. Actualizar los use cases y controllers que lo llaman para usar `await`.

### Checklist Fase 5

- [ ] Modificar `MercadoPagoService` para usar `PaymentConfigService`.
- [ ] Agregar error code `PAYMENT_CONFIG_NOT_CONFIGURED`.
- [ ] Hacer `MP_ACCESS_TOKEN` opcional en env config.
- [ ] `validateWebhookSignature` pasa a ser `async`.
- [ ] Actualizar use cases y controllers que llaman métodos ahora async.
- [ ] Actualizar tests de `MercadoPagoService`.

---

## Fase 6 — Casos de Uso (Backend)

### 6.1 Crear `GetPaymentConfigUseCase`

**Archivo:** `src/core/application/use-cases/settings/get-payment-config.use-case.ts`

```typescript
@injectable()
export class GetPaymentConfigUseCase {
  constructor(
    @inject(PaymentConfigService) private readonly paymentConfigService: PaymentConfigService
  ) {}

  async execute(): Promise<MaskedPaymentConfig> {
    const config = await this.paymentConfigService.get();
    return {
      mercadoPago: {
        accessToken: maskKey(config.mercadoPago.accessToken),
        webhookSecret: maskKey(config.mercadoPago.webhookSecret),
        notificationUrl: config.mercadoPago.notificationUrl,
        backUrl: config.mercadoPago.backUrl,
      },
      isConfigured: !!config.mercadoPago.accessToken,
    };
  }
}

// Muestra solo los últimos 4 caracteres: "sk_live_...abc1234" → "••••abc1234"
function maskKey(key: string): string {
  if (!key || key.length < 8) return key ? '••••' : '';
  return '••••' + key.slice(-8);
}
```

### 6.2 Crear `SavePaymentConfigUseCase`

**Archivo:** `src/core/application/use-cases/settings/save-payment-config.use-case.ts`

```typescript
@injectable()
export class SavePaymentConfigUseCase {
  constructor(
    @inject(PaymentConfigService) private readonly paymentConfigService: PaymentConfigService
  ) {}

  async execute(input: SavePaymentConfigInput): Promise<void> {
    // Leer config actual para merge parcial (el usuario puede enviar solo stripe o solo MP)
    const current = await this.paymentConfigService.get();

    const merged: PaymentConfig = {
      mercadoPago: {
        accessToken: input.mercadoPago?.accessToken ?? current.mercadoPago.accessToken,
        webhookSecret: input.mercadoPago?.webhookSecret ?? current.mercadoPago.webhookSecret,
        notificationUrl: input.mercadoPago?.notificationUrl ?? current.mercadoPago.notificationUrl,
        backUrl: input.mercadoPago?.backUrl ?? current.mercadoPago.backUrl,
      },
    };

    await this.paymentConfigService.save(merged);
  }
}
```

### Checklist Fase 6

- [ ] Crear `GetPaymentConfigUseCase` con enmascaramiento de keys.
- [ ] Crear `SavePaymentConfigUseCase` con merge parcial.
- [ ] Registrar en DI.
- [ ] Tests unitarios.

---

## Fase 7 — Controller y Rutas (Backend)

### 7.1 Crear controller

**Archivo:** `src/controllers/settings/payment-config.controller.ts`

```typescript
export const getPaymentConfigController = async (req, res, next) => {
  const useCase = container.resolve(GetPaymentConfigUseCase);
  const result = await useCase.execute();
  sendSuccess(res, result);
};

export const savePaymentConfigController = async (req, res, next) => {
  const useCase = container.resolve(SavePaymentConfigUseCase);
  await useCase.execute(req.body);
  sendSuccess(res, { message: 'Configuración de pagos actualizada' });
};
```

### 7.2 Agregar rutas

**Archivo:** `src/server/routes/settings.routes.ts`

```typescript
const router = Router();

router.use(AuthMiddleware.authenticate);
router.use(AuthMiddleware.authorize('ADMIN'));

router.get('/payment-config', getPaymentConfigController);
router.put('/payment-config', savePaymentConfigController);

export default router;
```

### 7.3 Registrar en `routes/index.ts`

```typescript
router.use('/api/settings', settingsRoutes);
```

> **Nota:** Esta ruta va DESPUÉS del `SubscriptionMiddleware` (requiere suscripción activa para acceder a settings).

### Checklist Fase 7

- [ ] Crear controllers de payment config.
- [ ] Crear archivo de rutas `settings.routes.ts`.
- [ ] Registrar `/api/settings` en routes index.
- [ ] Validar request body con zod.

---

## Fase 8 — Frontend

### 8.1 Agregar tipos

**Archivo (Frontend):** `src/domain/types/settings.types.ts`

```typescript
export interface MaskedPaymentConfig {
  mercadoPago: {
    accessToken: string;
    webhookSecret: string;
    notificationUrl: string;
    backUrl: string;
  };
  isConfigured: boolean;
}

export interface SavePaymentConfigRequest {
  mercadoPago?: {
    accessToken?: string;
    webhookSecret?: string;
    notificationUrl?: string;
    backUrl?: string;
  };
}
```

### 8.2 Repository y Service

**Archivo (Frontend):** `src/infrastructure/api/repositories/settings.repository.ts`

```typescript
export class SettingsRepository {
  async getPaymentConfig(): Promise<ApiResponse<MaskedPaymentConfig>> {
    const response = await apiClient.get('/api/settings/payment-config');
    return response.data;
  }

  async savePaymentConfig(data: SavePaymentConfigRequest): Promise<ApiResponse<{ message: string }>> {
    const response = await apiClient.put('/api/settings/payment-config', data);
    return response.data;
  }
}
```

### 8.3 Agregar sección en Settings

**Archivo (Frontend):** `src/presentation/components/layouts/SettingsLayout.tsx`

Agregar item al sidebar:

```typescript
{ id: 'payments', label: 'Pagos', path: '/settings/payments', icon: CreditCard },
```

### 8.4 Crear página de configuración de pagos

**Archivo (Frontend):** `src/presentation/pages/settings/payments/PaymentConfigPage.tsx`

- Formulario con sección Mercado Pago
- Inputs tipo `password` para keys sensibles (`accessToken`, `webhookSecret`) con toggle show/hide
- Inputs normales para URLs (`notificationUrl`, `backUrl`)
- Al cargar, muestra keys enmascaradas (`••••abc1234`)
- Al guardar, solo envía los campos que el usuario modificó
- Toast de éxito/error
- Badge "Configurado" / "Pendiente"

### 8.5 Agregar ruta

**Archivo (Frontend):** `src/App.tsx`

```typescript
const PaymentConfigPage = lazy(() => import('@/presentation/pages/settings/payments/PaymentConfigPage'));

// Dentro de /settings:
<Route path="payments" element={<PaymentConfigPage />} />
```

### Checklist Fase 8

- [ ] Crear tipos `MaskedPaymentConfig` y `SavePaymentConfigRequest`.
- [ ] Crear repository y service para payment config.
- [ ] Agregar "Pagos" al sidebar de Settings.
- [ ] Crear `PaymentConfigPage` con formulario.
- [ ] Agregar ruta `/settings/payments`.
- [ ] Agregar breadcrumb y título en `SettingsLayout`.

---

## Orden de Implementación

```
Fase 1 (CryptoUtil) → Encriptación AES
  │
  ├── Fase 2 (Modelo) → Columna paymentConfig en Company
  │
  ├── Fase 3 (Dominio) → Types de PaymentConfig
  │
  ├── Fase 4 (Servicio) → PaymentConfigService con cache + fallback
  │
  ├── Fase 5 (Migrar servicios) → Stripe, MP leen de PaymentConfigService
  │
  ├── Fase 6 (Use cases) → Get/Save con enmascaramiento
  │
  ├── Fase 7 (Rutas) → GET/PUT /api/settings/payment-config
  │
  └── Fase 8 (Frontend) → UI en Settings > Pagos
```

---

## Variable de Entorno Nueva

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `PAYMENT_CONFIG_ENCRYPTION_KEY` | Key AES-256 en hex (32 bytes = 64 chars) | Generar con: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |

---

## Notas Importantes

- **Alcance:** Solo se migra Mercado Pago (pagos del tenant). Stripe para suscripciones sigue en `.env` (es del SaaS).
- **Fallback:** Si `paymentConfig` es `null`, todo sigue funcionando con `process.env`. No es un breaking change.
- **Cache:** `PaymentConfigService` cachea en memoria. Si se actualiza la config, el cache se invalida automáticamente. El caché se pierde al reiniciar el servidor (se recarga de BD).
- **Async:** `validateWebhookSignature` de MercadoPagoService pasa a ser async. Los controllers/use cases que lo llaman necesitan `await`.
- **Seguridad:** Las keys nunca se devuelven completas al frontend. Solo se envían enmascaradas. El formulario envía keys nuevas completas solo al guardar.
- **Una sola variable de entorno nueva:** `PAYMENT_CONFIG_ENCRYPTION_KEY`. Las keys de Mercado Pago migran a la BD.
- **Extensible:** Si en el futuro el tenant necesita Stripe para pagos de órdenes, se agrega un bloque `stripe` al JSON sin migración de BD.
