/** Convierte "HH:mm" a minutos desde medianoche (0-1439) */
export function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/** Indica si una hora (HH:mm) está dentro del rango [start, end]. Soporta cruce de medianoche (ej. 22:00 a 02:00). */
export function isWithinOperatingHours(hhmm: string, start: string, end: string): boolean {
  const now = timeToMinutes(hhmm);
  const startMin = timeToMinutes(start);
  const endMin = timeToMinutes(end);
  if (startMin <= endMin) {
    return now >= startMin && now <= endMin;
  }
  return now >= startMin || now <= endMin;
}
