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
function formatRp(n)    { return 'Rp ' + Number(n || 0).toLocaleString('id-ID'); }

let services = [];
let editId   = null;
let deleteId = null;

// ── Load ──────────────────────────────────────────────────────────────────────
async function loadData() {
  try {
    const res  = await fetch(`${API}/services`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (data.success) {
      services = data.data;
    } else {
      services = [];
    }
    renderStats();
    renderTable();
  } catch (err) {
    console.error('Load error:', err);
    document.getElementById('servisTableBody').innerHTML =
      '<tr><td colspan="4" class="empty-state">Gagal memuat data. Periksa koneksi server.</td></tr>';
  }
}

// ── Stats ─────────────────────────────────────────────────────────────────────
function renderStats() {
  const total = services.length;
  const avg   = total ? Math.round(services.reduce((s, x) => s + Number(x.price || 0), 0) / total) : 0;
  document.getElementById('statTotal').textContent    = total;
  document.getElementById('statAvgHarga').textContent = formatRp(avg);
}

// ── Table ─────────────────────────────────────────────────────────────────────
function renderTable(list) {
  const data  = list !== undefined ? list : services;
  const tbody = document.getElementById('servisTableBody');
  if (!data.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="empty-state">Tidak ada data servis</td></tr>';
    return;
  }
  tbody.innerHTML = data.map((s, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${escHtml(s.name)}</td>
      <td>${formatRp(s.price)}</td>
      <td>
        <div class="action-btns">
          <button class="btn-edit"    onclick="openEdit(${s.id})">Edit</button>
          ${isAdminOrOwner ? `<button class="btn-del-row" onclick="openDelete(${s.id}, '${escAttr(s.name)}')">Hapus</button>` : ''}
        </div>
      </td>
    </tr>
  `).join('');
}

function filterTable() {
  const q = document.getElementById('searchInput').value.toLowerCase();
  renderTable(services.filter(s => s.name.toLowerCase().includes(q)));
}

// ── Modal Tambah/Edit ─────────────────────────────────────────────────────────
function openModal() {
  editId = null;
  document.getElementById('modalTitle').textContent = 'Tambah Servis';
  document.getElementById('formServis').reset();
  document.getElementById('modalServis').classList.remove('hidden');
}

function openEdit(id) {
  const s = services.find(x => x.id === id);
  if (!s) return;
  editId = id;
  document.getElementById('modalTitle').textContent = 'Edit Servis';
  document.getElementById('fieldNama').value  = s.name;
  document.getElementById('fieldHarga').value = Math.round(s.price).toLocaleString('id-ID');
  document.getElementById('modalServis').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modalServis').classList.add('hidden');
}

async function saveService() {
  const rawPrice = document.getElementById('fieldHarga').value.replace(/\./g, '');
  const payload = {
    name:  document.getElementById('fieldNama').value.trim(),
    price: parseFloat(rawPrice) || 0
  };

  if (!payload.name)  { alert('Nama servis wajib diisi!'); return; }
  if (!payload.price) { alert('Harga wajib diisi!'); return; }

  const btn = document.getElementById('btnSaveServis');
  btn.disabled    = true;
  btn.textContent = 'Menyimpan...';

  try {
    const url    = editId ? `${API}/services/${editId}` : `${API}/services`;
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
    const res  = await fetch(`${API}/services/${deleteId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
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
function escHtml(str)  { return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function escAttr(str)  { return String(str).replace(/'/g,"\\'"); }

// Helper to format text input to thousands separator with dots
function formatNumberInput(inputEl) {
  let val = inputEl.value.replace(/\D/g, ''); // keep only digits
  if (val) {
    val = Number(val).toLocaleString('id-ID'); // format as id-ID
  }
  inputEl.value = val;
}

// ── Init ──────────────────────────────────────────────────────────────────────
const fieldHargaEl = document.getElementById('fieldHarga');
if (fieldHargaEl) {
  fieldHargaEl.addEventListener('input', function() {
    formatNumberInput(this);
  });
}

loadData();
