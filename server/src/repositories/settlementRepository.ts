import type { DatabaseSync } from 'node:sqlite';

export interface SettlementRow {
  id: number;
  group_id: number;
  from_user: number;
  to_user: number;
  amount_cents: number;
  created_at: string;
}

export class SettlementRepository {
  constructor(private readonly db: DatabaseSync) {}

  create(groupId: number, fromUser: number, toUser: number, amountCents: number): SettlementRow {
    const result = this.db
      .prepare(
        'INSERT INTO settlements (group_id, from_user, to_user, amount_cents) VALUES (?, ?, ?, ?)',
      )
      .run(groupId, fromUser, toUser, amountCents);

    const settlement = this.findById(Number(result.lastInsertRowid));
    if (!settlement) {
      throw new Error('No se pudo leer el pago recién creado');
    }
    return settlement;
  }

  findById(id: number): SettlementRow | undefined {
    return this.db.prepare('SELECT * FROM settlements WHERE id = ?').get(id) as
      | SettlementRow
      | undefined;
  }

  listByGroup(groupId: number): SettlementRow[] {
    return this.db
      .prepare('SELECT * FROM settlements WHERE group_id = ? ORDER BY created_at DESC, id DESC')
      .all(groupId) as unknown as SettlementRow[];
  }
}
