import pkg from 'pg';
import { config } from './env.js';

const { Pool } = pkg;

// Initialize a connection pool
export const pool = new Pool({
  connectionString: config.databaseUrl,
});

// Test the connection on startup
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('[Database] Failed to connect to PostgreSQL:', err.message);
  } else {
    console.log('[Database] Connected to PostgreSQL successfully at', res.rows[0].now);
  }
});
