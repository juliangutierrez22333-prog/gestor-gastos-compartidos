import { describe, expect, it } from 'vitest';

import { formatCents, parseAmountToCents } from './money';

describe('parseAmountToCents', () => {
  it('convierte montos enteros', () => {
    expect(parseAmountToCents('150')).toBe(15000);
  });

  it('acepta coma o punto como separador decimal', () => {
    expect(parseAmountToCents('150,50')).toBe(15050);
    expect(parseAmountToCents('150.50')).toBe(15050);
  });

  it('completa un solo decimal como decenas de centavo', () => {
    expect(parseAmountToCents('150,5')).toBe(15050);
  });

  it('no pierde precisión con montos problemáticos para floats', () => {
    // 0.29 * 100 = 28.999999999999996 en aritmética de floats.
    expect(parseAmountToCents('0,29')).toBe(29);
  });

  it('tolera espacios alrededor', () => {
    expect(parseAmountToCents('  42  ')).toBe(4200);
  });

  it('rechaza formatos inválidos', () => {
    for (const invalido of ['', 'abc', '12,345', '1.234,56', '-5', '1,2,3', '$100']) {
      expect(parseAmountToCents(invalido)).toBeNull();
    }
  });
});

describe('formatCents', () => {
  it('muestra centavos como moneda con dos decimales', () => {
    expect(formatCents(15050)).toContain('150,50');
  });

  it('formatea el cero', () => {
    expect(formatCents(0)).toContain('0,00');
  });
});
