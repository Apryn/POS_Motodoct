const mysql = require('mysql2/promise');
require('dotenv').config();

const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: '+07:00'
});

db.getConnection()
  .then((connection) => {
    console.log('✅ Berhasil terhubung ke database MySQL (kasir_motodoct)!');
    connection.release();
  })
  .catch((err) => {
    console.error('❌ Gagal terhubung ke database:', err.message);
  });

module.exports = db;
