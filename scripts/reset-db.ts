#!/usr/bin/env ts-node

/**
 * Database Reset Script
 * Drops all tables and recreates the database schema
 * WARNING: This will delete ALL data!
 * 
 * Usage: npm run prisma:reset
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function resetDatabase(): Promise<void> {
  console.log('🔄 Resetting database...\n');

  try {
    // Delete all users first (to avoid foreign key constraints)
    console.log('🗑️  Deleting all users...');
    await prisma.user.deleteMany({});
    console.log('✅ All users deleted\n');

    // Note: Prisma doesn't have a direct reset command
    // You would need to use: prisma migrate reset
    console.log('💡 To fully reset the database, run:');
    console.log('   npm run prisma:migrate:reset\n');
    console.log('   Or manually:');
    console.log('   npx prisma migrate reset --schema=./src/core/infrastructure/database/prisma/schema.prisma\n');
  } catch (error) {
    console.error('❌ Error resetting database:', error);
    throw error;
  }
}

async function main(): Promise<void> {
  try {
    await resetDatabase();
  } catch (error) {
    console.error('Reset failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run reset if executed directly
if (require.main === module) {
  main();
}

export { resetDatabase };

