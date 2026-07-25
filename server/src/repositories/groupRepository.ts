import type { DatabaseSync } from 'node:sqlite';

export interface GroupRow {
  id: number;
  name: string;
  created_by: number;
  created_at: string;
}

export interface GroupMemberRow {
  user_id: number;
  name: string;
  email: string;
  joined_at: string;
}

export class GroupRepository {
  constructor(private readonly db: DatabaseSync) {}

  // Crear el grupo y sumar al creador como miembro es una sola operación
  // atómica: no puede existir un grupo sin su creador dentro.
  create(name: string, createdBy: number): GroupRow {
    this.db.exec('BEGIN');
    try {
      const result = this.db
        .prepare('INSERT INTO groups (name, created_by) VALUES (?, ?)')
        .run(name, createdBy);
      const groupId = Number(result.lastInsertRowid);
      this.db
        .prepare('INSERT INTO group_members (group_id, user_id) VALUES (?, ?)')
        .run(groupId, createdBy);
      this.db.exec('COMMIT');

      const group = this.findById(groupId);
      if (!group) {
        throw new Error('No se pudo leer el grupo recién creado');
      }
      return group;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  findById(id: number): GroupRow | undefined {
    return this.db.prepare('SELECT * FROM groups WHERE id = ?').get(id) as GroupRow | undefined;
  }

  listByUser(userId: number): GroupRow[] {
    return this.db
      .prepare(
        `SELECT g.*
         FROM groups g
         JOIN group_members gm ON gm.group_id = g.id
         WHERE gm.user_id = ?
         ORDER BY g.created_at DESC, g.id DESC`,
      )
      .all(userId) as unknown as GroupRow[];
  }

  isMember(groupId: number, userId: number): boolean {
    const row = this.db
      .prepare('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?')
      .get(groupId, userId);
    return row !== undefined;
  }

  listMembers(groupId: number): GroupMemberRow[] {
    return this.db
      .prepare(
        `SELECT u.id AS user_id, u.name, u.email, gm.joined_at
         FROM group_members gm
         JOIN users u ON u.id = gm.user_id
         WHERE gm.group_id = ?
         ORDER BY gm.joined_at, u.id`,
      )
      .all(groupId) as unknown as GroupMemberRow[];
  }

  addMember(groupId: number, userId: number): void {
    this.db
      .prepare('INSERT INTO group_members (group_id, user_id) VALUES (?, ?)')
      .run(groupId, userId);
  }

  removeMember(groupId: number, userId: number): void {
    this.db
      .prepare('DELETE FROM group_members WHERE group_id = ? AND user_id = ?')
      .run(groupId, userId);
  }
}
