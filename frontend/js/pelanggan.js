const API = 'http://localhost:3000/api';
const token = localStorage.getItem('token');
const user = JSON.parse(localStorage.getItem('user') || '{}');

if (!token) window.location.href = 'login.html';

const welcomeEl = document.getElementById('welcomeText');
const avatarEl  = document.getElementById('userAvatar');
if (welcomeEl) welcomeEl.textContent = user.username || 'Admin';
if (avatarEl)  avatarEl.textContent  = (user.username || 'A')[0].toUpperCase();

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
          <button class="btn-edit"    onclick="openEdit(${c.id})">Edit</button>
          <button class="btn-del-row" onclick="openDelete(${c.id}, '${escAttr(c.name)}')">Hapus</button>
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

// ── Init ──────────────────────────────────────────────────────────────────────
loadData();
