/**
 * Convierte un dia calendario de la API a instante absoluto. Acepta:
 *  - YYYY-MM-DD: se interpreta como inicio/fin de dia en la zona recibida (preferido).
 *  - ISO 8601 completo: se toma como instante absoluto, la zona no se aplica.
 *
 * Unico lugar que decide donde empieza y termina un dia, y esa frontera depende de la
 * sucursal. Lo usan tanto los filtros por rango como la fecha propia de un registro
 * (un gasto del dia 22 debe guardarse como la medianoche del 22 en su sucursal).
 */
import { fromZonedTime } from 'date-fns-tz';

/** Solo el dia, sin hora: "2026-04-22". El `$` es lo que descarta un ISO completo. */
const CALENDAR_DAY_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function isCalendarDayOnly(value: string): boolean {
  return CALENDAR_DAY_ONLY.test(value);
}

export function startOfDayInZone(input: string, timezone: string): Date {
  const s = input.trim();
  if (isCalendarDayOnly(s)) {
    return fromZonedTime(`${s} 00:00:00.000`, timezone);
  }
  return new Date(s);
}

export function endOfDayInZone(input: string, timezone: string): Date {
  const s = input.trim();
  if (isCalendarDayOnly(s)) {
    return fromZonedTime(`${s} 23:59:59.999`, timezone);
  }
  return new Date(s);
}
