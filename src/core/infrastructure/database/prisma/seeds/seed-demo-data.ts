import { PrismaClient, UserRole, UserAccountStatus } from '@prisma/client';
import { BcryptUtil } from '../../../../../shared/utils/bcrypt.util';

const prisma = new PrismaClient();

async function seedDemoData() {
  console.log('🌱 Seeding demo data...');

  // 1. Get Free Legacy Plan
  const freeLegacyPlan = await prisma.subscriptionPlan.findUnique({
    where: { name: 'Free Legacy' },
  });

  if (!freeLegacyPlan) {
    throw new Error('Free Legacy plan not found. Run seed-subscription-plans.ts first.');
  }

  console.log(`✅ Found plan: ${freeLegacyPlan.name}`);

  // 2. Create Organization
  const org = await prisma.organization.upsert({
    where: { slug: 'demo-restaurant' },
    update: {},
    create: {
      name: 'Demo Restaurant',
      slug: 'demo-restaurant',
      plan: 'FREE',
      status: 'ACTIVE',
    },
  });

  console.log(`✅ Created organization: ${org.name} (${org.id})`);

  // 3. Create Subscription for Organization
  const subscription = await prisma.subscription.upsert({
    where: { organizationId: org.id },
    update: {},
    create: {
      organizationId: org.id,
      planId: freeLegacyPlan.id,
      status: 'ACTIVE',
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      currentPeriodStart: new Date(),
      currentPeriodEnd: null,
    },
  });

  console.log(`✅ Created subscription for organization (Plan: ${freeLegacyPlan.name})`);

  // 4. Create Branches
  const branchCentro = await prisma.branch.create({
    data: {
      name: 'Sucursal Centro',
      organizationId: org.id,
      state: 'CDMX',
      city: 'Ciudad de México',
      street: 'Av. Juárez',
      exteriorNumber: '123',
      phone: '5551234567',
      status: 'ACTIVE',
    },
  });

  const branchNorte = await prisma.branch.create({
    data: {
      name: 'Sucursal Norte',
      organizationId: org.id,
      state: 'CDMX',
      city: 'Ciudad de México',
      street: 'Calzada Norte',
      exteriorNumber: '456',
      phone: '5559876543',
      status: 'ACTIVE',
    },
  });

  const branchSur = await prisma.branch.create({
    data: {
      name: 'Sucursal Sur',
      organizationId: org.id,
      state: 'CDMX',
      city: 'Coyoacán',
      street: 'Insurgentes Sur',
      exteriorNumber: '789',
      phone: '5555555555',
      status: 'ACTIVE',
    },
  });

  console.log(`✅ Created branches: ${branchCentro.name}, ${branchNorte.name}, ${branchSur.name}`);

  // 5. Create Users
  const hashedPassword = await BcryptUtil.hash('password123');

  // OWNER (acceso a todas las branches)
  const owner = await prisma.user.upsert({
    where: { email: 'owner@demo.com' },
    update: {},
    create: {
      email: 'owner@demo.com',
      password: hashedPassword,
      name: 'Carlos',
      last_name: 'Propietario',
      phone: '5551111111',
      rol: UserRole.OWNER,
      organizationId: org.id,
      accountStatus: UserAccountStatus.ACTIVE,
      tokenVersion: 0,
      emailVerifiedAt: new Date(),
      mustChangePassword: false,
    },
  });

  // ADMIN (acceso a todas las branches)
  const admin = await prisma.user.upsert({
    where: { email: 'admin@demo.com' },
    update: {},
    create: {
      email: 'admin@demo.com',
      password: hashedPassword,
      name: 'Ana',
      last_name: 'Administradora',
      phone: '5552222222',
      rol: UserRole.ADMIN,
      organizationId: org.id,
      accountStatus: UserAccountStatus.ACTIVE,
      tokenVersion: 0,
      emailVerifiedAt: new Date(),
      mustChangePassword: false,
    },
  });

  // MANAGER (acceso a Centro y Norte)
  const manager = await prisma.user.upsert({
    where: { email: 'manager@demo.com' },
    update: {},
    create: {
      email: 'manager@demo.com',
      password: hashedPassword,
      name: 'Miguel',
      last_name: 'Gerente',
      phone: '5553333333',
      rol: UserRole.MANAGER,
      organizationId: org.id,
      accountStatus: UserAccountStatus.ACTIVE,
      tokenVersion: 0,
      emailVerifiedAt: new Date(),
      mustChangePassword: false,
    },
  });

  // WAITER 1 (solo Centro)
  const waiter1 = await prisma.user.upsert({
    where: { email: 'waiter1@demo.com' },
    update: {},
    create: {
      email: 'waiter1@demo.com',
      password: hashedPassword,
      name: 'Luis',
      last_name: 'Mesero',
      phone: '5554444444',
      rol: UserRole.WAITER,
      organizationId: org.id,
      accountStatus: UserAccountStatus.ACTIVE,
      tokenVersion: 0,
      emailVerifiedAt: new Date(),
      mustChangePassword: false,
    },
  });

  // WAITER 2 (solo Norte)
  const waiter2 = await prisma.user.upsert({
    where: { email: 'waiter2@demo.com' },
    update: {},
    create: {
      email: 'waiter2@demo.com',
      password: hashedPassword,
      name: 'Laura',
      last_name: 'Mesera',
      phone: '5555555556',
      rol: UserRole.WAITER,
      organizationId: org.id,
      accountStatus: UserAccountStatus.ACTIVE,
      tokenVersion: 0,
      emailVerifiedAt: new Date(),
      mustChangePassword: false,
    },
  });

  console.log(`✅ Created users:`);
  console.log(`   - OWNER: ${owner.email} (access to all branches)`);
  console.log(`   - ADMIN: ${admin.email} (access to all branches)`);
  console.log(`   - MANAGER: ${manager.email} (Centro branch)`);
  console.log(`   - WAITER: ${waiter1.email} (Centro branch)`);
  console.log(`   - WAITER: ${waiter2.email} (Norte branch)`);

  // 6. Create User-Branch Access for Manager (Centro y Norte)
  await prisma.userBranchAccess.upsert({
    where: {
      userId_branchId: {
        userId: manager.id,
        branchId: branchCentro.id,
      },
    },
    update: {},
    create: {
      userId: manager.id,
      branchId: branchCentro.id,
    },
  });

  await prisma.userBranchAccess.upsert({
    where: {
      userId_branchId: {
        userId: manager.id,
        branchId: branchNorte.id,
      },
    },
    update: {},
    create: {
      userId: manager.id,
      branchId: branchNorte.id,
    },
  });

  // 7. Create User-Branch Access for Waiters
  await prisma.userBranchAccess.upsert({
    where: {
      userId_branchId: {
        userId: waiter1.id,
        branchId: branchCentro.id,
      },
    },
    update: {},
    create: {
      userId: waiter1.id,
      branchId: branchCentro.id,
    },
  });

  await prisma.userBranchAccess.upsert({
    where: {
      userId_branchId: {
        userId: waiter2.id,
        branchId: branchNorte.id,
      },
    },
    update: {},
    create: {
      userId: waiter2.id,
      branchId: branchNorte.id,
    },
  });

  console.log(`✅ Created user-branch access (Manager: Centro + Norte, Waiters: their assigned branches)`);

  console.log('\n🎉 Demo data seeding completed!');
  console.log('\n📝 Test credentials (password: password123):');
  console.log('   OWNER: owner@demo.com (access to all branches)');
  console.log('   ADMIN: admin@demo.com (access to all branches)');
  console.log('   MANAGER: manager@demo.com (Centro + Norte branches)');
  console.log('   WAITER 1: waiter1@demo.com (Centro branch only)');
  console.log('   WAITER 2: waiter2@demo.com (Norte branch only)');
  console.log('\n🏢 Organization: Demo Restaurant');
  console.log(`   - Sucursal Centro (${branchCentro.id})`);
  console.log(`   - Sucursal Norte (${branchNorte.id})`);
  console.log(`   - Sucursal Sur (${branchSur.id})`);
  console.log('\n✅ Ready to test Phase 1: Multi-tenancy + Auth');
  console.log('   Test in Postman: POST /api/auth/login');
}

seedDemoData()
  .catch((error) => {
    console.error('❌ Error seeding demo data:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
