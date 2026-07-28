/**
 * Una zona mal escrita ("America/Mexico" en vez de "America/Mexico_City") hace tirar a
 * date-fns-tz en cada formateo de fecha. Se valida al guardarla y al leerla.
 */
export function isValidTimeZone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}
