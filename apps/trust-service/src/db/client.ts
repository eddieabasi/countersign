import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import pg from 'pg';
import * as schema from './schema.ts';

/** Any Drizzle Postgres database over our schema (node-postgres at runtime, PGlite in tests). */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

export const MIGRATIONS_DIR = fileURLToPath(new URL('../../drizzle', import.meta.url));

/** Connect to Postgres and apply pending migrations. */
export async function connectDb(
  databaseUrl: string,
): Promise<{ db: Db; close: () => Promise<void> }> {
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 10 });
  const db = drizzle(pool, { schema });
  await migrate(db, { migrationsFolder: MIGRATIONS_DIR });
  return { db, close: () => pool.end() };
}

export { schema };
