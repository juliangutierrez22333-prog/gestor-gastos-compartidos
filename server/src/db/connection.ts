import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { runMigrations } from './migrations.js';

export function createDb(filename: string): DatabaseSync {
  if (filename !== ':memory:') {
    fs.mkdirSync(path.dirname(filename), { recursive: true });
  }

  // node:sqlite habilita las foreign keys por defecto (a diferencia del SQLite crudo).
  const db = new DatabaseSync(filename);

  // WAL permite lecturas concurrentes mientras se escribe.
  db.exec('PRAGMA journal_mode = WAL;');

  runMigrations(db);
  return db;
}
