const express = require('express');
const router = express.Router();
const whatsappService = require('../services/whatsappService');
const auth = require('../middleware/auth');

// Get status koneksi & QR code
router.get('/status', (req, res) => {
  const status = whatsappService.getWhatsAppStatus();
  res.json({ success: true, data: status });
});

// Logout / disconnect Baileys session
router.post('/disconnect', auth, async (req, res) => {
  const success = await whatsappService.disconnectWhatsApp();
  res.json({ success, message: success ? 'WhatsApp berhasil diputus' : 'Gagal memutuskan WhatsApp' });
});

// Kirim pesan tes
router.post('/test', auth, async (req, res) => {
  const { phone, message } = req.body;
  if (!phone || !message) {
    return res.status(400).json({ success: false, message: 'Nomor telepon dan pesan wajib diisi' });
  }

  const sent = await whatsappService.sendWhatsAppMessage(phone, message);
  if (sent) {
    res.json({ success: true, message: 'Pesan tes berhasil dikirim!' });
  } else {
    res.status(500).json({ success: false, message: 'Gagal mengirim pesan tes. Pastikan WhatsApp sudah terhubung.' });
  }
});

module.exports = router;
