#!/usr/bin/env ts-node
/**
 * Sincroniza solo **precios** de `menu_items` en la BDD (DATABASE_URL) usando un dump SQL.
 *
 * Lee: `backups_bdd/dump.sql` (respecto a la raíz del proyecto Restify-API).
 * Extrae nombre + precio desde la tabla legacy **`saources`** (mismo formato que `parse-railway-dump.js`):
 *   (id, name, date, price, status, category_id, is_extra)
 *
 * Por cada fila del dump, actualiza en Prisma los `MenuItem` cuyo `name` coincide (trim, comparación
 * case-insensitive en memoria para evitar problemas de collation).
 *
 * Uso:
 *   DATABASE_URL="mysql://..." npm run sync:prices:dump
 * Simulación (no escribe en BD):
 *   DRY_RUN=1 npm run sync:prices:dump
 */

import { PrismaClient, Prisma } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const DUMP_RELATIVE = path.join('backups_bdd', 'dump.sql');

function resolveDumpPath(): string {
  return path.join(__dirname, '..', DUMP_RELATIVE);
}

/** Mismo patrón que `scripts/parse-railway-dump.js` → tabla `saources`. */
function parseSaourcesFromDump(sql: string): Map<string, number> {
  const byName = new Map<string, number>();
  const saourcesMatch = sql.match(/INSERT INTO `saources` VALUES (.+);/s);
  if (!saourcesMatch) {
    return byName;
  }
  const content = saourcesMatch[1];
  const regex =
    /\((\d+),'([^']*)','\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}',([\d.]+),(\d),(\d+),(\d)\)/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(content)) !== null) {
    const name = m[2];
    const price = parseFloat(m[3]);
    if (name.trim().length === 0 || Number.isNaN(price)) continue;
    byName.set(name.trim(), price);
  }
  return byName;
}

function normalizeName(s: string): string {
  return s.trim().toLowerCase();
}

async function main(): Promise<void> {
  const dumpPath = resolveDumpPath();
  const dryRun = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true';

  if (!fs.existsSync(dumpPath)) {
    throw new Error(
      `No existe el dump: ${dumpPath}\nColoca el archivo SQL en Restify-API/${DUMP_RELATIVE}`
    );
  }

  const sql = fs.readFileSync(dumpPath, 'utf8');
  const pricesFromDump = parseSaourcesFromDump(sql);

  if (pricesFromDump.size === 0) {
    throw new Error(
      'No se encontraron filas en INSERT INTO `saources`. ' +
        'Si tu dump solo tiene `menu_items`, hay que ampliar el parser en este script.'
    );
  }

  console.log(`📄 Dump: ${dumpPath}`);
  console.log(`📦 Precios únicos por nombre (saources): ${pricesFromDump.size}`);
  if (dryRun) {
    console.log('🔸 DRY_RUN: no se escribirá en la base de datos.\n');
  }

  const prisma = new PrismaClient();
  try {
    const menuItems = await prisma.menuItem.findMany({
      select: { id: true, name: true, price: true },
    });

    const byNormalized = new Map<string, typeof menuItems>();
    for (const row of menuItems) {
      const key = normalizeName(row.name);
      const list = byNormalized.get(key) ?? [];
      list.push(row);
      byNormalized.set(key, list);
    }

    let updated = 0;
    let skippedNoMatch = 0;
    let skippedSamePrice = 0;

    for (const [dumpName, dumpPrice] of pricesFromDump) {
      const key = normalizeName(dumpName);
      const matches = byNormalized.get(key);
      if (!matches || matches.length === 0) {
        skippedNoMatch++;
        if (dryRun) {
          console.log(`  [sin coincidencia] "${dumpName}" → ${dumpPrice}`);
        }
        continue;
      }

      const newPrice = new Prisma.Decimal(dumpPrice.toFixed(2));

      for (const row of matches) {
        const current = Number(row.price);
        if (Math.abs(current - dumpPrice) < 0.005) {
          skippedSamePrice++;
          continue;
        }
        if (dryRun) {
          console.log(
            `  [dry-run] "${row.name}" ${current} → ${dumpPrice}`
          );
          updated++;
        } else {
          await prisma.menuItem.update({
            where: { id: row.id },
            data: { price: newPrice },
          });
          updated++;
          console.log(`  ✓ "${row.name}" ${current} → ${dumpPrice}`);
        }
      }
    }

    console.log('\n--- Resumen ---');
    console.log(`Actualizaciones: ${updated}`);
    console.log(`Sin fila en BDD con ese nombre: ${skippedNoMatch} nombres del dump`);
    console.log(`Sin cambio (precio ya igual): ${skippedSamePrice} filas`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
