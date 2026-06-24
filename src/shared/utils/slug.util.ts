export const SLUG_MAX_LENGTH = 60;
export const SLUG_FALLBACK = 'sucursal';

/**
 * Convierte un texto en slug para URLs. Ej: "Tacos El Rey #1" -> "tacos-el-rey-1".
 */
export function slugify(input: string): string {
  const slug = input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quita acentos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-') // no alfanumérico -> guion
    .replace(/^-+|-+$/g, '') // sin guiones en los extremos
    .slice(0, SLUG_MAX_LENGTH)
    .replace(/-+$/g, '');

  return slug || SLUG_FALLBACK;
}

/**
 * Devuelve un slug único. Si `base` ya existe, prueba "base-2", "base-3", etc.
 * `exists` decide si un candidato ya está tomado (normalmente una consulta a BD).
 */
export async function ensureUniqueSlug(
  base: string,
  exists: (candidate: string) => Promise<boolean>
): Promise<string> {
  if (!(await exists(base))) {
    return base;
  }

  for (let n = 2; ; n++) {
    const suffix = `-${n}`;
    const trimmed = base.slice(0, SLUG_MAX_LENGTH - suffix.length).replace(/-+$/g, '');
    const candidate = `${trimmed}${suffix}`;
    if (!(await exists(candidate))) {
      return candidate;
    }
  }
}
