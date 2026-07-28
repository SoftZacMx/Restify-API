import { startOfDayInZone, endOfDayInZone } from '../../../src/shared/utils/date-range.util';

/**
 * Unico lugar del sistema que decide donde empieza y termina un dia. Antes esta frontera
 * la calculaba el frontend con la zona fija de CDMX; ahora la calcula el backend con la
 * zona de la sucursal, asi que estas pruebas son las que sostienen ese contrato.
 */
describe('startOfDayInZone / endOfDayInZone', () => {
  describe('dia calendario en la zona de la sucursal', () => {
    // Mexico elimino el horario de verano en 2022: CDMX es UTC-6 todo el año.
    it('CDMX abre a las 06:00 UTC y cierra a las 05:59:59.999 del dia siguiente', () => {
      expect(startOfDayInZone('2026-04-22', 'America/Mexico_City').toISOString()).toBe(
        '2026-04-22T06:00:00.000Z'
      );
      expect(endOfDayInZone('2026-04-22', 'America/Mexico_City').toISOString()).toBe(
        '2026-04-23T05:59:59.999Z'
      );
    });

    it('Cancun (UTC-5) empieza una hora antes que CDMX', () => {
      expect(startOfDayInZone('2026-04-22', 'America/Cancun').toISOString()).toBe(
        '2026-04-22T05:00:00.000Z'
      );
    });

    it('cierra el ultimo dia del mes sin pasarse al mes siguiente', () => {
      expect(startOfDayInZone('2026-01-31', 'America/Mexico_City').toISOString()).toBe(
        '2026-01-31T06:00:00.000Z'
      );
      expect(endOfDayInZone('2026-01-31', 'America/Mexico_City').toISOString()).toBe(
        '2026-02-01T05:59:59.999Z'
      );
    });

    it('cierra el ultimo dia del año', () => {
      expect(endOfDayInZone('2026-12-31', 'America/Mexico_City').toISOString()).toBe(
        '2027-01-01T05:59:59.999Z'
      );
    });
  });

  describe('Tijuana, que si tiene horario de verano', () => {
    // Baja California lo conservo para no desincronizarse de California: UTC-8 en invierno,
    // UTC-7 en verano. Por eso se guarda el nombre de la zona y no un desfase fijo.
    it('en enero abre a las 08:00 UTC', () => {
      expect(startOfDayInZone('2026-01-15', 'America/Tijuana').toISOString()).toBe(
        '2026-01-15T08:00:00.000Z'
      );
    });

    it('en julio abre a las 07:00 UTC', () => {
      expect(startOfDayInZone('2026-07-15', 'America/Tijuana').toISOString()).toBe(
        '2026-07-15T07:00:00.000Z'
      );
    });

    it('difiere de CDMX: el mismo dia arranca dos horas despues en enero', () => {
      const tijuana = startOfDayInZone('2026-01-15', 'America/Tijuana').getTime();
      const cdmx = startOfDayInZone('2026-01-15', 'America/Mexico_City').getTime();
      expect((tijuana - cdmx) / (60 * 60 * 1000)).toBe(2);
    });
  });

  describe('instante completo', () => {
    it('lo respeta tal cual y no le aplica la zona', () => {
      const iso = '2026-04-22T15:30:00.000Z';
      expect(startOfDayInZone(iso, 'America/Tijuana').toISOString()).toBe(iso);
      expect(endOfDayInZone(iso, 'America/Mexico_City').toISOString()).toBe(iso);
    });
  });

  it('tolera espacios alrededor', () => {
    expect(startOfDayInZone('  2026-04-22  ', 'America/Mexico_City').toISOString()).toBe(
      '2026-04-22T06:00:00.000Z'
    );
  });
});
