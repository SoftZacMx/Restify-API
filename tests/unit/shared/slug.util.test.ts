import { slugify, ensureUniqueSlug, SLUG_FALLBACK, SLUG_MAX_LENGTH } from '../../../src/shared/utils/slug.util';

describe('slugify', () => {
  it('pasa a minúsculas y une palabras con guiones', () => {
    expect(slugify('Tacos El Rey')).toBe('tacos-el-rey');
  });

  it('quita acentos', () => {
    expect(slugify('Café Méxíco')).toBe('cafe-mexico');
  });

  it('elimina símbolos y colapsa espacios múltiples', () => {
    expect(slugify('Tacos   El Rey #1!!')).toBe('tacos-el-rey-1');
  });

  it('recorta guiones de los extremos', () => {
    expect(slugify('  - Hola - ')).toBe('hola');
  });

  it('usa el fallback cuando no queda nada útil', () => {
    expect(slugify('!!!')).toBe(SLUG_FALLBACK);
    expect(slugify('')).toBe(SLUG_FALLBACK);
  });

  it('respeta la longitud máxima sin dejar guion final', () => {
    const result = slugify('a '.repeat(100));
    expect(result.length).toBeLessThanOrEqual(SLUG_MAX_LENGTH);
    expect(result.endsWith('-')).toBe(false);
  });
});

describe('ensureUniqueSlug', () => {
  it('devuelve el base si está libre', async () => {
    const result = await ensureUniqueSlug('tacos', async () => false);
    expect(result).toBe('tacos');
  });

  it('agrega -2 cuando el base está tomado', async () => {
    const taken = new Set(['tacos']);
    const result = await ensureUniqueSlug('tacos', async (c) => taken.has(c));
    expect(result).toBe('tacos-2');
  });

  it('sigue incrementando ante varias colisiones', async () => {
    const taken = new Set(['tacos', 'tacos-2', 'tacos-3']);
    const result = await ensureUniqueSlug('tacos', async (c) => taken.has(c));
    expect(result).toBe('tacos-4');
  });
});
