const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const path = require('path');
const fs = require('fs');
const qrcode = require('qrcode');
const qrcodeTerminal = require('qrcode-terminal');
const https = require('https');

const AUTH_DIR = path.join(__dirname, '../auth_info_baileys');
const FONNTE_TOKEN = process.env.FONNTE_TOKEN;

let sock = null;
let isConnected = false;
let currentQrCodeDataUrl = null;
let currentQrRaw = null;
let connectedUser = null;
let isInitializing = false;

/**
 * Inisialisasi koneksi Baileys WhatsApp
 */
async function initWhatsApp() {
  if (isInitializing) return;
  isInitializing = true;

  try {
    if (!fs.existsSync(AUTH_DIR)) {
      fs.mkdirSync(AUTH_DIR, { recursive: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: [2, 3000, 1015901307] }));

    sock = makeWASocket({
      version,
      auth: state,
      logger: pino({ level: 'silent' }),
      printQRInTerminal: false,
      browser: ['Motodoct Bengkel', 'Chrome', '1.0.0'],
      syncFullHistory: false
    });

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        currentQrRaw = qr;
        try {
          currentQrCodeDataUrl = await qrcode.toDataURL(qr);
        } catch (e) {
          console.error("Gagal generate QR DataURL:", e.message);
        }

        console.log('\n======================================================');
        console.log('📱 SCAN QR CODE DENGAN WHATSAPP DI HP BENGKEL ANDA:');
        console.log('======================================================');
        try {
          qrcodeTerminal.generate(qr, { small: true });
        } catch (err) {}
        console.log('Atau buka halaman pengaturan kasir untuk scan via layar monitor.');
        console.log('======================================================\n');
      }

      if (connection === 'open') {
        isConnected = true;
        currentQrCodeDataUrl = null;
        currentQrRaw = null;
        connectedUser = sock.user?.id || 'Connected';
        console.log(`\n✅ WhatsApp Bengkel TERHUBUNG: ${sock.user?.id?.split(':')[0] || 'Aktif'} (Siap kirim otomatis!)`);
      } else if (connection === 'close') {
        isConnected = false;
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        console.log(`⚠️ Koneksi WhatsApp terputus (Status: ${statusCode}). Reconnect: ${shouldReconnect}`);

        if (shouldReconnect) {
          isInitializing = false;
          setTimeout(() => initWhatsApp(), 5000);
        } else {
          // Logged out, bersihkan sesi auth agar bisa scan ulang
          console.log('⚠️ Sesi WhatsApp logout. Membersihkan auth info...');
          try {
            fs.rmSync(AUTH_DIR, { recursive: true, force: true });
          } catch (e) {}
          isInitializing = false;
          setTimeout(() => initWhatsApp(), 3000);
        }
      }
    });

    sock.ev.on('creds.update', saveCreds);

  } catch (err) {
    console.error("❌ Gagal inisialisasi Baileys:", err.message);
    isInitializing = false;
  }
}

/**
 * Dapatkan status koneksi WhatsApp
 */
function getWhatsAppStatus() {
  return {
    isConnected,
    hasQr: !!currentQrCodeDataUrl,
    qrCode: currentQrCodeDataUrl,
    user: connectedUser ? connectedUser.split(':')[0] : null
  };
}

/**
 * Putus koneksi / Logout WhatsApp
 */
async function disconnectWhatsApp() {
  try {
    if (sock) {
      await sock.logout().catch(() => {});
      sock.end();
      sock = null;
    }
    isConnected = false;
    currentQrCodeDataUrl = null;
    connectedUser = null;
    try {
      fs.rmSync(AUTH_DIR, { recursive: true, force: true });
    } catch (e) {}
    isInitializing = false;
    setTimeout(() => initWhatsApp(), 2000);
    return true;
  } catch (err) {
    console.error("Gagal logout WhatsApp:", err.message);
    return false;
  }
}

/**
 * Format nomor HP ke format WhatsApp (misal: 628123456789@s.whatsapp.net)
 */
function formatJid(phone) {
  let clean = String(phone).replace(/[^0-9]/g, '');
  if (clean.startsWith('0')) {
    clean = '62' + clean.substring(1);
  }
  return clean + '@s.whatsapp.net';
}

/**
 * Kirim pesan WhatsApp melalui Baileys (atau fallback Fonnte jika Baileys belum terhubung)
 * @param {string} target - Nomor tujuan (misal 08123456789)
 * @param {string} message - Isi teks pesan
 * @returns {Promise<boolean>}
 */
async function sendWhatsAppMessage(target, message) {
  if (!target || !message) return false;

  // 1. Coba kirim via Baileys (Nomor WhatsApp bengkel sendiri)
  if (isConnected && sock) {
    try {
      const jid = formatJid(target);
      await sock.sendMessage(jid, { text: message });
      console.log(`✅ Pesan WhatsApp terkirim ke ${target} via Baileys (Nomor Sendiri)`);
      return true;
    } catch (err) {
      console.error(`❌ Gagal kirim WA via Baileys ke ${target}:`, err.message);
    }
  }

  // 2. Fallback Fonnte API jika dikonfigurasi
  if (FONNTE_TOKEN) {
    return new Promise((resolve) => {
      let cleanPhone = target.replace(/[^0-9]/g, '');
      if (cleanPhone.startsWith('0')) cleanPhone = '62' + cleanPhone.substring(1);

      const payload = JSON.stringify({ target: cleanPhone, message, countryCode: '62' });
      const options = {
        hostname: 'api.fonnte.com',
        path: '/send',
        method: 'POST',
        headers: {
          'Authorization': FONNTE_TOKEN,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(res.statusCode === 200));
      });
      req.on('error', () => resolve(false));
      req.write(payload);
      req.end();
    });
  }

  return false;
}

/**
 * Format dan kirim nota/struk belanja & servis langsung ke WhatsApp pelanggan
 * @param {object} trxData - Data transaksi lengkap
 * @returns {Promise<boolean>}
 */
async function sendWhatsAppReceipt(trxData) {
  if (!trxData || !trxData.phone) return false;

  const shopName = 'MOTODOCT';
  const invoice = trxData.invoice_number || 'INV-';
  const dateStr = trxData.created_at ? new Date(trxData.created_at).toLocaleString('id-ID') : new Date().toLocaleString('id-ID');
  const custName = trxData.customer_name || 'Pelanggan';
  const plate = trxData.license_plate ? ` (${trxData.license_plate})` : '';
  const paymentMethod = (trxData.payment_method || 'cash').toUpperCase();

  let msg = `🏎️ *${shopName}*\n`;
  msg += `📄 *NOTA TRANSAKSI / SERVICE MOTOR*\n\n`;
  msg += `*No. Invoice:* ${invoice}\n`;
  msg += `*Tanggal:* ${dateStr}\n`;
  msg += `*Pelanggan:* ${custName}${plate}\n`;
  msg += `=============================\n\n`;

  if (trxData.spareparts && trxData.spareparts.length > 0) {
    msg += `📦 *SPAREPART / BARANG:* \n`;
    trxData.spareparts.forEach((sp, idx) => {
      const name = sp.name || sp.sparepart_name;
      const qty = sp.quantity || sp.qty || 1;
      const unit = sp.unit || sp.sparepart_unit || 'pcs';
      const price = Number(sp.price || 0);
      const subtotal = Number(sp.subtotal || (price * qty));
      msg += `${idx + 1}. ${name}\n`;
      msg += `   └ ${qty} ${unit} x Rp ${price.toLocaleString('id-ID')} = Rp ${subtotal.toLocaleString('id-ID')}\n`;
    });
    msg += `\n`;
  }

  if (trxData.services && trxData.services.length > 0) {
    msg += `🔧 *JASA SERVICE / PERAWATAN:* \n`;
    trxData.services.forEach((sv, idx) => {
      const name = sv.name || sv.service_name;
      const price = Number(sv.price || 0);
      const mech = sv.mechanic_name || '';
      const mechText = mech ? ` (Mekanik: ${mech})` : '';
      msg += `${idx + 1}. ${name}${mechText}\n`;
      msg += `   └ Rp ${price.toLocaleString('id-ID')}\n`;
    });
    msg += `\n`;
  }

  msg += `=============================\n`;
  const total = Number(trxData.total_amount || trxData.total || 0);
  msg += `*TOTAL BAYAR: Rp ${total.toLocaleString('id-ID')}*\n`;
  msg += `Pembayaran: ${paymentMethod}\n\n`;
  msg += `Terima kasih telah mempercayakan perbaikan & perawatan sepeda motor Anda di *${shopName}*! Semoga kendaraan Anda senantiasa prima. 🙏😊\n`;

  return await sendWhatsAppMessage(trxData.phone, msg);
}

module.exports = {
  initWhatsApp,
  getWhatsAppStatus,
  disconnectWhatsApp,
  sendWhatsAppMessage,
  sendWhatsAppReceipt
};
