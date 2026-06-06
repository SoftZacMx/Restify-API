import { z } from 'zod';

const envSchema = z.object({
  // Server
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3000'),

  // Database
  DATABASE_URL: z.string({ required_error: 'DATABASE_URL is required' }),

  // JWT
  JWT_SECRET: z.string({ required_error: 'JWT_SECRET is required' }).min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('8h'),

  // CORS
  CORS_ORIGIN: z.string().default('http://localhost:5173'),

  // Stripe
  STRIPE_SECRET_KEY: z.string({ required_error: 'STRIPE_SECRET_KEY is required' }),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_SUBSCRIPTION_WEBHOOK_SECRET: z.string().optional(),

  // Mercado Pago (opcionales — pueden vivir en BD vía paymentConfig)
  MP_ACCESS_TOKEN: z.string().optional(),
  MP_NOTIFICATION_URL: z.string().optional(),
  MP_WEBHOOK_SECRET: z.string().optional(),
  MP_BACK_URL: z.string().optional(),

  // Encriptación de config de pagos
  PAYMENT_CONFIG_ENCRYPTION_KEY: z.string().length(64, 'Must be 64-char hex (32 bytes)'),

  // Email (4.1.D — AWS SES). Apagable: por defecto deshabilitado (no-op que loggea).
  EMAIL_ENABLED: z.enum(['true', 'false']).default('false'),
  EMAIL_FROM: z.string().email('EMAIL_FROM must be a valid email').optional(),

  // S3 storage de imágenes (Transversal). Apagable: por defecto deshabilitado (no-op que loggea).
  // En dev S3 vive en MinIO (:9000), separado de LocalStack. S3_ENDPOINT_URL / S3_ACCESS_KEY_ID /
  // S3_SECRET_ACCESS_KEY son opcionales y, si no se setean, caen a los AWS_* genéricos.
  S3_ENABLED: z.enum(['true', 'false']).default('false'),
  S3_BUCKET_NAME: z.string().optional(),
  S3_PUBLIC_BASE_URL: z.string().url('S3_PUBLIC_BASE_URL must be a valid URL').optional(),
  S3_ENDPOINT_URL: z.string().url('S3_ENDPOINT_URL must be a valid URL').optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),

  // Crons (4.1.F). Por defecto habilitados; en escalado horizontal poner RUN_CRONS=false
  // en todas las instancias menos una para evitar ejecuciones duplicadas.
  RUN_CRONS: z.enum(['true', 'false']).default('true'),
  UNVERIFIED_RETENTION_DAYS: z.string().optional(),
  CLEANUP_UNVERIFIED_CRON: z.string().optional(),
  CRON_TIMEZONE: z.string().optional(),
});

export function validateEnv(): void {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');

    console.error('❌ Invalid environment variables:\n' + errors);
    process.exit(1);
  }
}
