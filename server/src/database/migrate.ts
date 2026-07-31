import { readdir, readFile, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getPool } from './client.js';

const ADVISORY_LOCK_KEY = 727_201; // Collectab schema migrations

async function resolveMigrationsDir(): Promise<string> {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    join(here, 'migrations'),
    join(process.cwd(), 'src/database/migrations'),
    join(process.cwd(), 'database/migrations'),
  ];
  for (const dir of candidates) {
    try {
      await access(dir);
      return dir;
    } catch {
      // try next
    }
  }
  throw new Error(
    `Migrations directory not found. Looked in:\n${candidates.map((c) => `  - ${c}`).join('\n')}`,
  );
}

/**
 * Apply pending *.sql migrations in lexical order.
 * Tracks applied files in schema_migrations. Safe to call on every startup.
 */
export async function runMigrations(): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('SELECT pg_advisory_lock($1)', [ADVISORY_LOCK_KEY]);

    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const { rows } = await client.query<{ id: string }>('SELECT id FROM schema_migrations');
    const applied = new Set(rows.map((r) => r.id));

    const dir = await resolveMigrationsDir();
    const files = (await readdir(dir))
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      if (applied.has(file)) continue;

      const sql = await readFile(join(dir, file), 'utf8');
      console.log(`Applying migration ${file}…`);
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (id) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`Applied migration ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    }
  } finally {
    try {
      await client.query('SELECT pg_advisory_unlock($1)', [ADVISORY_LOCK_KEY]);
    } catch {
      // ignore unlock errors on disconnect
    }
    client.release();
  }
}

const entry = process.argv[1]?.replace(/\\/g, '/');
if (entry && (entry.endsWith('/migrate.ts') || entry.endsWith('/migrate.js'))) {
  runMigrations()
    .then(() => {
      console.log('Migrations up to date');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}
