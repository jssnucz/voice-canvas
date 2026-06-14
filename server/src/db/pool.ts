import pg from 'pg';

const { Pool } = pg;

export function createPool(databaseUrl?: string): pg.Pool {
  const connectionString = databaseUrl || process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required for database connection');
  }
  return new Pool({
    connectionString,
    max: 5,
    min: 2,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 3000,
  });
}
