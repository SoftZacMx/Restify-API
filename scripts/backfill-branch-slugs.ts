/**
 * Backfill de slugs para sucursales que aún no tienen uno.
 *
 * Genera un slug a partir del nombre de cada sucursal con slug = NULL,
 * resolviendo colisiones. Idempotente: re-ejecutarlo no toca las que ya tienen slug.
 *
 * Uso: npx tsx scripts/backfill-branch-slugs.ts
 * Requiere: DATABASE_URL en .env (apuntando a la BD a rellenar).
 * Antes: npx prisma migrate deploy
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { slugify, ensureUniqueSlug } from '../src/shared/utils/slug.util';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const branches = await prisma.branch.findMany({
    where: { slug: null },
    select: { id: true, name: true },
    orderBy: { createdAt: 'asc' },
  });

  if (branches.length === 0) {
    console.log('No hay sucursales sin slug. Nada que hacer.');
    return;
  }

  console.log(`Sucursales sin slug: ${branches.length}`);

  for (const branch of branches) {
    const slug = await ensureUniqueSlug(slugify(branch.name), async (candidate) => {
      const found = await prisma.branch.findUnique({ where: { slug: candidate } });
      return found !== null;
    });

    await prisma.branch.update({
      where: { id: branch.id },
      data: { slug },
    });

    console.log(`  ${branch.name} -> ${slug}`);
  }

  console.log('Backfill completado.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
