import type { Expense } from '../types/api';
import { api } from './client';

export interface CreateExpenseInput {
  description: string;
  amountCents: number;
  paidBy: number;
  expenseDate?: string;
  // La UI actual siempre divide en partes iguales; el servidor es el dueño
  // de la regla de redondeo (ver DESIGN.md).
  splitAmong: number[];
}

export function listExpenses(groupId: number): Promise<{ expenses: Expense[] }> {
  return api<{ expenses: Expense[] }>(`/api/groups/${groupId}/expenses`);
}

export function createExpense(
  groupId: number,
  input: CreateExpenseInput,
): Promise<{ expense: Expense }> {
  return api<{ expense: Expense }>(`/api/groups/${groupId}/expenses`, {
    method: 'POST',
    body: input,
  });
}

export function deleteExpense(groupId: number, expenseId: number): Promise<void> {
  return api<void>(`/api/groups/${groupId}/expenses/${expenseId}`, { method: 'DELETE' });
}
