const { Pool, Client } = require('pg');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const PGUSER = process.env.PGUSER || 'postgres';
const PGPASSWORD = process.env.PGPASSWORD || 'password';
const PGHOST = process.env.PGHOST || '127.0.0.1';
const PGPORT = parseInt(process.env.PGPORT || '5432', 10);
const PGDATABASE = process.env.PGDATABASE || 'cinema_booking';

let pool = null;
let embeddedInstance = null;

/**
 * Ensure the target database exists in PostgreSQL
 */
async function ensureDatabaseExists(host, port, user, password, database) {
  const rootClient = new Client({
    host,
    port,
    user,
    password,
    database: 'postgres',
    connectionTimeoutMillis: 3000
  });

  try {
    await rootClient.connect();
    const checkRes = await rootClient.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [database]
    );

    if (checkRes.rows.length === 0) {
      console.log(`[DB] Database "${database}" not found. Creating database...`);
      await rootClient.query(`CREATE DATABASE "${database}"`);
      console.log(`[DB] Database "${database}" created successfully!`);
    }
  } catch (err) {
    console.warn(`[DB] Note during database check:`, err.message);
  } finally {
    await rootClient.end().catch(() => {});
  }
}

/**
 * Attempt to connect to an existing PostgreSQL database
 */
async function tryConnectExisting(host, port, user, password, database) {
  await ensureDatabaseExists(host, port, user, password, database);

  const testPool = new Pool({
    host,
    port,
    user,
    password,
    database,
    connectionTimeoutMillis: 2000,
    max: 25,
    idleTimeoutMillis: 30000
  });

  try {
    const client = await testPool.connect();
    await client.query('SELECT 1');
    client.release();
    return testPool;
  } catch (err) {
    await testPool.end().catch(() => {});
    return null;
  }
}

/**
 * Initialize PostgreSQL connection (External or Embedded)
 */
async function initDatabase() {
  if (pool) return pool;

  // Support cloud database connections (Render, Neon, Supabase, Heroku, AWS RDS)
  if (process.env.DATABASE_URL) {
    console.log(`[DB] Connecting to PostgreSQL via DATABASE_URL...`);
    const sslConfig = process.env.DATABASE_SSL === 'false'
      ? false
      : (process.env.NODE_ENV === 'production' || process.env.DATABASE_URL.includes('sslmode=require') || process.env.DATABASE_URL.includes('render.com') || process.env.DATABASE_URL.includes('supabase') || process.env.DATABASE_URL.includes('neon')
        ? { rejectUnauthorized: false }
        : false);

    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: sslConfig,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000
    });

    const client = await pool.connect();
    await client.query('SELECT 1');
    console.log(`[DB] Connected to PostgreSQL via DATABASE_URL successfully!`);

    // Check if tables already exist; if not, run migrations automatically
    const tableCheck = await client.query(`
      SELECT to_regclass('public.movies') AS has_movies
    `);
    const needsMigration = !tableCheck.rows[0].has_movies;
    client.release();

    if (needsMigration) {
      console.log(`[DB] Tables not found. Running automatic schema migration & seed...`);
      const { runMigrations } = require('../database/migrate');
      await runMigrations(pool);
    }

    return pool;
  }

  console.log(`[DB] Checking PostgreSQL connection at ${PGHOST}:${PGPORT}/${PGDATABASE}...`);
  pool = await tryConnectExisting(PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE);

  if (pool) {
    console.log(`[DB] Connected to PostgreSQL server on ${PGHOST}:${PGPORT}`);
    return pool;
  }

  // If external connection failed, use embedded-postgres
  console.log(`[DB] Standalone PostgreSQL not detected. Starting Embedded PostgreSQL server...`);
  try {
    const EmbeddedPostgres = require('embedded-postgres').default;
    const dbDir = path.resolve(__dirname, '../pgdata');
    const isNew = !fs.existsSync(dbDir);

    embeddedInstance = new EmbeddedPostgres({
      port: PGPORT,
      databaseDir: dbDir,
      user: PGUSER,
      password: PGPASSWORD,
      persistent: true
    });

    if (isNew) {
      console.log(`[DB] Initializing embedded cluster at ${dbDir}...`);
      await embeddedInstance.initialise();
    }

    console.log(`[DB] Starting embedded PostgreSQL service on port ${PGPORT}...`);
    await embeddedInstance.start();
    console.log(`[DB] Embedded PostgreSQL started successfully!`);

    // Ensure cinema_booking database is created
    await ensureDatabaseExists('127.0.0.1', PGPORT, PGUSER, PGPASSWORD, PGDATABASE);

    pool = new Pool({
      host: '127.0.0.1',
      port: PGPORT,
      user: PGUSER,
      password: PGPASSWORD,
      database: PGDATABASE,
      max: 25,
      idleTimeoutMillis: 30000
    });

    // Check if tables already exist; if not, run migrations
    const client = await pool.connect();
    const tableCheck = await client.query(`
      SELECT to_regclass('public.movies') AS has_movies
    `);
    const needsMigration = !tableCheck.rows[0].has_movies;
    client.release();

    if (needsMigration) {
      console.log(`[DB] Tables not found. Running automatic schema migration...`);
      const { runMigrations } = require('../database/migrate');
      await runMigrations(pool);
    }

    return pool;
  } catch (err) {
    console.error(`[DB] Fatal: Could not establish PostgreSQL connection:`, err);
    throw err;
  }
}

/**
 * Acquire a dedicated client from the pool for transactions
 */
async function getClient() {
  if (!pool) {
    await initDatabase();
  }
  return await pool.connect();
}

/**
 * Execute a standard single query with the pool
 */
async function query(text, params) {
  if (!pool) {
    await initDatabase();
  }
  return await pool.query(text, params);
}

/**
 * Graceful shutdown
 */
async function close() {
  if (pool) {
    await pool.end();
    pool = null;
  }
  if (embeddedInstance) {
    console.log('[DB] Stopping embedded PostgreSQL service...');
    await embeddedInstance.stop();
    embeddedInstance = null;
  }
}

module.exports = {
  initDatabase,
  getClient,
  query,
  close,
  getPool: () => pool
};
