import { PrismaClient, BillingPeriod } from '@prisma/client';

const prisma = new PrismaClient();

async function seedSubscriptionPlans() {
  console.log('🌱 Seeding subscription plans...');

  // Free Legacy Plan (for existing organizations)
  const freeLegacyPlan = await prisma.subscriptionPlan.upsert({
    where: { name: 'Free Legacy' },
    update: {},
    create: {
      name: 'Free Legacy',
      billingPeriod: null,
      price: 0,
      stripePriceId: null,
      maxBranches: 3,
      status: true,
    },
  });

  console.log(`✅ Created/Updated: ${freeLegacyPlan.name} (max ${freeLegacyPlan.maxBranches} branches)`);

  // Update existing subscriptions without planId to use Free Legacy
  const updatedCount = await prisma.subscription.updateMany({
    where: {
      planId: null,
    },
    data: {
      planId: freeLegacyPlan.id,
      status: 'ACTIVE',
    },
  });

  console.log(`✅ Updated ${updatedCount.count} subscriptions to Free Legacy plan`);

  // Optional: Create paid plans (commented out - uncomment when ready for billing)
  /*
  const monthlyPlan = await prisma.subscriptionPlan.upsert({
    where: { name: 'Plan Mensual' },
    update: {},
    create: {
      name: 'Plan Mensual',
      billingPeriod: BillingPeriod.MONTHLY,
      price: 322000, // $3,220 MXN
      stripePriceId: 'price_monthly_xxxxx', // Replace with real Stripe Price ID
      maxBranches: 10,
      status: true,
    },
  });

  console.log(`✅ Created/Updated: ${monthlyPlan.name}`);

  const annualPlan = await prisma.subscriptionPlan.upsert({
    where: { name: 'Plan Anual' },
    update: {},
    create: {
      name: 'Plan Anual',
      billingPeriod: BillingPeriod.ANNUAL,
      price: 3112300, // $31,123 MXN (20% discount)
      stripePriceId: 'price_annual_xxxxx', // Replace with real Stripe Price ID
      maxBranches: 10,
      status: true,
    },
  });

  console.log(`✅ Created/Updated: ${annualPlan.name}`);
  */

  console.log('🎉 Subscription plans seeding completed!');
}

seedSubscriptionPlans()
  .catch((error) => {
    console.error('❌ Error seeding subscription plans:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
