const API = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:3000/api'
  : window.location.origin + '/api';

const originalFetch = window.fetch;
window.fetch = async function (...args) {
  const response = await originalFetch(...args);
  if (response.status === 401 || response.status === 403) {
    localStorage.clear();
    window.location.href = 'login.html';
  }
  return response;
};
const token = localStorage.getItem('token');
const user = JSON.parse(localStorage.getItem('user') || '{}');

if (!token) window.location.href = 'login.html';

const welcomeEl = document.getElementById('welcomeText');
const avatarEl  = document.getElementById('userAvatar');
if (welcomeEl) welcomeEl.textContent = user.username || 'Admin';
if (avatarEl)  avatarEl.textContent  = (user.username || 'A')[0].toUpperCase();

const isAdminOrOwner = user.role === 'admin' || user.role === 'owner';

const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

function openSidebar()  { document.getElementById('sidebar')?.classList.add('open');    document.getElementById('sidebarOverlay')?.classList.add('open'); }
function closeSidebar() { document.getElementById('sidebar')?.classList.remove('open'); document.getElementById('sidebarOverlay')?.classList.remove('open'); }
function logout()       { localStorage.clear(); window.location.href = 'login.html'; }

let customers = [];
let editId    = null;
let deleteId  = null;

// ── Load ──────────────────────────────────────────────────────────────────────
async function loadData() {
  try {
    const res  = await fetch(`${API}/customers`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (data.success) {
      customers = data.data;
    } else {
      customers = [];
    }
    renderStats();
    renderTable();
  } catch (err) {
    console.error('Load error:', err);
    document.getElementById('pelangganTableBody').innerHTML =
      '<tr><td colspan="5" class="empty-state">Gagal memuat data. Periksa koneksi server.</td></tr>';
  }
}

// ── Stats ─────────────────────────────────────────────────────────────────────
function renderStats() {
  const total = customers.length;

  // Pelanggan baru bulan ini — berdasarkan field created_at jika tersedia
  const now   = new Date();
  const baru  = customers.filter(c => {
    if (!c.created_at) return false;
    const d = new Date(c.created_at);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }).length;

  document.getElementById('statTotal').textContent     = total;
  document.getElementById('statBaru').textContent      = baru;
  document.getElementById('statKendaraan').textContent = total; // 1 kendaraan per pelanggan
}

// ── Table ─────────────────────────────────────────────────────────────────────
function renderTable(list) {
  const data  = list !== undefined ? list : customers;
  const tbody = document.getElementById('pelangganTableBody');
  if (!data.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-state">Tidak ada data pelanggan</td></tr>';
    return;
  }
  tbody.innerHTML = data.map((c, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${escHtml(c.name)}</td>
      <td>${escHtml(c.phone || '-')}</td>
      <td><span class="code-badge">${escHtml(c.license_plate || '-')}</span></td>
      <td>
        <div class="action-btns">
          <button class="btn-edit" onclick="openEdit(${c.id})">Edit</button>
          <button class="btn-secondary" style="padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 600;" onclick="openHistory(${c.id}, '${escAttr(c.name)}', '${escAttr(c.license_plate)}')">📋 Riwayat</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function filterTable() {
  const q = document.getElementById('searchInput').value.toLowerCase();
  renderTable(customers.filter(c =>
    c.name.toLowerCase().includes(q) ||
    (c.license_plate || '').toLowerCase().includes(q)
  ));
}

// ── Modal Tambah/Edit ─────────────────────────────────────────────────────────
function openModal() {
  editId = null;
  document.getElementById('modalTitle').textContent = 'Tambah Pelanggan';
  document.getElementById('formPelanggan').reset();
  document.getElementById('btnDeletePelanggan')?.classList.add('hidden');
  document.getElementById('modalPelanggan').classList.remove('hidden');
}

function openEdit(id) {
  const c = customers.find(x => x.id === id);
  if (!c) return;
  editId = id;
  document.getElementById('modalTitle').textContent = 'Edit Pelanggan';
  document.getElementById('fieldNama').value = c.name;
  document.getElementById('fieldHp').value   = c.phone || '';
  document.getElementById('fieldPlat').value = c.license_plate || '';
  document.getElementById('btnDeletePelanggan')?.classList.remove('hidden');
  document.getElementById('modalPelanggan').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modalPelanggan').classList.add('hidden');
}

async function saveCustomer() {
  const payload = {
    name:          document.getElementById('fieldNama').value.trim(),
    phone:         document.getElementById('fieldHp').value.trim() || null,
    license_plate: document.getElementById('fieldPlat').value.trim()
  };

  if (!payload.name)          { alert('Nama pelanggan wajib diisi!'); return; }
  if (!payload.license_plate) { alert('Plat nomor wajib diisi!'); return; }

  const btn = document.getElementById('btnSavePelanggan');
  btn.disabled    = true;
  btn.textContent = 'Menyimpan...';

  try {
    const url    = editId ? `${API}/customers/${editId}` : `${API}/customers`;
    const method = editId ? 'PUT' : 'POST';
    const res    = await fetch(url, { method, headers, body: JSON.stringify(payload) });
    const data   = await res.json();
    if (data.success) {
      closeModal();
      loadData();
    } else {
      alert('Gagal menyimpan: ' + (data.message || 'Terjadi kesalahan'));
    }
  } catch (err) {
    alert('Koneksi error!');
  } finally {
    btn.disabled    = false;
    btn.textContent = 'Simpan';
  }
}

// ── Modal Hapus ───────────────────────────────────────────────────────────────
function openDelete(id, name) {
  deleteId = id;
  document.getElementById('deleteItemName').textContent = name;
  document.getElementById('modalDelete').classList.remove('hidden');
}

function closeDeleteModal() {
  document.getElementById('modalDelete').classList.add('hidden');
  deleteId = null;
}

async function confirmDelete() {
  if (!deleteId) return;
  try {
    const res  = await fetch(`${API}/customers/${deleteId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (data.success) {
      closeDeleteModal();
      loadData();
    } else {
      alert('Gagal menghapus: ' + (data.message || 'Terjadi kesalahan'));
    }
  } catch (err) {
    alert('Koneksi error!');
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function escHtml(str) { return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function escAttr(str) { return String(str).replace(/'/g,"\\'"); }

// ── Riwayat (Rekam Medis) ───────────────────────────────────────────────────────
async function openHistory(id, name, plate) {
  document.getElementById('historyCustomerName').textContent = name;
  document.getElementById('historyLicensePlate').textContent = plate;
  const listEl = document.getElementById('historyList');
  listEl.innerHTML = '<div style="text-align:center;padding:16px;color:#aaa;">Memuat riwayat servis...</div>';
  document.getElementById('modalHistory').classList.remove('hidden');

  try {
    const res = await fetch(`${API}/customers/${id}/history`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    const history = data.data || [];

    if (!history.length) {
      listEl.innerHTML = '<div style="text-align:center;padding:24px;color:#aaa;background:#fcfcfc;border-radius:8px;border:1px dashed #ddd;font-size:13px;">Belum ada riwayat transaksi / servis untuk kendaraan ini.</div>';
      return;
    }

    listEl.innerHTML = history.map(trx => {
      const tgl = new Date(trx.created_at).toLocaleString('id-ID', {
        day: 'numeric', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });

      let itemsHtml = '';
      
      if (trx.spareparts && trx.spareparts.length) {
        itemsHtml += `
          <div style="margin-top: 8px;">
            <div style="font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase; margin-bottom: 6px; display: flex; align-items: center; gap: 6px; letter-spacing: 0.5px;">
              <span>🔩</span> Spareparts yang Diganti
            </div>
            <div style="display: flex; flex-wrap: wrap; gap: 6px; padding-left: 4px;">
              ${trx.spareparts.map(s => `
                <span style="display: inline-flex; align-items: center; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 4px 8px; font-size: 12px; color: #334155; font-weight: 500;">
                  ${s.sparepart_name} 
                  <span style="background: #e2e8f0; color: #475569; font-size: 10px; font-weight: 700; border-radius: 4px; padding: 1px 4px; margin-left: 6px;">x${s.quantity}</span>
                </span>
              `).join('')}
            </div>
          </div>`;
      }

      if (trx.services && trx.services.length) {
        itemsHtml += `
          <div style="margin-top: 10px;">
            <div style="font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase; margin-bottom: 6px; display: flex; align-items: center; gap: 6px; letter-spacing: 0.5px;">
              <span>🔧</span> Jasa Servis & Perbaikan
            </div>
            <div style="display: flex; flex-direction: column; gap: 6px; padding-left: 4px;">
              ${trx.services.map(s => `
                <div style="display: flex; justify-content: space-between; align-items: center; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 6px 12px; font-size: 12.5px; color: #166534; font-weight: 600;">
                  <span>${s.service_name}</span>
                  <span style="font-size: 10.5px; font-weight: 500; background: #dcfce7; color: #15803d; border-radius: 6px; padding: 2px 8px; display: inline-flex; align-items: center; gap: 4px;">
                    👨‍🔧 ${s.mechanic_name || 'Mekanik'}
                  </span>
                </div>
              `).join('')}
            </div>
          </div>`;
      }

      return `
        <div style="background:#fff; border:1px solid #e2e8f0; border-radius:12px; padding:16px; box-shadow:0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03); display:flex; flex-direction:column; gap:12px;">
          <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #f1f5f9; padding-bottom:8px;">
            <span style="font-size:12px; font-weight:800; color:#3b82f6; background:#eff6ff; padding:4px 8px; border-radius:6px; font-family:monospace;">${trx.invoice_number}</span>
            <span style="font-size:12px; color:#64748b; font-weight:500;">📅 ${tgl}</span>
          </div>
          ${itemsHtml}
          <div style="display:flex; justify-content:space-between; align-items:center; margin-top:4px; padding-top:10px; border-top:1px dashed #e2e8f0; font-size:14px; font-weight:700; color:#1e293b;">
            <span style="color:#64748b; font-size:13px; font-weight:500;">Total Biaya</span>
            <span style="color:#10b981; font-size:15px; font-weight:800;">Rp ${Number(trx.total_amount).toLocaleString('id-ID')}</span>
          </div>
        </div>`;
    }).join('');
  } catch (err) {
    listEl.innerHTML = '<div style="text-align:center;padding:16px;color:#ef4444;">Gagal memuat riwayat.</div>';
  }
}

function closeHistoryModal() {
  document.getElementById('modalHistory').classList.add('hidden');
}

function handleDeleteFromModal() {
  if (!editId) return;
  const c = customers.find(x => x.id === editId);
  if (!c) return;
  closeModal();
  openDelete(c.id, c.name);
}

// ── Init ──────────────────────────────────────────────────────────────────────
loadData();
