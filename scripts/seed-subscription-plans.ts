#!/usr/bin/env ts-node

/**
 * Seed: Subscription Plans (Mensual y Anual) + suscripción activa anual.
 *
 * Uso: npx ts-node scripts/seed-subscription-plans.ts
 * Requiere: DATABASE_URL en .env
 *
 * Los stripe_price_id deben corresponder a los Products/Prices creados en Stripe Dashboard.
 * Actualiza los valores antes de ejecutar en producción.
 */

import { PrismaClient, BillingPeriod, SubscriptionStatus } from '@prisma/client';

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

const SEED_STRIPE_CUSTOMER_ID = 'cus_seed_local';
const SEED_STRIPE_SUBSCRIPTION_ID = 'sub_seed_local';

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

  console.log('\n🌱 Seed: Suscripción activa (Anual)\n');

  const annualPlan = await prisma.subscriptionPlan.findUnique({
    where: { stripePriceId: plans[1].stripePriceId },
  });

  if (!annualPlan) {
    throw new Error('Plan Anual no encontrado tras el seed de planes.');
  }

  const existingSubscription = await prisma.subscription.findUnique({
    where: { stripeCustomerId: SEED_STRIPE_CUSTOMER_ID },
  });

  if (existingSubscription) {
    console.log(`   ⏭️  Suscripción ya existe (${SEED_STRIPE_CUSTOMER_ID})`);
  } else {
    const now = new Date();
    const oneYearFromNow = new Date(now);
    oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

    await prisma.subscription.create({
      data: {
        stripeCustomerId: SEED_STRIPE_CUSTOMER_ID,
        stripeSubscriptionId: SEED_STRIPE_SUBSCRIPTION_ID,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: now,
        currentPeriodEnd: oneYearFromNow,
        cancelAtPeriodEnd: false,
        planId: annualPlan.id,
      },
    });

    console.log(`   ✅ Suscripción ACTIVE — vence ${oneYearFromNow.toISOString().slice(0, 10)} — plan ${annualPlan.name}`);
  }

  console.log('\n✨ Seed terminado.');
}

main()
  .catch((e) => {
    console.error('❌ Error en seed de planes:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
