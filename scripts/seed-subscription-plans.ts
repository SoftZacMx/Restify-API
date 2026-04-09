#!/usr/bin/env ts-node

/**
 * Seed: Subscription Plans (Mensual y Anual).
 *
 * Uso: npx ts-node scripts/seed-subscription-plans.ts
 * Requiere: DATABASE_URL en .env
 *
 * Los stripe_price_id deben corresponder a los Products/Prices creados en Stripe Dashboard.
 * Actualiza los valores antes de ejecutar en producción.
 */

import { PrismaClient, BillingPeriod } from '@prisma/client';

const prisma = new PrismaClient();

const plans = [
  {
    name: 'Mensual',
    billingPeriod: BillingPeriod.MONTHLY,
    price: 322000, // $3,220 MXN en centavos
    stripePriceId: process.env.STRIPE_PRICE_ID_MONTHLY || 'price_monthly_placeholder',
  },
  {
    name: 'Anual',
    billingPeriod: BillingPeriod.ANNUAL,
    price: 3112300, // $31,123 MXN en centavos
    stripePriceId: process.env.STRIPE_PRICE_ID_ANNUAL || 'price_annual_placeholder',
  },
];

async function main(): Promise<void> {
  console.log('🌱 Seed: Subscription Plans\n');

  for (const plan of plans) {
    const existing = await prisma.subscriptionPlan.findUnique({
      where: { stripePriceId: plan.stripePriceId },
    });

    if (existing) {
      console.log(`   ⏭️  ${plan.name} ya existe (${plan.stripePriceId})`);
      continue;
    }

    await prisma.subscriptionPlan.create({ data: plan });
    console.log(`   ✅ ${plan.name} — ${plan.billingPeriod} — $${(plan.price / 100).toLocaleString()} MXN`);
  }

  console.log('\n✨ Seed de planes terminado.');
}

main()
  .catch((e) => {
    console.error('❌ Error en seed de planes:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
