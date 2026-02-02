#!/usr/bin/env ts-node

/**
 * Release all occupied tables (set availabilityStatus = true).
 * Usage: npm run release:tables
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const result = await prisma.table.updateMany({
    where: { availabilityStatus: false },
    data: { availabilityStatus: true },
  });
  console.log(`Mesas liberadas: ${result.count}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
