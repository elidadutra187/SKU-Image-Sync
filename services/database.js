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
      demo_batches_used integer not null default 0,
      paid_at timestamptz,
      payment_reference text unique
    )
  `);
  // Preserve consumption from the previous one-batch demo when migrating.
  await client.query('alter table image_sync_access add column if not exists demo_batches_used integer');
  await client.query(`update image_sync_access set demo_batches_used=
    case when demo_used_at is null then 0 else 1 end where demo_batches_used is null`);
  await client.query('alter table image_sync_access alter column demo_batches_used set default 0');
  await client.query('alter table image_sync_access alter column demo_batches_used set not null');
  initialized = true;
}

