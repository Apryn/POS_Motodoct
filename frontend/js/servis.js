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

const canManage = user.role === 'admin' || user.role === 'owner' || user.role === 'kasir';

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
      '<tr><td colspan="5" class="empty-state">Gagal memuat data. Periksa koneksi server.</td></tr>';
  }
}

// ── Stats ─────────────────────────────────────────────────────────────────────
function renderStats() {
  const total = services.length;
  const customCommCount = services.filter(s => s.commission_type === 'percentage' || s.commission_type === 'nominal').length;
  const avg = total ? Math.round(services.reduce((s, x) => s + Number(x.price || 0), 0) / total) : 0;
  
  if (document.getElementById('statTotal')) document.getElementById('statTotal').textContent = total;
  if (document.getElementById('statCustomComm')) document.getElementById('statCustomComm').textContent = customCommCount;
  if (document.getElementById('statAvgHarga')) document.getElementById('statAvgHarga').textContent = formatRp(avg);
}

// ── Table ─────────────────────────────────────────────────────────────────────
function renderTable(list) {
  const data  = list !== undefined ? list : services;
  const tbody = document.getElementById('servisTableBody');
  if (!data.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-state">Tidak ada data servis</td></tr>';
    return;
  }
  tbody.innerHTML = data.map((s, i) => {
    let commBadge = '';
    if (s.commission_type === 'percentage' && s.commission_value !== null && s.commission_value !== undefined) {
      commBadge = `<span style="background:#e0f2fe; color:#0284c7; font-size:11px; font-weight:700; padding:4px 9px; border-radius:6px; border:1px solid #bae6fd; display:inline-block; white-space:nowrap;">⚡ ${Number(s.commission_value)}% Mekanik</span>`;
    } else if (s.commission_type === 'nominal' && s.commission_value !== null && s.commission_value !== undefined) {
      commBadge = `<span style="background:#dcfce7; color:#15803d; font-size:11px; font-weight:700; padding:4px 9px; border-radius:6px; border:1px solid #bbf7d0; display:inline-block; white-space:nowrap;">💰 ${formatRp(s.commission_value)} / servis</span>`;
    } else {
      commBadge = `<span style="background:#f1f5f9; color:#64748b; font-size:11px; font-weight:600; padding:4px 9px; border-radius:6px; border:1px solid #e2e8f0; display:inline-block; white-space:nowrap;">🔄 Ikuti Mekanik</span>`;
    }

    return `
      <tr>
        <td style="text-align: center;">${i + 1}</td>
        <td><strong>${escHtml(s.name)}</strong></td>
        <td><strong style="color: #0f172a;">${formatRp(s.price)}</strong></td>
        <td>${commBadge}</td>
        <td>
          <div class="action-btns" style="justify-content: center;">
            <button class="btn-edit" onclick="openEdit(${s.id})">Edit</button>
            ${canManage ? `<button class="btn-del-row" onclick="openDelete(${s.id}, '${escAttr(s.name)}')">Hapus</button>` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function filterTable() {
  const q = document.getElementById('searchInput').value.toLowerCase();
  renderTable(services.filter(s => s.name.toLowerCase().includes(q)));
}

// ── Commission Type Handler ──────────────────────────────────────────────────
function onCommissionTypeChange() {
  const type = document.getElementById('fieldCommissionType').value;
  const group = document.getElementById('commissionValueGroup');
  const label = document.getElementById('commissionValueLabel');
  const help = document.getElementById('commissionValueHelp');
  const defHelp = document.getElementById('commissionDefaultHelp');
  const valInput = document.getElementById('fieldCommissionValue');

  if (type === 'default') {
    group.classList.add('hidden');
    defHelp.classList.remove('hidden');
    valInput.value = '';
    valInput.required = false;
  } else if (type === 'percentage') {
    group.classList.remove('hidden');
    defHelp.classList.add('hidden');
    label.innerHTML = 'Persentase Komisi Mekanik (%) <span class="required">*</span>';
    valInput.placeholder = 'Contoh: 50 (untuk bagi hasil 50%)';
    valInput.required = true;
    help.textContent = 'Mekanik akan menerima persentase ini dari total harga servis (dikurangi komisi helper bila ada).';
  } else if (type === 'nominal') {
    group.classList.remove('hidden');
    defHelp.classList.add('hidden');
    label.innerHTML = 'Nominal Komisi Mekanik (Rp) <span class="required">*</span>';
    valInput.placeholder = 'Contoh: 5.000';
    valInput.required = true;
    help.textContent = 'Mekanik akan menerima nominal tetap ini per pekerjaan servis.';
  }
}

// ── Modal Tambah/Edit ─────────────────────────────────────────────────────────
function openModal() {
  editId = null;
  document.getElementById('modalTitle').textContent = 'Tambah Servis';
  document.getElementById('formServis').reset();
  document.getElementById('fieldCommissionType').value = 'default';
  document.getElementById('fieldCommissionValue').value = '';
  onCommissionTypeChange();
  document.getElementById('modalServis').classList.remove('hidden');
}

function openEdit(id) {
  const s = services.find(x => x.id === id);
  if (!s) return;
  editId = id;
  document.getElementById('modalTitle').textContent = 'Edit Servis';
  document.getElementById('fieldNama').value  = s.name;
  document.getElementById('fieldHarga').value = Math.round(s.price).toLocaleString('id-ID');
  
  const cType = s.commission_type || 'default';
  document.getElementById('fieldCommissionType').value = cType;
  
  const valInput = document.getElementById('fieldCommissionValue');
  if (cType === 'percentage') {
    valInput.value = s.commission_value !== null ? parseFloat(s.commission_value) : '';
  } else if (cType === 'nominal') {
    valInput.value = s.commission_value !== null ? Math.round(s.commission_value).toLocaleString('id-ID') : '';
  } else {
    valInput.value = '';
  }

  onCommissionTypeChange();
  document.getElementById('modalServis').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modalServis').classList.add('hidden');
}

async function saveService() {
  const rawPrice = document.getElementById('fieldHarga').value.replace(/\./g, '');
  const cType = document.getElementById('fieldCommissionType').value;
  let cVal = null;

  if (cType === 'percentage') {
    const rawVal = document.getElementById('fieldCommissionValue').value.trim();
    if (!rawVal) {
      alert('Silakan masukkan persentase komisi mekanik (%)!');
      return;
    }
    cVal = parseFloat(rawVal);
    if (isNaN(cVal) || cVal < 0 || cVal > 100) {
      alert('Persentase komisi harus di antara 0 sampai 100%!');
      return;
    }
  } else if (cType === 'nominal') {
    const rawVal = document.getElementById('fieldCommissionValue').value.replace(/\./g, '').trim();
    if (!rawVal) {
      alert('Silakan masukkan nominal komisi mekanik (Rp)!');
      return;
    }
    cVal = parseFloat(rawVal);
    if (isNaN(cVal) || cVal < 0) {
      alert('Nominal komisi tidak boleh negatif!');
      return;
    }
  }

  const payload = {
    name:  document.getElementById('fieldNama').value.trim(),
    price: parseFloat(rawPrice) || 0,
    commission_type: cType,
    commission_value: cVal
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

const fieldCommValEl = document.getElementById('fieldCommissionValue');
if (fieldCommValEl) {
  fieldCommValEl.addEventListener('input', function() {
    const type = document.getElementById('fieldCommissionType').value;
    if (type === 'nominal') {
      formatNumberInput(this);
    } else if (type === 'percentage') {
      // allow only numeric and decimal
      this.value = this.value.replace(/[^0-9.]/g, '');
    }
  });
}

loadData();
