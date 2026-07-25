import { describe, expect, it } from 'vitest';

import { splitEqually } from '../src/services/split.js';

describe('splitEqually', () => {
  it('divide un monto exacto en partes iguales', () => {
    expect(splitEqually(9000, [1, 2, 3])).toEqual([
      { userId: 1, amountCents: 3000 },
      { userId: 2, amountCents: 3000 },
      { userId: 3, amountCents: 3000 },
    ]);
  });

  it('asigna el centavo sobrante a los primeros userIds', () => {
    // 10000 / 3 = 3333.33...: dos personas pagan 3333 y una paga 3334.
    expect(splitEqually(10000, [3, 1, 2])).toEqual([
      { userId: 1, amountCents: 3334 },
      { userId: 2, amountCents: 3333 },
      { userId: 3, amountCents: 3333 },
    ]);
  });

  it('es determinista sin importar el orden de entrada', () => {
    expect(splitEqually(10000, [3, 1, 2])).toEqual(splitEqually(10000, [2, 3, 1]));
  });

  it('maneja montos menores que la cantidad de participantes', () => {
    expect(splitEqually(2, [10, 20, 30])).toEqual([
      { userId: 10, amountCents: 1 },
      { userId: 20, amountCents: 1 },
      { userId: 30, amountCents: 0 },
    ]);
  });

  it('con un solo participante le asigna todo', () => {
    expect(splitEqually(999, [7])).toEqual([{ userId: 7, amountCents: 999 }]);
  });

  it('la suma de las partes siempre es igual al monto', () => {
    // Barrido de casos: la invariante debe cumplirse para cualquier resto.
    const participantes = [1, 2, 3, 4, 5, 6, 7];
    for (let monto = 1; monto <= 500; monto++) {
      const total = splitEqually(monto, participantes).reduce((sum, s) => sum + s.amountCents, 0);
      expect(total).toBe(monto);
    }
  });

  it('rechaza una lista vacía de participantes', () => {
    expect(() => splitEqually(1000, [])).toThrow();
  });
});
