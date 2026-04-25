/**
 * Verifica la convencion UTC de las columnas DateTime de Prisma/MySQL.
 *
 * Uso:
 *   npx ts-node scripts/verify-timezone.ts
 *
 * Salida esperada: los valores de `date` y `createdAt` mas recientes deben
 * coincidir con `UTC_TIMESTAMP()` (no con `NOW()` local del servidor) si la
 * aplicacion esta escribiendo instantes UTC correctamente.
 */
import { PrismaClient } from '@prisma/client';

type Row = {
  id: string;
  date: Date;
  createdAt: Date;
  server_now: Date;
  server_utc: Date;
  session_tz: string;
  global_tz: string;
};

async function main() {
  const prisma = new PrismaClient();
  try {
    const rows = await prisma.$queryRawUnsafe<Row[]>(`
      SELECT
        id,
        date,
        createdAt,
        NOW() AS server_now,
        UTC_TIMESTAMP() AS server_utc,
        @@session.time_zone AS session_tz,
        @@global.time_zone AS global_tz
      FROM orders
      ORDER BY createdAt DESC
      LIMIT 3;
    `);

    if (rows.length === 0) {
      console.log('No hay ordenes en la tabla. Crea al menos una y vuelve a ejecutar.');
      return;
    }

    console.log('\n== Zona horaria del servidor MySQL ==');
    console.log(`  session.time_zone = ${rows[0].session_tz}`);
    console.log(`  global.time_zone  = ${rows[0].global_tz}`);
    console.log(`  NOW()             = ${rows[0].server_now.toISOString()}`);
    console.log(`  UTC_TIMESTAMP()   = ${rows[0].server_utc.toISOString()}`);

    console.log('\n== Ultimas 3 ordenes ==');
    for (const r of rows) {
      console.log(`  id=${r.id}`);
      console.log(`    date      = ${r.date.toISOString()}`);
      console.log(`    createdAt = ${r.createdAt.toISOString()}`);
    }

    const nowMs = rows[0].server_now.getTime();
    const utcMs = rows[0].server_utc.getTime();
    const diffHours = Math.round((nowMs - utcMs) / 3_600_000);
    console.log(`\n  NOW - UTC_TIMESTAMP = ${diffHours}h`);
    console.log(
      diffHours === 0
        ? '  OK: el servidor MySQL esta en UTC.'
        : `  AVISO: el servidor MySQL esta en offset ${diffHours}h respecto a UTC. Revisa la politica de escritura.`
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
