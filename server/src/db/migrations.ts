import type { DatabaseSync } from 'node:sqlite';

interface Migration {
  id: number;
  name: string;
  up: string;
}

// Las migraciones son append-only: una migración ya aplicada nunca se edita,
// los cambios de esquema posteriores se agregan como una migración nueva.
const migrations: Migration[] = [
  {
    id: 1,
    name: 'create-users',
    up: `
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL COLLATE NOCASE UNIQUE,
        password_hash TEXT NOT NULL,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      ) STRICT;
    `,
  },
  {
    id: 2,
    name: 'create-groups',
    up: `
      CREATE TABLE groups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        created_by INTEGER NOT NULL REFERENCES users(id),
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      ) STRICT;

      -- La clave primaria compuesta hace imposible la membresía duplicada.
      CREATE TABLE group_members (
        group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id),
        joined_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        PRIMARY KEY (group_id, user_id)
      ) STRICT;

      -- "Mis grupos" busca por user_id, que no es prefijo de la PK compuesta.
      CREATE INDEX idx_group_members_user ON group_members(user_id);
    `,
  },
  {
    id: 3,
    name: 'create-expenses',
    up: `
      CREATE TABLE expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
        paid_by INTEGER NOT NULL REFERENCES users(id),
        description TEXT NOT NULL,
        amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
        expense_date TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      ) STRICT;

      CREATE INDEX idx_expenses_group ON expenses(group_id);

      -- Cuánto le corresponde a cada participante de un gasto. Un monto 0 es
      -- válido: aparece al repartir montos menores que la cantidad de personas.
      CREATE TABLE expense_splits (
        expense_id INTEGER NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id),
        amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
        PRIMARY KEY (expense_id, user_id)
      ) STRICT;
    `,
  },
  {
    id: 4,
    name: 'create-settlements',
    up: `
      -- Pagos reales entre miembros para saldar deudas. Concepto distinto de
      -- un gasto compartido: transferencia directa de una persona a otra.
      CREATE TABLE settlements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
        from_user INTEGER NOT NULL REFERENCES users(id),
        to_user INTEGER NOT NULL REFERENCES users(id),
        amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        CHECK (from_user <> to_user)
      ) STRICT;

      CREATE INDEX idx_settlements_group ON settlements(group_id);
    `,
  },
];

export function runMigrations(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ) STRICT;
  `);

  const rows = db.prepare('SELECT id FROM schema_migrations').all() as { id: number }[];
  const applied = new Set(rows.map((row) => row.id));

  for (const migration of migrations) {
    if (applied.has(migration.id)) continue;

    db.exec('BEGIN');
    try {
      db.exec(migration.up);
      db.prepare('INSERT INTO schema_migrations (id, name) VALUES (?, ?)').run(
        migration.id,
        migration.name,
      );
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }
}
