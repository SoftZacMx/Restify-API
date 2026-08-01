import { Prisma, UnitOfMeasure } from '@prisma/client';
import {
  unitsCompatible,
  convertQuantity,
} from '../../../src/shared/utils/unit-conversion.util';

const Decimal = Prisma.Decimal;

describe('unitsCompatible', () => {
  it('misma unidad siempre compatible', () => {
    expect(unitsCompatible('KG', 'KG')).toBe(true);
    expect(unitsCompatible('PCS', 'PCS')).toBe(true);
    expect(unitsCompatible('OTHER', 'OTHER')).toBe(true);
  });

  it('compatibles dentro de la misma familia', () => {
    expect(unitsCompatible('KG', 'G')).toBe(true);
    expect(unitsCompatible('G', 'KG')).toBe(true);
    expect(unitsCompatible('L', 'ML')).toBe(true);
    expect(unitsCompatible('ML', 'L')).toBe(true);
  });

  it('incompatibles entre familias distintas', () => {
    expect(unitsCompatible('KG', 'L')).toBe(false);
    expect(unitsCompatible('G', 'ML')).toBe(false);
  });

  it('PCS/OTHER solo son compatibles consigo mismas', () => {
    expect(unitsCompatible('KG', 'PCS')).toBe(false);
    expect(unitsCompatible('PCS', 'KG')).toBe(false);
    expect(unitsCompatible('L', 'OTHER')).toBe(false);
    expect(unitsCompatible('OTHER', 'L')).toBe(false);
    expect(unitsCompatible('PCS', 'OTHER')).toBe(false);
  });
});

describe('convertQuantity', () => {
  it('convierte G a KG', () => {
    expect(convertQuantity(500, 'G', 'KG').toString()).toBe('0.5');
  });

  it('convierte KG a G', () => {
    expect(convertQuantity(2, 'KG', 'G').toString()).toBe('2000');
  });

  it('convierte ML a L', () => {
    expect(convertQuantity(250, 'ML', 'L').toString()).toBe('0.25');
  });

  it('convierte L a ML', () => {
    expect(convertQuantity(1.5, 'L', 'ML').toString()).toBe('1500');
  });

  it('acepta string y Decimal como cantidad', () => {
    expect(convertQuantity('1000', 'G', 'KG').toString()).toBe('1');
    expect(convertQuantity(new Decimal('3000'), 'G', 'KG').toString()).toBe('3');
  });

  it('devuelve la cantidad sin cambios si from === to', () => {
    expect(convertQuantity(7, 'KG', 'KG').toString()).toBe('7');
  });

  it('devuelve la cantidad sin cambios si from/to son null o undefined', () => {
    expect(convertQuantity(7, null, 'KG').toString()).toBe('7');
    expect(convertQuantity(7, 'KG', undefined).toString()).toBe('7');
    expect(convertQuantity(7, null, undefined).toString()).toBe('7');
  });

  it('devuelve la cantidad sin cambios si las unidades son incompatibles', () => {
    expect(convertQuantity(7, 'KG', 'ML').toString()).toBe('7');
    expect(convertQuantity(7, 'PCS', 'G').toString()).toBe('7');
  });
});
