const API = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:3000/api'
  : window.location.origin + '/api';

const originalFetch = window.fetch;
window.fetch = async function (...args) {
  const response = await originalFetch(...args);
  if (response.status === 401) {
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

const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

function openSidebar()  { document.getElementById('sidebar')?.classList.add('open');    document.getElementById('sidebarOverlay')?.classList.add('open'); }
function closeSidebar() { document.getElementById('sidebar')?.classList.remove('open'); document.getElementById('sidebarOverlay')?.classList.remove('open'); }
function logout()       { localStorage.clear(); window.location.href = 'login.html'; }
function formatRp(n)    { return 'Rp ' + Number(n || 0).toLocaleString('id-ID'); }

let mechanics = [];
let editId    = null;
let deleteId  = null;

// ── Load ──────────────────────────────────────────────────────────────────────
async function loadData() {
  try {
    const res  = await fetch(`${API}/mechanics`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (data.success) {
      mechanics = data.data;
    } else {
      mechanics = [];
    }
    renderStats();
    renderTable();
  } catch (err) {
    console.error('Load error:', err);
    document.getElementById('mekanikTableBody').innerHTML =
      '<tr><td colspan="4" class="empty-state">Gagal memuat data. Periksa koneksi server.</td></tr>';
  }
}

// ── Stats ─────────────────────────────────────────────────────────────────────
function renderStats() {
  const total = mechanics.length;
  document.getElementById('statTotal').textContent = total;
  document.getElementById('statAktif').textContent = total; // tampilkan total untuk sekarang
}

// ── Table ─────────────────────────────────────────────────────────────────────
function renderTable(list) {
  const data  = list !== undefined ? list : mechanics;
  const tbody = document.getElementById('mekanikTableBody');
  if (!data.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="empty-state">Tidak ada data mekanik</td></tr>';
    return;
  }
  tbody.innerHTML = data.map((m, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${escHtml(m.name)}</td>
      <td>${escHtml(m.phone || '-')}</td>
      <td>
        <div class="action-btns">
          <button class="btn-edit"    onclick="openEdit(${m.id})">Edit</button>
          <button class="btn-del-row" onclick="openDelete(${m.id}, '${escAttr(m.name)}')">Hapus</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function filterTable() {
  const q = document.getElementById('searchInput').value.toLowerCase();
  renderTable(mechanics.filter(m =>
    m.name.toLowerCase().includes(q) ||
    (m.phone || '').toLowerCase().includes(q)
  ));
}

// ── Modal Tambah/Edit ─────────────────────────────────────────────────────────
function openModal() {
  editId = null;
  document.getElementById('modalTitle').textContent = 'Tambah Mekanik';
  document.getElementById('formMekanik').reset();
  document.getElementById('modalMekanik').classList.remove('hidden');
}

function openEdit(id) {
  const m = mechanics.find(x => x.id === id);
  if (!m) return;
  editId = id;
  document.getElementById('modalTitle').textContent = 'Edit Mekanik';
  document.getElementById('fieldNama').value = m.name;
  document.getElementById('fieldHp').value   = m.phone || '';
  document.getElementById('modalMekanik').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modalMekanik').classList.add('hidden');
}

async function saveMechanic() {
  const payload = {
    name:  document.getElementById('fieldNama').value.trim(),
    phone: document.getElementById('fieldHp').value.trim() || null
  };

  if (!payload.name) { alert('Nama mekanik wajib diisi!'); return; }

  const btn = document.getElementById('btnSaveMekanik');
  btn.disabled    = true;
  btn.textContent = 'Menyimpan...';

  try {
    const url    = editId ? `${API}/mechanics/${editId}` : `${API}/mechanics`;
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
    const res  = await fetch(`${API}/mechanics/${deleteId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
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
