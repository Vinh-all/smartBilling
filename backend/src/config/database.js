const { Pool } = require('pg');

const pool = new Pool(
  process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT || 5432),
        database: process.env.DB_NAME || 'billing_db',
        user: process.env.DB_USER || 'billing_user',
        password: process.env.DB_PASSWORD || '123456',
      },
);

pool.on('error', (error) => {
  console.error('PostgreSQL pool error:', error.message);
});

async function checkDatabaseConnection() {
  const result = await pool.query('SELECT NOW() AS database_time');
  return result.rows[0];
}

module.exports = { pool, checkDatabaseConnection };
