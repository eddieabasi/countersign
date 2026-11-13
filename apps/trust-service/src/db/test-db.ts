import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { MIGRATIONS_DIR, schema, type Db } from './client.ts';

/**
 * In-process Postgres (PGlite = real Postgres compiled to WASM) with our real migrations applied.
 * For tests only — not a mock: same SQL, same constraints as production Postgres.
 */
export async function createTestDb(): Promise<{ db: Db; close: () => Promise<void> }> {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: MIGRATIONS_DIR });
  return { db: db as unknown as Db, close: () => client.close() };
}
