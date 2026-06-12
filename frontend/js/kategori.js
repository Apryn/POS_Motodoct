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

let categories = [];
let editId    = null;
let deleteId  = null;

// ── Load Data ─────────────────────────────────────────────────────────────────
async function loadData() {
  try {
    const res  = await fetch(`${API}/categories`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (data.success) {
      categories = data.data;
    } else {
      categories = [];
    }
    renderStats();
    renderTable();
  } catch (err) {
    console.error('Load error:', err);
    document.getElementById('kategoriTableBody').innerHTML =
      '<tr><td colspan="3" class="empty-state">Gagal memuat data. Periksa koneksi server.</td></tr>';
  }
}

// ── Stats ─────────────────────────────────────────────────────────────────────
function renderStats() {
  const total = categories.length;
  document.getElementById('statTotal').textContent = total;
}

// ── Table Rendering ───────────────────────────────────────────────────────────
function renderTable(list) {
  const data  = list !== undefined ? list : categories;
  const tbody = document.getElementById('kategoriTableBody');
  if (!data.length) {
    tbody.innerHTML = '<tr><td colspan="3" class="empty-state">Tidak ada data kategori</td></tr>';
    return;
  }
  tbody.innerHTML = data.map((c, i) => `
    <tr>
      <td>${i + 1}</td>
      <td><strong>${escHtml(c.name)}</strong></td>
      <td>
        <div class="action-btns" style="justify-content: center;">
          <button class="btn-edit"    onclick="openEdit(${c.id})">Edit</button>
          ${isAdminOrOwner ? `<button class="btn-del-row" onclick="openDelete(${c.id}, '${escAttr(c.name)}')">Hapus</button>` : ''}
        </div>
      </td>
    </tr>
  `).join('');
}

function filterTable() {
  const q = document.getElementById('searchInput').value.toLowerCase();
  renderTable(categories.filter(c =>
    c.name.toLowerCase().includes(q)
  ));
}

// ── Modal Add / Edit ──────────────────────────────────────────────────────────
function openModal() {
  editId = null;
  document.getElementById('modalTitle').textContent = 'Tambah Kategori';
  document.getElementById('formKategori').reset();
  document.getElementById('modalKategori').classList.remove('hidden');
}

function openEdit(id) {
  const c = categories.find(x => x.id === id);
  if (!c) return;
  editId = id;
  document.getElementById('modalTitle').textContent = 'Edit Kategori';
  document.getElementById('fieldNama').value = c.name;
  document.getElementById('modalKategori').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modalKategori').classList.add('hidden');
}

async function saveCategory() {
  const payload = {
    name: document.getElementById('fieldNama').value.trim()
  };

  if (!payload.name) { alert('Nama kategori wajib diisi!'); return; }

  const btn = document.getElementById('btnSaveKategori');
  btn.disabled    = true;
  btn.textContent = 'Menyimpan...';

  try {
    const url    = editId ? `${API}/categories/${editId}` : `${API}/categories`;
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

// ── Modal Delete ──────────────────────────────────────────────────────────────
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
    const res  = await fetch(`${API}/categories/${deleteId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
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
