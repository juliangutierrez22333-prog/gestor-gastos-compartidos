import { describe, expect, it } from 'vitest';

import {
  computeNetBalances,
  suggestSettlements,
  type BalanceInput,
  type NetBalance,
} from '../src/services/balance.js';

const sinMovimientos: Omit<BalanceInput, 'memberIds'> = {
  payments: [],
  shares: [],
  settlements: [],
};

function sumaTotal(balances: NetBalance[]): number {
  return balances.reduce((sum, b) => sum + b.netCents, 0);
}

// Simula ejecutar las transferencias sugeridas sobre los balances y
// devuelve los saldos resultantes: deben quedar todos en cero.
function aplicarTransferencias(
  balances: NetBalance[],
  transfers: { fromUser: number; toUser: number; amountCents: number }[],
): Map<number, number> {
  const saldo = new Map(balances.map((b) => [b.userId, b.netCents]));
  for (const t of transfers) {
    saldo.set(t.fromUser, (saldo.get(t.fromUser) ?? 0) + t.amountCents);
    saldo.set(t.toUser, (saldo.get(t.toUser) ?? 0) - t.amountCents);
  }
  return saldo;
}

describe('computeNetBalances', () => {
  it('sin movimientos, todos los miembros están en cero', () => {
    const balances = computeNetBalances({ memberIds: [1, 2, 3], ...sinMovimientos });

    expect(balances).toEqual([
      { userId: 1, netCents: 0 },
      { userId: 2, netCents: 0 },
      { userId: 3, netCents: 0 },
    ]);
  });

  it('quien paga queda acreedor por lo que consumen los demás', () => {
    // Ana (1) paga 9000 dividido en partes iguales entre los tres.
    const balances = computeNetBalances({
      memberIds: [1, 2, 3],
      payments: [{ userId: 1, amountCents: 9000 }],
      shares: [
        { userId: 1, amountCents: 3000 },
        { userId: 2, amountCents: 3000 },
        { userId: 3, amountCents: 3000 },
      ],
      settlements: [],
    });

    expect(balances).toEqual([
      { userId: 1, netCents: 6000 },
      { userId: 2, netCents: -3000 },
      { userId: 3, netCents: -3000 },
    ]);
  });

  it('un pago directo sube el balance del emisor y baja el del receptor', () => {
    // Beto (2) le debe 3000 a Ana (1) y se los paga: ambos quedan en cero.
    const balances = computeNetBalances({
      memberIds: [1, 2],
      payments: [{ userId: 1, amountCents: 6000 }],
      shares: [
        { userId: 1, amountCents: 3000 },
        { userId: 2, amountCents: 3000 },
      ],
      settlements: [{ fromUser: 2, toUser: 1, amountCents: 3000 }],
    });

    expect(balances).toEqual([
      { userId: 1, netCents: 0 },
      { userId: 2, netCents: 0 },
    ]);
  });

  it('incluye a ex-miembros que aparecen en los movimientos históricos', () => {
    // El usuario 9 ya no es miembro pero pagó un gasto en su momento.
    const balances = computeNetBalances({
      memberIds: [1, 2],
      payments: [{ userId: 9, amountCents: 3000 }],
      shares: [
        { userId: 1, amountCents: 1500 },
        { userId: 2, amountCents: 1500 },
      ],
      settlements: [],
    });

    expect(balances.map((b) => b.userId)).toEqual([1, 2, 9]);
    expect(sumaTotal(balances)).toBe(0);
  });

  it('la suma de todos los balances siempre es cero', () => {
    const balances = computeNetBalances({
      memberIds: [1, 2, 3, 4],
      payments: [
        { userId: 1, amountCents: 10000 },
        { userId: 2, amountCents: 7331 },
        { userId: 3, amountCents: 1 },
      ],
      shares: [
        { userId: 1, amountCents: 2500 },
        { userId: 2, amountCents: 2500 },
        { userId: 3, amountCents: 2500 },
        { userId: 4, amountCents: 2500 },
        { userId: 1, amountCents: 2444 },
        { userId: 2, amountCents: 2444 },
        { userId: 3, amountCents: 2443 },
        { userId: 4, amountCents: 1 },
      ],
      settlements: [
        { fromUser: 4, toUser: 1, amountCents: 1200 },
        { fromUser: 3, toUser: 2, amountCents: 777 },
      ],
    });

    expect(sumaTotal(balances)).toBe(0);
  });
});

describe('suggestSettlements', () => {
  it('sin deudas no sugiere transferencias', () => {
    expect(suggestSettlements([{ userId: 1, netCents: 0 }])).toEqual([]);
  });

  it('caso simple: dos deudores le pagan al único acreedor', () => {
    const transfers = suggestSettlements([
      { userId: 1, netCents: 6000 },
      { userId: 2, netCents: -3000 },
      { userId: 3, netCents: -3000 },
    ]);

    expect(transfers).toEqual([
      { fromUser: 2, toUser: 1, amountCents: 3000 },
      { fromUser: 3, toUser: 1, amountCents: 3000 },
    ]);
  });

  it('encadena deudas: A debe a B y B debe a C se resuelve sin pasar por B', () => {
    // B está en cero neto: prestó tanto como debe. El greedy lo saltea.
    const transfers = suggestSettlements([
      { userId: 1, netCents: -5000 },
      { userId: 2, netCents: 0 },
      { userId: 3, netCents: 5000 },
    ]);

    expect(transfers).toEqual([{ fromUser: 1, toUser: 3, amountCents: 5000 }]);
  });

  it('nunca sugiere más de N−1 transferencias', () => {
    const balances = [
      { userId: 1, netCents: 9999 },
      { userId: 2, netCents: -3333 },
      { userId: 3, netCents: -3333 },
      { userId: 4, netCents: -3333 },
      { userId: 5, netCents: 700 },
      { userId: 6, netCents: -700 },
    ];

    expect(suggestSettlements(balances).length).toBeLessThanOrEqual(balances.length - 1);
  });

  it('aplicar las transferencias sugeridas deja todos los saldos en cero', () => {
    const balances = [
      { userId: 1, netCents: 5050 },
      { userId: 2, netCents: -2000 },
      { userId: 3, netCents: -1017 },
      { userId: 4, netCents: -2033 },
      { userId: 5, netCents: 0 },
    ];

    const saldos = aplicarTransferencias(balances, suggestSettlements(balances));

    for (const [, saldo] of saldos) {
      expect(saldo).toBe(0);
    }
  });

  it('es determinista ante montos empatados (desempata por userId)', () => {
    const balances = [
      { userId: 4, netCents: -1000 },
      { userId: 2, netCents: -1000 },
      { userId: 3, netCents: 1000 },
      { userId: 1, netCents: 1000 },
    ];

    expect(suggestSettlements(balances)).toEqual([
      { fromUser: 2, toUser: 1, amountCents: 1000 },
      { fromUser: 4, toUser: 3, amountCents: 1000 },
    ]);
  });

  it('propiedad: para escenarios variados, saldos finales en cero y ≤ N−1 pagos', () => {
    // Generador pseudoaleatorio determinista (LCG): reproducible en CI.
    let seed = 42;
    const rand = (max: number): number => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed % max;
    };

    for (let caso = 0; caso < 200; caso++) {
      const n = 2 + rand(6);
      const balances: NetBalance[] = [];
      let acumulado = 0;
      for (let userId = 1; userId < n; userId++) {
        const monto = rand(20001) - 10000;
        balances.push({ userId, netCents: monto });
        acumulado += monto;
      }
      // El último usuario compensa para que la suma dé exactamente cero.
      balances.push({ userId: n, netCents: -acumulado });

      const transfers = suggestSettlements(balances);
      const saldos = aplicarTransferencias(balances, transfers);

      expect(transfers.length).toBeLessThanOrEqual(n - 1);
      for (const [, saldo] of saldos) {
        expect(saldo).toBe(0);
      }
      for (const t of transfers) {
        expect(t.amountCents).toBeGreaterThan(0);
      }
    }
  });
});
