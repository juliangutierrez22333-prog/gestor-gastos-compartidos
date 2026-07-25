export interface SplitEntry {
  userId: number;
  amountCents: number;
}

// División en partes iguales con centavos enteros: como amountCents / n rara
// vez es exacto, los primeros (amountCents % n) participantes en orden
// ascendente de userId reciben un centavo extra. La regla es arbitraria pero
// determinista: la misma entrada produce siempre la misma división, y la
// suma de las partes es exactamente amountCents (invariante del sistema).
export function splitEqually(amountCents: number, userIds: number[]): SplitEntry[] {
  if (userIds.length === 0) {
    throw new Error('splitEqually requiere al menos un participante');
  }
  const sorted = [...userIds].sort((a, b) => a - b);
  const base = Math.floor(amountCents / sorted.length);
  const remainder = amountCents % sorted.length;

  return sorted.map((userId, index) => ({
    userId,
    amountCents: base + (index < remainder ? 1 : 0),
  }));
}
