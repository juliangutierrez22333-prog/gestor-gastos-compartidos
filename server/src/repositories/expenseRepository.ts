import type { DatabaseSync } from 'node:sqlite';

export interface ExpenseRow {
  id: number;
  group_id: number;
  paid_by: number;
  description: string;
  amount_cents: number;
  expense_date: string;
  created_at: string;
}

export interface ExpenseSplitRow {
  expense_id: number;
  user_id: number;
  amount_cents: number;
}

export interface CreateExpenseData {
  groupId: number;
  paidBy: number;
  description: string;
  amountCents: number;
  expenseDate: string;
  splits: { userId: number; amountCents: number }[];
}

export class ExpenseRepository {
  constructor(private readonly db: DatabaseSync) {}

  // Gasto y divisiones se insertan en una transacción: un gasto sin sus
  // splits rompería la invariante suma(splits) = monto.
  create(data: CreateExpenseData): ExpenseRow {
    this.db.exec('BEGIN');
    try {
      const result = this.db
        .prepare(
          `INSERT INTO expenses (group_id, paid_by, description, amount_cents, expense_date)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .run(data.groupId, data.paidBy, data.description, data.amountCents, data.expenseDate);
      const expenseId = Number(result.lastInsertRowid);

      const insertSplit = this.db.prepare(
        'INSERT INTO expense_splits (expense_id, user_id, amount_cents) VALUES (?, ?, ?)',
      );
      for (const split of data.splits) {
        insertSplit.run(expenseId, split.userId, split.amountCents);
      }
      this.db.exec('COMMIT');

      const expense = this.findById(expenseId);
      if (!expense) {
        throw new Error('No se pudo leer el gasto recién creado');
      }
      return expense;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  findById(id: number): ExpenseRow | undefined {
    return this.db.prepare('SELECT * FROM expenses WHERE id = ?').get(id) as
      | ExpenseRow
      | undefined;
  }

  listByGroup(groupId: number): ExpenseRow[] {
    return this.db
      .prepare(
        `SELECT * FROM expenses
         WHERE group_id = ?
         ORDER BY expense_date DESC, id DESC`,
      )
      .all(groupId) as unknown as ExpenseRow[];
  }

  // Todos los splits del grupo en una sola consulta: evita el clásico N+1
  // de pedir los splits gasto por gasto al armar el listado.
  listSplitsByGroup(groupId: number): ExpenseSplitRow[] {
    return this.db
      .prepare(
        `SELECT es.*
         FROM expense_splits es
         JOIN expenses e ON e.id = es.expense_id
         WHERE e.group_id = ?`,
      )
      .all(groupId) as unknown as ExpenseSplitRow[];
  }

  listSplitsByExpense(expenseId: number): ExpenseSplitRow[] {
    return this.db
      .prepare('SELECT * FROM expense_splits WHERE expense_id = ?')
      .all(expenseId) as unknown as ExpenseSplitRow[];
  }

  delete(id: number): void {
    // ON DELETE CASCADE elimina los splits asociados.
    this.db.prepare('DELETE FROM expenses WHERE id = ?').run(id);
  }
}
