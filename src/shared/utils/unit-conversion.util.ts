import { Prisma, UnitOfMeasure } from '@prisma/client';

const Decimal = Prisma.Decimal;

/**
 * Conversión de unidades de medida entre las soportadas por el dominio.
 * Solo convierte entre unidades del mismo "tipo" (peso, volumen). PCS/OTHER son atómicas.
 *
 * Tabla de factores hacia la unidad base por familia:
 * - Peso: base KG. (1 G = 0.001 KG, 1 KG = 1 KG)
 * - Volumen: base L. (1 ML = 0.001 L, 1 L = 1 L)
 * - PCS, OTHER: solo idénticas.
 */

const WEIGHT: ReadonlySet<UnitOfMeasure> = new Set<UnitOfMeasure>(['KG', 'G']);
const VOLUME: ReadonlySet<UnitOfMeasure> = new Set<UnitOfMeasure>(['L', 'ML']);

function family(u: UnitOfMeasure): 'WEIGHT' | 'VOLUME' | 'COUNT' | 'OTHER' {
  if (WEIGHT.has(u)) return 'WEIGHT';
  if (VOLUME.has(u)) return 'VOLUME';
  if (u === 'PCS') return 'COUNT';
  return 'OTHER';
}

function factorToBase(u: UnitOfMeasure): Prisma.Decimal {
  switch (u) {
    case 'KG':
    case 'L':
    case 'PCS':
    case 'OTHER':
      return new Decimal(1);
    case 'G':
    case 'ML':
      return new Decimal('0.001');
    default:
      return new Decimal(1);
  }
}

/** Indica si dos unidades pueden convertirse entre sí. */
export function unitsCompatible(from: UnitOfMeasure, to: UnitOfMeasure): boolean {
  if (from === to) return true;
  const fromFam = family(from);
  const toFam = family(to);
  if (fromFam === 'COUNT' || fromFam === 'OTHER' || toFam === 'COUNT' || toFam === 'OTHER') {
    return false; // PCS/OTHER solo se aceptan idénticos
  }
  return fromFam === toFam;
}

/**
 * Convierte una cantidad de `from` a `to`. Si las unidades no son compatibles,
 * devuelve la cantidad sin cambios (best-effort, evita errores en producción).
 * Casos típicos: G → KG (× 0.001), KG → G (× 1000).
 */
export function convertQuantity(
  qty: Prisma.Decimal | number | string,
  from: UnitOfMeasure | null | undefined,
  to: UnitOfMeasure | null | undefined
): Prisma.Decimal {
  const q = new Decimal(qty);
  if (!from || !to || from === to) return q;
  if (!unitsCompatible(from, to)) return q;

  // qty[from] × factor[from] = qty[base], luego ÷ factor[to] → qty[to]
  const inBase = q.times(factorToBase(from));
  return inBase.dividedBy(factorToBase(to));
}
