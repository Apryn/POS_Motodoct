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
    text: message,
    parse_mode: 'HTML'
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

    let msg = `🏍️ <b>MOTODOCT — Notifikasi Stok</b>\n`;
    msg += `📅 ${new Date().toLocaleString('id-ID')}\n\n`;

    if (habis.length > 0) {
      msg += `❌ <b>STOK HABIS (${habis.length} item)</b>\n`;
      habis.forEach(r => {
        msg += `• ${r.name}`;
        if (r.code) msg += ` <code>[${r.code}]</code>`;
        if (r.rack_location) msg += ` — Rak ${r.rack_location}`;
        msg += ` → <b>0 pcs</b>\n`;
      });
      msg += '\n';
    }

    if (menipis.length > 0) {
      msg += `⚠️ <b>STOK MENIPIS (${menipis.length} item)</b>\n`;
      menipis.forEach(r => {
        msg += `• ${r.name}`;
        if (r.code) msg += ` <code>[${r.code}]</code>`;
        if (r.rack_location) msg += ` — Rak ${r.rack_location}`;
        msg += ` → <b>${r.stock} pcs</b>\n`;
      });
    }

    msg += `\n🔗 Segera lakukan restock!`;

    sendTelegram(msg);
    console.log(`📨 Notifikasi Telegram dikirim: ${habis.length} habis, ${menipis.length} menipis`);
  } catch (err) {
    console.error('❌ checkStokAndNotify error:', err.message);
  }
}

module.exports = { sendTelegram, checkStokAndNotify };
