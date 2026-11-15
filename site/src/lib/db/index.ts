import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { readConfig } from '../config';
import * as schema from './schema';

export type Db = ReturnType<typeof createDb>;

function createDb(sqlite: Database.Database) {
  return drizzle(sqlite, { schema });
}

export function openDb(dataDir: string): Db {
  mkdirSync(dataDir, { recursive: true });
  const sqlite = new Database(join(dataDir, 'app.db'));
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  const db = createDb(sqlite);
  migrate(db, { migrationsFolder: resolve(process.cwd(), 'drizzle') });
  return db;
}

let instance: Db | undefined;

export function getDb(): Db {
  instance ??= openDb(readConfig().dataDir);
  return instance;
}

export function closeDb(): void {
  instance?.$client.close();
  instance = undefined;
}
