import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema.js';
import { getEnv } from '../config/env.js';

let db: ReturnType<typeof drizzle<typeof schema>> | null = null;
let pool: pg.Pool | null = null;

export function getDb() {
  if (db) return db;
  const env = getEnv();
  pool = new pg.Pool({ connectionString: env.DATABASE_URL });
  db = drizzle(pool, { schema });
  return db;
}

export async function closeDb() {
  if (pool) {
    await pool.end();
    pool = null;
    db = null;
  }
}
