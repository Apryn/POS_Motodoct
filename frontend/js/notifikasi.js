const API = 'http://localhost:3000/api';
const token = localStorage.getItem('token');
const user = JSON.parse(localStorage.getItem('user') || '{}');
if (!token) window.location.href = 'login.html';

document.getElementById('welcomeText').textContent = user.username || 'Admin';
document.getElementById('userAvatar').textContent = (user.username || 'A')[0].toUpperCase();

const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

// Riwayat notif disimpan di localStorage
const RIWAYAT_KEY = 'notif_riwayat';
let threshold = parseInt(localStorage.getItem('notif_threshold') || '5');
document.getElementById('thresholdInput').value = threshold;

function openSidebar() { document.getElementById('sidebar')?.classList.add('open'); document.getElementById('sidebarOverlay')?.classList.add('open'); }
function closeSidebar() { document.getElementById('sidebar')?.classList.remove('open'); document.getElementById('sidebarOverlay')?.classList.remove('open'); }
function logout() { localStorage.clear(); window.location.href = 'login.html'; }

function showToast(msg, color = '#1a1a2e') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.style.background = color;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3500);
}

function addRiwayat(msg, type = 'stok') {
  const riwayat = JSON.parse(localStorage.getItem(RIWAYAT_KEY) || '[]');
  riwayat.unshift({
    msg,
    type,
    time: new Date().toLocaleString('id-ID')
  });
  // Simpan max 20 riwayat
  localStorage.setItem(RIWAYAT_KEY, JSON.stringify(riwayat.slice(0, 20)));
  renderRiwayat();
}

function renderRiwayat() {
  const riwayat = JSON.parse(localStorage.getItem(RIWAYAT_KEY) || '[]');
  const el = document.getElementById('riwayatList');

  if (!riwayat.length) {
    el.innerHTML = `<div style="text-align:center;padding:24px;color:var(--text-muted);background:#fff;border-radius:10px;border:1px solid var(--border);font-size:13px;">Belum ada riwayat notifikasi.</div>`;
    return;
  }

  el.innerHTML = riwayat.map(r => `
    <div class="riwayat-item">
      <span style="font-size:18px;">${r.type === 'daily' ? '📊' : '🔔'}</span>
      <div class="riwayat-msg">${r.msg}</div>
      <div class="riwayat-time">${r.time}</div>
    </div>
  `).join('');
}

// ===== LOAD STOK =====
async function loadStok() {
  try {
    const res = await fetch(`${API}/notif/stok?threshold=${threshold}`, { headers });
    const data = await res.json();
    const items = data.data || [];

    const habis   = items.filter(s => s.stock === 0);
    const menipis = items.filter(s => s.stock > 0 && s.stock <= threshold);

    const el = document.getElementById('stokSection');

    if (habis.length === 0 && menipis.length === 0) {
      el.innerHTML = `
        <div class="notif-empty">
          <div class="icon">✅</div>
          <p><strong>Semua stok aman!</strong></p>
          <p style="margin-top:4px;font-size:12px;">Tidak ada sparepart yang perlu direstock saat ini.</p>
        </div>`;
      return;
    }

    let html = '';

    if (habis.length > 0) {
      html += `<div class="notif-section-title">❌ Stok Habis <span class="badge-count red">${habis.length}</span></div>
        <div class="notif-list">
          ${habis.map(s => `
            <div class="notif-item">
              <div class="notif-icon red">❌</div>
              <div class="notif-info">
                <div class="notif-name">${s.name}</div>
                <div class="notif-detail">${s.code ? `Kode: <b>${s.code}</b>` : ''}${s.rack_location ? ` · Rak: <b>${s.rack_location}</b>` : ''}</div>
              </div>
              <div class="notif-stock red">0 pcs</div>
            </div>`).join('')}
        </div>`;
    }

    if (menipis.length > 0) {
      html += `<div class="notif-section-title" style="margin-top:${habis.length?'8px':'0'}">⚠️ Stok Menipis <span class="badge-count orange">${menipis.length}</span></div>
        <div class="notif-list">
          ${menipis.map(s => `
            <div class="notif-item">
              <div class="notif-icon orange">⚠️</div>
              <div class="notif-info">
                <div class="notif-name">${s.name}</div>
                <div class="notif-detail">${s.code ? `Kode: <b>${s.code}</b>` : ''}${s.rack_location ? ` · Rak: <b>${s.rack_location}</b>` : ''}</div>
              </div>
              <div class="notif-stock orange">${s.stock} pcs</div>
            </div>`).join('')}
        </div>`;
    }

    el.innerHTML = html;
  } catch (err) {
    document.getElementById('stokSection').innerHTML = `<div style="color:var(--red);padding:16px;">Gagal memuat data stok.</div>`;
  }
}

// ===== KIRIM NOTIF STOK =====
async function sendStok() {
  const btn = document.getElementById('btnSendStok');
  btn.disabled = true; btn.textContent = 'Mengirim...';
  try {
    const res = await fetch(`${API}/notif/send`, { method: 'POST', headers });
    const data = await res.json();
    if (data.success) {
      showToast('✅ ' + data.message, '#27ae60');
      addRiwayat('Notifikasi stok menipis/habis dikirim ke Telegram', 'stok');
    } else {
      showToast('❌ ' + data.message, '#e74c3c');
    }
  } catch { showToast('❌ Tidak bisa terhubung ke server', '#e74c3c'); }
  finally { btn.disabled = false; btn.textContent = '📨 Kirim Notif Stok'; }
}

// ===== KIRIM LAPORAN HARIAN =====
async function sendDaily() {
  const btn = document.getElementById('btnSendDaily');
  btn.disabled = true; btn.textContent = 'Mengirim...';
  try {
    const res = await fetch(`${API}/notif/send-daily`, { method: 'POST', headers });
    const data = await res.json();
    if (data.success) {
      showToast('✅ ' + data.message, '#27ae60');
      addRiwayat('Laporan harian dikirim ke Telegram', 'daily');
    } else {
      showToast('❌ ' + data.message, '#e74c3c');
    }
  } catch { showToast('❌ Tidak bisa terhubung ke server', '#e74c3c'); }
  finally { btn.disabled = false; btn.textContent = '📈 Kirim Laporan Harian'; }
}

// ===== THRESHOLD =====
function applyThreshold() {
  const val = parseInt(document.getElementById('thresholdInput').value) || 5;
  threshold = val;
  localStorage.setItem('notif_threshold', val);
  showToast(`✅ Threshold diubah ke ${val} pcs`, '#1a1a2e');
  loadStok();
}

// Init
loadStok();
renderRiwayat();
