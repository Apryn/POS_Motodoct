const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  console.log('⚡ Connected to production VPS! Fetching last transactions...');
  
  const remoteScript = `
const mysql = require('/var/www/motodoct/backend/node_modules/mysql2/promise');
const fs = require('fs');

let envConfig = {};
try {
  const envText = fs.readFileSync('/var/www/motodoct/backend/.env', 'utf-8');
  envText.split('\\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
      envConfig[parts[0].trim()] = parts.slice(1).join('=').trim();
    }
  });
} catch (e) {
  console.error("Gagal membaca .env:", e.message);
}

const db = mysql.createPool({
  host: envConfig.DB_HOST || 'localhost',
  user: envConfig.DB_USER || 'motodoct_user',
  password: envConfig.DB_PASSWORD || 'motodoct123',
  database: envConfig.DB_NAME || 'kasir_motodoct',
  port: Number(envConfig.DB_PORT || 3306),
  waitForConnections: true,
  connectionLimit: 5
});

async function main() {
  try {
    const [rows] = await db.execute(\`
      SELECT 
          t.id AS transaction_id, 
          t.invoice_number, 
          t.created_at, 
          t.total_amount,
          ts.id AS transaction_service_id,
          sv.name AS service_name,
          ts.price AS service_price,
          m.name AS mechanic_name,
          m.commission_rate,
          mh.name AS helper_name,
          ts.helper_commission
      FROM transactions t
      JOIN transaction_services ts ON t.id = ts.transaction_id
      JOIN services sv ON ts.service_id = sv.id
      JOIN mechanics m ON ts.mechanic_id = m.id
      LEFT JOIN mechanics mh ON ts.helper_mechanic_id = mh.id
      ORDER BY t.created_at DESC, t.id DESC
      LIMIT 8
    \`);

    console.log("\\n========================================================");
    console.log(" TRANSAKSI JASA TERBARU DI SERVER LIVE");
    console.log("========================================================");
    if (rows.length === 0) {
      console.log("❌ Tidak ditemukan data transaksi jasa di database live.");
    } else {
      rows.forEach(r => {
        // Hitung komisi utama berdasarkan logika baru: 
        // Jika nama jasa adalah remap, gunakan rate 50%, jika tidak gunakan commission_rate
        const isRemap = r.service_name.toLowerCase() === 'remap';
        const rate = isRemap ? 50 : parseFloat(r.commission_rate);
        const totalCommPool = r.service_price * (rate / 100);
        const helperComm = parseFloat(r.helper_commission || 0);
        const mainComm = totalCommPool - helperComm;
        const shopShare = r.service_price - totalCommPool;

        console.log(\` - Invoice   : \${r.invoice_number}\`);
        console.log(\`   Tanggal   : \${r.created_at}\`);
        console.log(\`   Jasa      : \${r.service_name} | Harga: Rp \${Number(r.service_price).toLocaleString('id-ID')}\`);
        console.log(\`   Mekanik   : \${r.mechanic_name} (Rate: \${r.commission_rate}%) | Komisi: Rp \${mainComm.toLocaleString('id-ID')}\`);
        console.log(\`   Helper    : \${r.helper_name || '-'} | Komisi: Rp \${helperComm.toLocaleString('id-ID')}\`);
        console.log(\`   Toko Get  : Rp \${shopShare.toLocaleString('id-ID')} (\${100 - rate}%)\`);
        console.log(" --------------------------------------------------------");
      });
    }
    console.log("========================================================\\n");
    process.exit(0);
  } catch (err) {
    console.error("❌ Terjadi kesalahan saat melakukan query:", err);
    process.exit(1);
  }
}
main();
`;

  conn.exec('node -', (err, stream) => {
    if (err) {
      console.error('❌ Error executing command:', err);
      conn.end();
      return;
    }
    
    let output = '';
    stream.on('close', (code, signal) => {
      console.log(output);
      conn.end();
    }).on('data', (data) => {
      output += data;
    }).stderr.on('data', (data) => {
      console.error('STDERR:', data.toString());
    });
    
    stream.write(remoteScript);
    stream.end();
  });
}).connect({
  host: '187.77.156.219',
  port: 22,
  username: 'root',
  password: 'M0t0D0ct@2026Secure'
});
