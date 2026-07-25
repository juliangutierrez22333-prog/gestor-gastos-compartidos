import type { DatabaseSync } from 'node:sqlite';

export interface UserRow {
  id: number;
  email: string;
  password_hash: string;
  name: string;
  created_at: string;
}

export class UserRepository {
  constructor(private readonly db: DatabaseSync) {}

  create(email: string, name: string, passwordHash: string): UserRow {
    const result = this.db
      .prepare('INSERT INTO users (email, name, password_hash) VALUES (?, ?, ?)')
      .run(email, name, passwordHash);

    const user = this.findById(Number(result.lastInsertRowid));
    if (!user) {
      throw new Error('No se pudo leer el usuario recién creado');
    }
    return user;
  }

  findByEmail(email: string): UserRow | undefined {
    return this.db.prepare('SELECT * FROM users WHERE email = ?').get(email) as
      | UserRow
      | undefined;
  }

  findById(id: number): UserRow | undefined {
    return this.db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined;
  }
}
