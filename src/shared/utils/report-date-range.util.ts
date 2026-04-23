/**
 * Parse rangos de fecha de reportes. Acepta:
 *  - YYYY-MM-DD (legacy): se interpreta como inicio/fin de dia en APP_TIMEZONE.
 *  - ISO 8601 completo: se interpreta como instante absoluto (preferido desde frontend).
 */
import { fromZonedTime } from 'date-fns-tz';
import { APP_TIMEZONE } from '../constants';

const YMD_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export function parseReportRangeDateFrom(input: string): Date {
  const s = input.trim();
  if (YMD_ONLY.test(s)) {
    return fromZonedTime(`${s} 00:00:00.000`, APP_TIMEZONE);
  }
  return new Date(s);
}

export function parseReportRangeDateTo(input: string): Date {
  const s = input.trim();
  if (YMD_ONLY.test(s)) {
    return fromZonedTime(`${s} 23:59:59.999`, APP_TIMEZONE);
  }
  return new Date(s);
}
