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
  STRIPE_PRICE_ID: z.string().optional(),

  // Mercado Pago
  MP_ACCESS_TOKEN: z.string({ required_error: 'MP_ACCESS_TOKEN is required' }),
  MP_NOTIFICATION_URL: z.string().optional(),
  MP_WEBHOOK_SECRET: z.string().optional(),
  MP_BACK_URL: z.string().optional(),
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
