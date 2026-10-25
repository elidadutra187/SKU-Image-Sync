import pg from 'pg';

const { Pool } = pg;
let pool = null;
let initialization = null;

export function hasDatabase() {
  if (process.env.NODE_ENV === 'production' && !process.env.DATABASE_URL) {
    throw Object.assign(new Error('persistent_database_unavailable'), { status: 503 });
  }
  return Boolean(process.env.DATABASE_URL);
}

export function getPool() {
  if (!hasDatabase()) return null;

  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: true },
      max: 5,
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000,
      query_timeout: 30000,
    });
    pool.on('error', () => console.error('Conexão de banco temporariamente indisponível.'));
  }

  return pool;
}

export async function initializeDatabase() {
  const client = getPool();
  if (!client) return;
  if (!initialization) initialization = migrateDatabase(client).catch(error => { initialization = null; throw error; });
  await initialization;
}

export async function migrateDatabase(client) {

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
  await client.query(`create table if not exists image_sync_history (
    store_id text not null, product_key text not null, state jsonb not null,
    updated_at timestamptz not null default now(), primary key (store_id,product_key)
  )`);
  await client.query(`create table if not exists image_sync_purchase (
    store_id text primary key,status text not null,charge_id text unique,
    created_at timestamptz not null default now(),updated_at timestamptz not null default now()
  )`);
}

