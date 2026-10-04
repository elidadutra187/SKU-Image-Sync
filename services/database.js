import pg from 'pg';

const { Pool } = pg;
let pool = null;
let initialized = false;

export function hasDatabase() {
  return Boolean(process.env.DATABASE_URL);
}

export function getPool() {
  if (!hasDatabase()) return null;

  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false },
    });
  }

  return pool;
}

export async function initializeDatabase() {
  const client = getPool();
  if (!client || initialized) return;

  await client.query(`
    create table if not exists stores (
      store_id text primary key,
      access_token text not null,
      scopes text,
      installed_at timestamptz,
      updated_at timestamptz not null default now()
    )
  `);

  await client.query(`
    create table if not exists image_sync_access (
      store_id text primary key,
      demo_used_at timestamptz,
      paid_at timestamptz,
      payment_reference text unique
    )
  `);
  initialized = true;
}
