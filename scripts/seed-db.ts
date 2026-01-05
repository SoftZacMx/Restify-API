#!/usr/bin/env ts-node

/**
 * Database Seeding Script
 * Creates default users for development and testing
 * 
 * Usage: npm run prisma:seed
 * or: ts-node scripts/seed-db.ts
 */

import { PrismaClient, UserRole } from '@prisma/client';
import { BcryptUtil } from '../src/shared/utils/bcrypt.util';

const prisma = new PrismaClient();

interface SeedUser {
  name: string;
  last_name: string;
  second_last_name?: string;
  email: string;
  password: string;
  phone?: string;
  rol: UserRole;
  status: boolean;
}

const DEFAULT_PASSWORD = 'Restify123!';

const seedUsers: SeedUser[] = [
  {
    name: 'Admin',
    last_name: 'System',
    email: 'admin@restify.com',
    password: DEFAULT_PASSWORD,
    rol: UserRole.ADMIN,
    status: true,
  },
  {
    name: 'Manager',
    last_name: 'Test',
    email: 'manager@restify.com',
    password: DEFAULT_PASSWORD,
    rol: UserRole.MANAGER,
    status: true,
  },
  {
    name: 'Juan',
    last_name: 'Pérez',
    second_last_name: 'García',
    email: 'waiter@restify.com',
    password: DEFAULT_PASSWORD,
    phone: '+1234567890',
    rol: UserRole.WAITER,
    status: true,
  },
  {
    name: 'María',
    last_name: 'López',
    second_last_name: 'Martínez',
    email: 'chef@restify.com',
    password: DEFAULT_PASSWORD,
    phone: '+1234567891',
    rol: UserRole.CHEF,
    status: true,
  },
];

async function seedUsersData(): Promise<void> {
  console.log('🌱 Starting database seeding...\n');

  try {
    // Check if users already exist
    const existingUsers = await prisma.user.findMany({
      where: {
        email: {
          in: seedUsers.map((u) => u.email),
        },
      },
    });

    if (existingUsers.length > 0) {
      console.log('⚠️  Some users already exist. Skipping seed...');
      console.log('   Existing users:', existingUsers.map((u) => u.email).join(', '));
      console.log('\n💡 To reseed, delete existing users first or use --force flag\n');
      return;
    }

    // Hash passwords
    console.log('🔐 Hashing passwords...');
    const usersWithHashedPasswords = await Promise.all(
      seedUsers.map(async (user) => ({
        ...user,
        password: await BcryptUtil.hash(user.password),
      }))
    );

    // Create users
    console.log('👥 Creating users...\n');
    for (const userData of usersWithHashedPasswords) {
      const user = await prisma.user.create({
        data: {
          name: userData.name,
          last_name: userData.last_name,
          second_last_name: userData.second_last_name || null,
          email: userData.email,
          password: userData.password,
          phone: userData.phone || null,
          rol: userData.rol,
          status: userData.status,
        },
      });

      console.log(`✅ Created user: ${user.email} (${user.rol})`);
    }

    console.log('\n✨ Seeding completed successfully!');
    console.log('\n📋 Default users created:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    seedUsers.forEach((user) => {
      console.log(`   Email: ${user.email.padEnd(25)} | Role: ${user.rol.padEnd(10)} | Password: ${DEFAULT_PASSWORD}`);
    });
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    throw error;
  }
}

async function main(): Promise<void> {
  try {
    await seedUsersData();
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run seed if executed directly
if (require.main === module) {
  main();
}

export { seedUsersData };

