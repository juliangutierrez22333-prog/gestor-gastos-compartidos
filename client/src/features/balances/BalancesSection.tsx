import { useCallback, useEffect, useState } from 'react';

import * as balancesApi from '../../api/balances';
import { errorMessage } from '../../api/client';
import type { GroupBalances, Settlement, SuggestedSettlement } from '../../types/api';
import { formatCents } from '../../utils/money';

interface Props {
  groupId: number;
  currentUserId: number;
}

// El padre remonta esta sección (via key) cuando cambian los gastos:
// al montarse siempre trae los balances frescos.
export function BalancesSection({ groupId, currentUserId }: Props) {
  const [data, setData] = useState<GroupBalances | null>(null);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [error, setError] = useState('');

  const reload = useCallback(() => {
    return Promise.all([balancesApi.getBalances(groupId), balancesApi.listSettlements(groupId)])
      .then(([balances, history]) => {
        setData(balances);
        setSettlements(history.settlements);
      })
      .catch((err: unknown) => setError(errorMessage(err)));
  }, [groupId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const nameOf = (userId: number): string =>
    data?.balances.find((b) => b.userId === userId)?.name ?? `Usuario ${userId}`;

  async function handlePay(suggestion: SuggestedSettlement) {
    setError('');
    try {
      await balancesApi.createSettlement(groupId, {
        toUser: suggestion.toUser,
        amountCents: suggestion.amountCents,
      });
      await reload();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  if (!data) {
    return <p className="status-message">Calculando balances…</p>;
  }

  const todosEnCero = data.balances.every((b) => b.netCents === 0);

  return (
    <section>
      <h2>Balances</h2>

      <ul className="balance-list">
        {data.balances.map((balance) => (
          <li key={balance.userId}>
            <span>
              {balance.name}
              {balance.userId === currentUserId && <em className="tag"> vos</em>}
            </span>
            <span
              className={
                balance.netCents > 0
                  ? 'amount-positive'
                  : balance.netCents < 0
                    ? 'amount-negative'
                    : 'amount-zero'
              }
            >
              {balance.netCents > 0 && 'le deben '}
              {balance.netCents < 0 && 'debe '}
              {formatCents(Math.abs(balance.netCents))}
            </span>
          </li>
        ))}
      </ul>

      <h3>Cómo saldar las cuentas</h3>
      {todosEnCero ? (
        <p className="status-message">Todo saldado: nadie le debe nada a nadie. 🎉</p>
      ) : (
        <ul className="suggestion-list">
          {data.suggestedSettlements.map((s) => (
            <li key={`${s.fromUser}-${s.toUser}`}>
              <span>
                {nameOf(s.fromUser)} le paga {formatCents(s.amountCents)} a {nameOf(s.toUser)}
              </span>
              {s.fromUser === currentUserId && (
                <button type="button" onClick={() => void handlePay(s)}>
                  Registrar este pago
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {error && <p className="error-message">{error}</p>}

      {settlements.length > 0 && (
        <>
          <h3>Pagos registrados</h3>
          <ul className="settlement-list">
            {settlements.map((s) => (
              <li key={s.id}>
                {nameOf(s.fromUser)} le pagó {formatCents(s.amountCents)} a {nameOf(s.toUser)}{' '}
                <span className="card-meta">
                  ({new Date(s.createdAt).toLocaleDateString('es')})
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
