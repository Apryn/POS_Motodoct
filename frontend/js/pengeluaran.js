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
function formatRp(n)    { return 'Rp\u00A0' + Number(n || 0).toLocaleString('id-ID'); }

let expenses = [];
let editId   = null;
let deleteId = null;

// ── Load Data ─────────────────────────────────────────────────────────────────
async function loadData() {
  try {
    const res  = await fetch(`${API}/expenses`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (data.success) {
      expenses = data.data;
    } else {
      expenses = [];
    }
    renderStats();
    renderTable();
  } catch (err) {
    console.error('Load error:', err);
    document.getElementById('expenseTableBody').innerHTML =
      '<tr><td colspan="6" class="empty-state">Gagal memuat data. Periksa koneksi server.</td></tr>';
  }
}

// ── Stats ─────────────────────────────────────────────────────────────────────
function renderStats() {
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  
  // Hitung pengeluaran hari ini
  const todayTotal = expenses
    .filter(e => e.created_at.startsWith(todayStr))
    .reduce((sum, e) => sum + parseFloat(e.amount), 0);

  // Hitung pengeluaran bulan ini
  const monthTotal = expenses
    .reduce((sum, e) => sum + parseFloat(e.amount), 0);

  document.getElementById('statHariIni').textContent = formatRp(todayTotal);
  document.getElementById('statBulanIni').textContent = formatRp(monthTotal);
}

// ── Table Rendering ───────────────────────────────────────────────────────────
function renderTable(list) {
  const data  = list !== undefined ? list : expenses;
  const tbody = document.getElementById('expenseTableBody');
  if (!data.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-state">Tidak ada data pengeluaran</td></tr>';
    return;
  }
  tbody.innerHTML = data.map((e, i) => {
    const tgl = new Date(e.created_at).toLocaleDateString('id-ID', {
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    return `
      <tr>
        <td>${i + 1}</td>
        <td>${tgl}</td>
        <td><span class="code-badge" style="background:#eef2ff; color:#4a6cf7;">${escHtml(e.category)}</span></td>
        <td>${escHtml(e.description)}</td>
        <td style="font-weight:700; color:#e74c3c;">${formatRp(e.amount)}</td>
        <td>
          <div class="action-btns" style="justify-content: center;">
            <button class="btn-edit"    onclick="openEdit(${e.id})">Edit</button>
            ${isAdminOrOwner ? `<button class="btn-del-row" onclick="openDelete(${e.id}, '${escAttr(e.description)}')">Hapus</button>` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function filterTable() {
  const q = document.getElementById('searchInput').value.toLowerCase();
  const cat = document.getElementById('filterKategori').value;
  
  renderTable(expenses.filter(e => {
    const matchSearch = e.description.toLowerCase().includes(q);
    const matchCat = !cat || e.category === cat;
    return matchSearch && matchCat;
  }));
}

// ── Modal Add / Edit ──────────────────────────────────────────────────────────
function openModal() {
  editId = null;
  document.getElementById('modalTitle').textContent = 'Tambah Pengeluaran';
  document.getElementById('formExpense').reset();
  document.getElementById('modalExpense').classList.remove('hidden');
}

function openEdit(id) {
  const e = expenses.find(x => x.id === id);
  if (!e) return;
  editId = id;
  document.getElementById('modalTitle').textContent = 'Edit Pengeluaran';
  document.getElementById('fieldKategori').value = e.category;
  document.getElementById('fieldDeskripsi').value = e.description;
  document.getElementById('fieldJumlah').value = Math.round(e.amount).toLocaleString('id-ID');
  document.getElementById('modalExpense').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modalExpense').classList.add('hidden');
}

async function saveExpense() {
  const rawAmount = document.getElementById('fieldJumlah').value.replace(/\./g, '');
  const payload = {
    category: document.getElementById('fieldKategori').value,
    description: document.getElementById('fieldDeskripsi').value.trim(),
    amount: parseFloat(rawAmount) || 0
  };

  if (!payload.category) { alert('Pilih kategori terlebih dahulu!'); return; }
  if (!payload.description) { alert('Deskripsi biaya wajib diisi!'); return; }
  if (payload.amount <= 0) { alert('Jumlah pengeluaran harus di atas Rp 0!'); return; }

  const btn = document.getElementById('btnSaveExpense');
  btn.disabled    = true;
  btn.textContent = 'Menyimpan...';

  try {
    const url    = editId ? `${API}/expenses/${editId}` : `${API}/expenses`;
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
function openDelete(id, desc) {
  deleteId = id;
  document.getElementById('deleteItemName').textContent = desc;
  document.getElementById('modalDelete').classList.remove('hidden');
}

function closeDeleteModal() {
  document.getElementById('modalDelete').classList.add('hidden');
  deleteId = null;
}

async function confirmDelete() {
  if (!deleteId) return;
  try {
    const res  = await fetch(`${API}/expenses/${deleteId}`, { method: 'DELETE', headers });
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

// Helper to format text input to thousands separator with dots
function formatNumberInput(inputEl) {
  let val = inputEl.value.replace(/\D/g, ''); // keep only digits
  if (val) {
    val = Number(val).toLocaleString('id-ID'); // format as id-ID (thousands separator is dot)
  }
  inputEl.value = val;
}

// ── Init ──────────────────────────────────────────────────────────────────────
const fieldJumlahEl = document.getElementById('fieldJumlah');
if (fieldJumlahEl) {
  fieldJumlahEl.addEventListener('input', function() {
    formatNumberInput(this);
  });
}

loadData();
