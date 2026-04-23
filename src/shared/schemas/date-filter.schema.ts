import { z } from 'zod';

/**
 * Filtro de fecha aceptado en query params: YYYY-MM-DD o ISO 8601 completo.
 * Se prefiere ISO 8601 con offset (ej. 2026-04-22T06:00:00.000Z) para precision de zona horaria.
 */
export const dateFilterSchema = z
  .string()
  .refine(
    (v) => /^\d{4}-\d{2}-\d{2}(T.*)?$/.test(v) && !Number.isNaN(Date.parse(v)),
    { message: 'Must be YYYY-MM-DD or ISO 8601 datetime' }
  );
