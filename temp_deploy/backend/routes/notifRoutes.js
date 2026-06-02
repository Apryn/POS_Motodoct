const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { checkStokAndNotify } = require('../services/telegramService');
const auth = require('../middleware/auth');

router.use(auth);

// GET stok menipis & habis
router.get('/stok', async (req, res) => {
  try {
    const threshold = parseInt(req.query.threshold) || 5;
    const [rows] = await db.execute(`
      SELECT id, name, code, stock, rack_location
      FROM spareparts WHERE stock <= ?
      ORDER BY stock ASC
    `, [threshold]);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server Error' });
  }
});

// POST kirim notif stok manual ke Telegram
router.post('/send', async (req, res) => {
  try {
    await checkStokAndNotify(db);
    res.json({ success: true, message: 'Notifikasi stok berhasil dikirim ke Telegram!' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal mengirim notifikasi' });
  }
});

// POST kirim ringkasan harian ke Telegram
router.post('/send-daily', async (req, res) => {
  try {
    const { sendTelegram } = require('../services/telegramService');
    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

    const [[summary]] = await db.execute(`
      SELECT COUNT(*) as total_trx, COALESCE(SUM(total_amount),0) as pendapatan
      FROM transactions WHERE DATE(created_at) = ?
    `, [dateStr]);

    const [[pengeluaran]] = await db.execute(`
      SELECT COALESCE(SUM(total),0) as total FROM purchases WHERE DATE(created_at) = ?
    `, [dateStr]);

    const laba = summary.pendapatan - pengeluaran.total;
    const tgl = today.toLocaleDateString('id-ID', { weekday:'long', day:'numeric', month:'long', year:'numeric' });

    const msg = `📊 <b>LAPORAN HARIAN — MOTODOCT</b>\n📅 ${tgl}\n\n` +
      `🧾 Transaksi: <b>${summary.total_trx}</b>\n` +
      `💰 Pendapatan: <b>Rp ${Number(summary.pendapatan).toLocaleString('id-ID')}</b>\n` +
      `🛒 Pengeluaran: <b>Rp ${Number(pengeluaran.total).toLocaleString('id-ID')}</b>\n` +
      `📈 Laba Kotor: <b>${laba >= 0 ? '✅' : '❌'} Rp ${Number(laba).toLocaleString('id-ID')}</b>`;

    sendTelegram(msg);
    res.json({ success: true, message: 'Laporan harian berhasil dikirim!' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal mengirim laporan harian' });
  }
});

// POST test koneksi bot Telegram
router.post('/test-telegram', async (req, res) => {
  try {
    const { sendTelegram } = require('../services/telegramService');
    const msg = `⚡ <b>KONEKSI TELEGRAM SUKSES</b>\n\nNotifikasi bot kasir <b>Motodoct</b> telah terhubung dengan benar dan siap menerima laporan!`;
    sendTelegram(msg);
    res.json({ success: true, message: 'Pesan tes koneksi dikirim!' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal mengirim pesan tes' });
  }
});

module.exports = router;
