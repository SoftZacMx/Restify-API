#!/usr/bin/env ts-node

/**
 * Elimina todas las órdenes de la base de datos (y datos relacionados: pagos, refunds, sesiones, etc.).
 *
 * Uso: npx ts-node scripts/delete-orders.ts
 * o: npm run delete:orders
 */

import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function deleteAllOrders(): Promise<void> {
  console.log('🗑️  Eliminando todas las órdenes y datos relacionados...\n');

  try {
    // 1. Pagos con orderId: eliminar refunds y sesiones de pago
    const orderPayments = await prisma.payment.findMany({
      where: { orderId: { not: null } },
      select: { id: true },
    });
    const paymentIds = orderPayments.map((p) => p.id);

    if (paymentIds.length > 0) {
      const deletedRefunds = await prisma.refund.deleteMany({
        where: { paymentId: { in: paymentIds } },
      });
      console.log(`   Refunds eliminados: ${deletedRefunds.count}`);

      const deletedSessions = await prisma.paymentSession.deleteMany({
        where: { paymentId: { in: paymentIds } },
      });
      console.log(`   PaymentSession eliminados: ${deletedSessions.count}`);
    }

    // 2. Pagos asociados a órdenes
    const deletedPayments = await prisma.payment.deleteMany({
      where: { orderId: { not: null } },
    });
    console.log(`   Payments eliminados: ${deletedPayments.count}`);

    // 3. Diferenciación de pago (split) por orden
    const deletedDiff = await prisma.paymentDifferentiation.deleteMany({});
    console.log(`   PaymentDifferentiation eliminados: ${deletedDiff.count}`);

    // 4. Órdenes (cascade elimina OrderItem y OrderItemExtra)
    const deletedOrders = await prisma.order.deleteMany({});
    console.log(`   Orders eliminados: ${deletedOrders.count}`);

    console.log('\n✅ Todas las órdenes han sido eliminadas.');
  } catch (error) {
    console.error('❌ Error eliminando órdenes:', error);
    throw error;
  }
}

async function main(): Promise<void> {
  try {
    await deleteAllOrders();
  } catch (error) {
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main();
}

export { deleteAllOrders };
