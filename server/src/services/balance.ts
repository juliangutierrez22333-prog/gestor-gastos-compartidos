// Algoritmo de balances: funciones puras sin Express ni SQL, el corazón
// del sistema. computeNetBalances deriva el balance neto de cada persona
// y suggestSettlements propone cómo saldarlo en pocas transferencias.

export interface NetBalance {
  userId: number;
  // Positivo: al usuario le deben (acreedor). Negativo: debe (deudor).
  netCents: number;
}

export interface Transfer {
  fromUser: number;
  toUser: number;
  amountCents: number;
}

export interface BalanceInput {
  memberIds: number[];
  // Lo que cada usuario adelantó al pagar gastos.
  payments: { userId: number; amountCents: number }[];
  // Lo que a cada usuario le corresponde consumir de cada gasto.
  shares: { userId: number; amountCents: number }[];
  // Pagos directos ya realizados para saldar deudas.
  settlements: Transfer[];
}

// balance = pagado − consumido + pagos_enviados − pagos_recibidos.
// Enviar un pago sube tu balance (saldás deuda); recibirlo baja el tuyo
// (te están devolviendo lo que te debían). Como cada gasto reparte
// exactamente su monto y cada pago suma cero entre las dos partes, la suma
// de todos los balances es siempre 0 — invariante verificada en tests.
export function computeNetBalances(input: BalanceInput): NetBalance[] {
  const net = new Map<number, number>();
  const add = (userId: number, deltaCents: number): void => {
    net.set(userId, (net.get(userId) ?? 0) + deltaCents);
  };

  // Los miembros actuales aparecen aunque estén en cero; los ex-miembros
  // con gastos históricos también, porque sus movimientos siguen contando.
  for (const id of input.memberIds) add(id, 0);
  for (const payment of input.payments) add(payment.userId, payment.amountCents);
  for (const share of input.shares) add(share.userId, -share.amountCents);
  for (const settlement of input.settlements) {
    add(settlement.fromUser, settlement.amountCents);
    add(settlement.toUser, -settlement.amountCents);
  }

  return [...net.entries()]
    .map(([userId, netCents]) => ({ userId, netCents }))
    .sort((a, b) => a.userId - b.userId);
}

// Greedy: empareja deudores y acreedores de mayor a menor y transfiere el
// mínimo de ambos saldos; cada transferencia deja al menos una de las dos
// partes en cero, lo que garantiza a lo sumo N−1 transferencias para N
// personas. Minimizar el número exacto es NP-difícil (particiones de suma
// cero); este es el estándar práctico. Desempate por userId: determinista.
export function suggestSettlements(balances: NetBalance[]): Transfer[] {
  const debtors = balances
    .filter((b) => b.netCents < 0)
    .map((b) => ({ ...b }))
    .sort((a, b) => a.netCents - b.netCents || a.userId - b.userId);
  const creditors = balances
    .filter((b) => b.netCents > 0)
    .map((b) => ({ ...b }))
    .sort((a, b) => b.netCents - a.netCents || a.userId - b.userId);

  const transfers: Transfer[] = [];
  let d = 0;
  let c = 0;
  while (d < debtors.length && c < creditors.length) {
    const debtor = debtors[d];
    const creditor = creditors[c];
    if (!debtor || !creditor) break;

    const amountCents = Math.min(-debtor.netCents, creditor.netCents);
    transfers.push({ fromUser: debtor.userId, toUser: creditor.userId, amountCents });
    debtor.netCents += amountCents;
    creditor.netCents -= amountCents;

    if (debtor.netCents === 0) d++;
    if (creditor.netCents === 0) c++;
  }
  return transfers;
}
