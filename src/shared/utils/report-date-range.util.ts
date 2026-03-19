/**
 * Parse YYYY-MM-DD from report filters into UTC day bounds (inclusive).
 * Fixes: new Date('2026-03-19') is midnight UTC only — "Hasta" must be end of day.
 */
const YMD_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseReportRangeDateFrom(input: string): Date {
  const s = input.trim();
  const m = YMD_ONLY.exec(s);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    return new Date(Date.UTC(y, mo - 1, d, 0, 0, 0, 0));
  }
  return new Date(s);
}

export function parseReportRangeDateTo(input: string): Date {
  const s = input.trim();
  const m = YMD_ONLY.exec(s);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    return new Date(Date.UTC(y, mo - 1, d, 23, 59, 59, 999));
  }
  return new Date(s);
}
