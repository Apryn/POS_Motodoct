const https = require('https');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID   = process.env.TELEGRAM_CHAT_ID;

/**
 * Kirim pesan ke Telegram
 * @param {string} message - Pesan dalam format HTML
 */
function sendTelegram(message) {
  if (!BOT_TOKEN || !CHAT_ID) {
    console.warn('⚠️  Telegram tidak dikonfigurasi');
    return;
  }

  const body = JSON.stringify({
    chat_id: CHAT_ID,
    text: message
  });

  const options = {
    hostname: 'api.telegram.org',
    path: `/bot${BOT_TOKEN}/sendMessage`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body)
    }
  };

  const req = https.request(options, (res) => {
    if (res.statusCode !== 200) {
      console.error('❌ Telegram error:', res.statusCode);
    }
  });

  req.on('error', (err) => console.error('❌ Telegram request error:', err.message));
  req.write(body);
  req.end();
}

/**
 * Cek stok dan kirim notifikasi kalau ada yang menipis/habis
 * @param {object} db - Database connection pool
 */
async function checkStokAndNotify(db) {
  try {
    const [rows] = await db.execute(`
      SELECT name, code, stock, rack_location
      FROM spareparts
      WHERE stock <= 5
      ORDER BY stock ASC
    `);

    if (rows.length === 0) return;

    const habis   = rows.filter(r => r.stock === 0);
    const menipis = rows.filter(r => r.stock > 0 && r.stock <= 5);

    // Batasi max 20 item per kategori agar tidak melebihi limit Telegram (4096 char)
    const MAX_ITEMS = 20;
    const habisShow   = habis.slice(0, MAX_ITEMS);
    const menipisShow = menipis.slice(0, MAX_ITEMS);

    let msg = `\uD83C\uDFCD MOTODOCT \u2014 Notifikasi Stok\n`;
    msg += `Tanggal: ${new Date().toLocaleString('id-ID')}\n\n`;

    if (habisShow.length > 0) {
      msg += `STOK HABIS (${habis.length} item)${habis.length > MAX_ITEMS ? `, tampil ${MAX_ITEMS}` : ''}:\n`;
      habisShow.forEach(r => {
        const kode = r.code ? ` [${r.code}]` : '';
        const rak  = r.rack_location ? ` Rak:${r.rack_location}` : '';
        msg += `- ${r.name}${kode}${rak} = 0 pcs\n`;
      });
      msg += '\n';
    }

    if (menipisShow.length > 0) {
      msg += `STOK MENIPIS (${menipis.length} item)${menipis.length > MAX_ITEMS ? `, tampil ${MAX_ITEMS}` : ''}:\n`;
      menipisShow.forEach(r => {
        const kode = r.code ? ` [${r.code}]` : '';
        const rak  = r.rack_location ? ` Rak:${r.rack_location}` : '';
        msg += `- ${r.name}${kode}${rak} = ${r.stock} pcs\n`;
      });
    }

    msg += `\nSegera lakukan restock!`;

    // Pastikan tidak melebihi 4096 karakter
    if (msg.length > 4000) {
      msg = msg.substring(0, 3900) + '\n...(terpotong, terlalu banyak item)';
    }

    sendTelegram(msg);
    console.log(`\uD83D\uDCE8 Notifikasi Telegram dikirim: ${habis.length} habis, ${menipis.length} menipis`);
  } catch (err) {
    console.error('\u274C checkStokAndNotify error:', err.message);
  }
}

module.exports = { sendTelegram, checkStokAndNotify };
