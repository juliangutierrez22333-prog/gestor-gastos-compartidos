import { ApiError } from '../errors.js';
import type {
  ExpenseRepository,
  ExpenseRow,
  ExpenseSplitRow,
} from '../repositories/expenseRepository.js';
import type { GroupRepository } from '../repositories/groupRepository.js';
import { splitEqually } from './split.js';

export interface ExpenseSplit {
  userId: number;
  amountCents: number;
}

export interface Expense {
  id: number;
  description: string;
  amountCents: number;
  paidBy: number;
  expenseDate: string;
  createdAt: string;
  splits: ExpenseSplit[];
}

export interface CreateExpenseInput {
  description: string;
  amountCents: number;
  paidBy: number;
  expenseDate?: string | undefined;
  // Exactamente uno de los dos (lo garantiza el esquema de validación):
  // splits = montos explícitos; splitAmong = división en partes iguales
  // calculada por el servidor, dueño de la regla del centavo sobrante.
  splits?: ExpenseSplit[] | undefined;
  splitAmong?: number[] | undefined;
}

function toExpense(row: ExpenseRow, splits: ExpenseSplitRow[]): Expense {
  return {
    id: row.id,
    description: row.description,
    amountCents: row.amount_cents,
    paidBy: row.paid_by,
    expenseDate: row.expense_date,
    createdAt: row.created_at,
    splits: splits.map((s) => ({ userId: s.user_id, amountCents: s.amount_cents })),
  };
}

export class ExpenseService {
  constructor(
    private readonly expenses: ExpenseRepository,
    private readonly groups: GroupRepository,
  ) {}

  createExpense(groupId: number, input: CreateExpenseInput): Expense {
    const memberIds = new Set(this.groups.listMembers(groupId).map((m) => m.user_id));

    if (!memberIds.has(input.paidBy)) {
      throw ApiError.badRequest('Quien pagó debe ser miembro del grupo');
    }

    const splits = this.resolveSplits(input, memberIds);

    const row = this.expenses.create({
      groupId,
      paidBy: input.paidBy,
      description: input.description,
      amountCents: input.amountCents,
      expenseDate: input.expenseDate ?? new Date().toISOString().slice(0, 10),
      splits,
    });
    return toExpense(row, this.expenses.listSplitsByExpense(row.id));
  }

  listExpenses(groupId: number): Expense[] {
    const rows = this.expenses.listByGroup(groupId);
    const splitsByExpense = new Map<number, ExpenseSplitRow[]>();
    for (const split of this.expenses.listSplitsByGroup(groupId)) {
      const list = splitsByExpense.get(split.expense_id) ?? [];
      list.push(split);
      splitsByExpense.set(split.expense_id, list);
    }
    return rows.map((row) => toExpense(row, splitsByExpense.get(row.id) ?? []));
  }

  deleteExpense(groupId: number, expenseId: number, requesterId: number): void {
    const expense = this.expenses.findById(expenseId);
    // Un gasto de otro grupo es "inexistente" para esta ruta: comparar
    // group_id evita acceder a gastos ajenos adivinando ids.
    if (!expense || expense.group_id !== groupId) {
      throw ApiError.notFound('Gasto no encontrado');
    }
    const group = this.groups.findById(groupId);
    if (!group) {
      throw ApiError.notFound('Grupo no encontrado');
    }
    if (requesterId !== expense.paid_by && requesterId !== group.created_by) {
      throw ApiError.forbidden('Solo quien pagó o el creador del grupo pueden eliminar un gasto');
    }
    this.expenses.delete(expenseId);
  }

  private resolveSplits(input: CreateExpenseInput, memberIds: Set<number>): ExpenseSplit[] {
    if (input.splits) {
      const ids = input.splits.map((s) => s.userId);
      if (new Set(ids).size !== ids.length) {
        throw ApiError.badRequest('Hay participantes repetidos en la división');
      }
      if (!ids.every((id) => memberIds.has(id))) {
        throw ApiError.badRequest('Todos los participantes deben ser miembros del grupo');
      }
      const total = input.splits.reduce((sum, s) => sum + s.amountCents, 0);
      if (total !== input.amountCents) {
        throw ApiError.badRequest(
          `La suma de la división (${total}) no coincide con el monto del gasto (${input.amountCents})`,
        );
      }
      return input.splits;
    }

    if (input.splitAmong) {
      if (new Set(input.splitAmong).size !== input.splitAmong.length) {
        throw ApiError.badRequest('Hay participantes repetidos en la división');
      }
      if (!input.splitAmong.every((id) => memberIds.has(id))) {
        throw ApiError.badRequest('Todos los participantes deben ser miembros del grupo');
      }
      return splitEqually(input.amountCents, input.splitAmong);
    }

    throw ApiError.badRequest('Indicá cómo dividir el gasto (splits o splitAmong)');
  }
}
