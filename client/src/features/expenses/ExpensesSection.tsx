import { useCallback, useEffect, useState, type FormEvent } from 'react';

import { errorMessage } from '../../api/client';
import * as expensesApi from '../../api/expenses';
import type { Expense, GroupMember } from '../../types/api';
import { formatDateOnly } from '../../utils/date';
import { formatCents, parseAmountToCents } from '../../utils/money';

interface Props {
  groupId: number;
  members: GroupMember[];
  currentUserId: number;
  groupCreatorId: number;
  // Avisa al padre que los balances quedaron desactualizados.
  onChanged: () => void;
}

export function ExpensesSection({
  groupId,
  members,
  currentUserId,
  groupCreatorId,
  onChanged,
}: Props) {
  const [expenses, setExpenses] = useState<Expense[] | null>(null);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [paidBy, setPaidBy] = useState(currentUserId);
  const [participants, setParticipants] = useState<Set<number>>(
    () => new Set(members.map((m) => m.id)),
  );
  const [error, setError] = useState('');

  const reload = useCallback(() => {
    return expensesApi
      .listExpenses(groupId)
      .then((res) => setExpenses(res.expenses))
      .catch((err: unknown) => setError(errorMessage(err)));
  }, [groupId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const nameOf = (userId: number): string =>
    members.find((m) => m.id === userId)?.name ?? `Usuario ${userId}`;

  function toggleParticipant(userId: number) {
    setParticipants((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setError('');

    const amountCents = parseAmountToCents(amount);
    if (amountCents === null || amountCents <= 0) {
      setError('Monto inválido: usá números con hasta dos decimales, ej. 1250,50');
      return;
    }
    if (participants.size === 0) {
      setError('Elegí al menos un participante');
      return;
    }

    try {
      await expensesApi.createExpense(groupId, {
        description,
        amountCents,
        paidBy,
        splitAmong: [...participants],
      });
      setDescription('');
      setAmount('');
      await reload();
      onChanged();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function handleDelete(expenseId: number) {
    if (!window.confirm('¿Eliminar este gasto? Los balances se recalculan.')) {
      return;
    }
    setError('');
    try {
      await expensesApi.deleteExpense(groupId, expenseId);
      await reload();
      onChanged();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <section>
      <h2>Gastos</h2>

      <form className="expense-form" onSubmit={handleCreate}>
        <div className="field-row">
          <input
            type="text"
            placeholder="¿Qué se pagó? (ej. Supermercado)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            maxLength={200}
          />
          <input
            type="text"
            inputMode="decimal"
            placeholder="Monto, ej. 1250,50"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </div>

        <label className="select-label">
          Pagó
          <select value={paidBy} onChange={(e) => setPaidBy(Number(e.target.value))}>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>

        <fieldset className="participants">
          <legend>Dividir en partes iguales entre:</legend>
          {members.map((m) => (
            <label key={m.id} className="checkbox-label">
              <input
                type="checkbox"
                checked={participants.has(m.id)}
                onChange={() => toggleParticipant(m.id)}
              />
              {m.name}
            </label>
          ))}
        </fieldset>

        <button type="submit">Registrar gasto</button>
      </form>

      {error && <p className="error-message">{error}</p>}

      {expenses === null ? (
        <p className="status-message">Cargando gastos…</p>
      ) : expenses.length === 0 ? (
        <p className="status-message">Todavía no hay gastos registrados.</p>
      ) : (
        <ul className="expense-list">
          {expenses.map((expense) => {
            const puedoBorrar =
              expense.paidBy === currentUserId || currentUserId === groupCreatorId;
            return (
              <li key={expense.id}>
                <div>
                  <span className="card-title">{expense.description}</span>
                  <span className="card-meta">
                    {' '}
                    — pagó {nameOf(expense.paidBy)} el {formatDateOnly(expense.expenseDate)} ·
                    entre {expense.splits.length}
                  </span>
                </div>
                <div className="expense-side">
                  <strong>{formatCents(expense.amountCents)}</strong>
                  {puedoBorrar && (
                    <button
                      type="button"
                      className="link-button"
                      onClick={() => void handleDelete(expense.id)}
                    >
                      Eliminar
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
