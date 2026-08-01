import {
  timeToMinutes,
  isWithinOperatingHours,
} from '../../../src/shared/utils/operating-hours.util';

describe('timeToMinutes', () => {
  it('convierte HH:mm a minutos desde medianoche', () => {
    expect(timeToMinutes('00:00')).toBe(0);
    expect(timeToMinutes('08:30')).toBe(510);
    expect(timeToMinutes('23:59')).toBe(1439);
  });
});

describe('isWithinOperatingHours', () => {
  it('dentro del rango sin cruce de medianoche', () => {
    expect(isWithinOperatingHours('12:00', '09:00', '18:00')).toBe(true);
  });

  it('fuera del rango sin cruce de medianoche', () => {
    expect(isWithinOperatingHours('08:00', '09:00', '18:00')).toBe(false);
    expect(isWithinOperatingHours('19:00', '09:00', '18:00')).toBe(false);
  });

  it('incluye los bordes del rango', () => {
    expect(isWithinOperatingHours('09:00', '09:00', '18:00')).toBe(true);
    expect(isWithinOperatingHours('18:00', '09:00', '18:00')).toBe(true);
  });

  it('soporta cruce de medianoche (22:00 a 02:00)', () => {
    expect(isWithinOperatingHours('23:00', '22:00', '02:00')).toBe(true);
    expect(isWithinOperatingHours('01:00', '22:00', '02:00')).toBe(true);
    expect(isWithinOperatingHours('22:00', '22:00', '02:00')).toBe(true);
    expect(isWithinOperatingHours('02:00', '22:00', '02:00')).toBe(true);
    expect(isWithinOperatingHours('05:00', '22:00', '02:00')).toBe(false);
    expect(isWithinOperatingHours('12:00', '22:00', '02:00')).toBe(false);
  });
});
