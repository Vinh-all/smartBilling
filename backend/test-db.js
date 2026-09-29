require('dotenv').config();

const { pool, checkDatabaseConnection } = require('./database');

async function testConnection() {
  try {
    const result = await checkDatabaseConnection();

    console.log('=================================');
    console.log('✅ Kết nối PostgreSQL thành công!');
    console.log('Thời gian PostgreSQL:', result.database_time);
    console.log('=================================');
  } catch (error) {
    console.error('❌ Kết nối PostgreSQL thất bại!');
    console.error('Lỗi:', error.message);
  } finally {
    await pool.end();
  }
}

testConnection();