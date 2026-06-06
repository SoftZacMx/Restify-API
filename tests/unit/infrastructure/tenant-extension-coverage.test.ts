import { Prisma } from '@prisma/client';
import {
  ORG_LEVEL_MODELS,
  BRANCH_LEVEL_MODELS,
  GLOBAL_MODELS,
} from '../../../src/core/infrastructure/database/prisma/tenant-extension';

/**
 * Red de seguridad de aislamiento multi-tenant.
 *
 * La tenant extension falla-seguro: un modelo no clasificado lanza error en runtime.
 * Este test mueve esa detección a CI/push, con un mensaje claro de qué falta clasificar,
 * para que nadie se entere recién en producción.
 *
 * Si agregas un modelo nuevo a schema.prisma, clasifícalo en EXACTAMENTE una de las
 * tres listas de tenant-extension.ts (ORG / BRANCH / GLOBAL) y este test pasará.
 */
describe('tenant extension — cobertura de modelos', () => {
  const prismaModels = Prisma.dmmf.datamodel.models.map((m) => m.name);

  it('todo modelo de Prisma está clasificado en la tenant extension', () => {
    const classified = new Set([
      ...ORG_LEVEL_MODELS,
      ...BRANCH_LEVEL_MODELS,
      ...GLOBAL_MODELS,
    ]);

    const unclassified = prismaModels.filter((name) => !classified.has(name));

    expect(unclassified).toEqual([]);
  });

  it('ningún modelo está clasificado en más de una lista', () => {
    const duplicates = prismaModels.filter((name) => {
      const hits =
        (ORG_LEVEL_MODELS.has(name) ? 1 : 0) +
        (BRANCH_LEVEL_MODELS.has(name) ? 1 : 0) +
        (GLOBAL_MODELS.has(name) ? 1 : 0);
      return hits > 1;
    });

    expect(duplicates).toEqual([]);
  });

  it('las listas no contienen nombres que no existan en el schema de Prisma', () => {
    const known = new Set(prismaModels);
    const orphans = [...ORG_LEVEL_MODELS, ...BRANCH_LEVEL_MODELS, ...GLOBAL_MODELS].filter(
      (name) => !known.has(name)
    );

    expect(orphans).toEqual([]);
  });
});
