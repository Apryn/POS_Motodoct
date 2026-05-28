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
    tbody.innerHTML = '<tr><td colspan="5" class="empty-state">Tidak ada data mekanik</td></tr>';
    return;
  }
  tbody.innerHTML = data.map((m, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${escHtml(m.name)}</td>
      <td>${escHtml(m.phone || '-')}</td>
      <td><strong>${Number(m.commission_rate || 35).toFixed(1)}%</strong></td>
      <td>
        <div class="action-btns">
          <button class="btn-primary" style="padding: 5px 9px; font-size: 11px; display: inline-flex; align-items: center; gap: 4px;" onclick="openJobs(${m.id}, '${escAttr(m.name)}')">💼 Detail Kerja</button>
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
  document.getElementById('fieldKomisi').value = '35';
  document.getElementById('modalMekanik').classList.remove('hidden');
}

function openEdit(id) {
  const m = mechanics.find(x => x.id === id);
  if (!m) return;
  editId = id;
  document.getElementById('modalTitle').textContent = 'Edit Mekanik';
  document.getElementById('fieldNama').value = m.name;
  document.getElementById('fieldHp').value   = m.phone || '';
  document.getElementById('fieldKomisi').value = m.commission_rate || '35';
  document.getElementById('modalMekanik').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modalMekanik').classList.add('hidden');
}

async function saveMechanic() {
  const payload = {
    name:  document.getElementById('fieldNama').value.trim(),
    phone: document.getElementById('fieldHp').value.trim() || null,
    commission_rate: parseFloat(document.getElementById('fieldKomisi').value) || 35.00
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

// ── Detail Pekerjaan & Gaji ──────────────────────────────────────────────────
async function openJobs(id, name) {
  document.getElementById('jobsMechanicName').textContent = name;
  document.getElementById('totalMotorDisplay').textContent = '—';
  document.getElementById('totalWagesDisplay').textContent = 'Rp 0';
  document.getElementById('jobsTableBody').innerHTML = '<tr><td colspan="7" class="empty-state">Memuat histori pekerjaan...</td></tr>';
  document.getElementById('modalJobs').classList.remove('hidden');

  try {
    const res = await fetch(`${API}/mechanics/${id}/jobs`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (data.success && data.data.length > 0) {
      const list = data.data;
      
      // Ambil rate komisi dari data database
      const commRate = parseFloat(list[0].commission_rate || 35.00);

      // Hitung total motor unik berdasarkan plat nomor
      const uniquePlates = new Set(list.map(j => (j.license_plate || '').replace(/\s+/g, '').toUpperCase()).filter(p => p !== ''));
      document.getElementById('totalMotorDisplay').textContent = `${uniquePlates.size} motor (${list.length} kali servis)`;

      // Hitung total nilai pekerjaan kotor (gross)
      const totalWagesGross = list.reduce((sum, j) => sum + parseFloat(j.service_price || 0), 0);
      // Hitung upah komisi bersih (net)
      const totalWagesNet = (totalWagesGross * commRate) / 100;
      
      document.getElementById('totalWagesDisplay').textContent = `${formatRp(totalWagesNet)} (Komisi ${commRate}% dari ${formatRp(totalWagesGross)} kotor)`;

      document.getElementById('jobsTableBody').innerHTML = list.map((j, i) => {
        const tgl = new Date(j.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        return `
          <tr>
            <td>${i + 1}</td>
            <td>${tgl}</td>
            <td><strong>${escHtml(j.invoice_number)}</strong></td>
            <td>${escHtml(j.customer_name || 'Pelanggan Umum')}</td>
            <td><span class="code-badge" style="background:#1a1a2e; color:#fff; font-weight:800; font-size:11px;">${escHtml(j.license_plate || '-')}</span></td>
            <td>${escHtml(j.service_name)}</td>
            <td style="text-align:right; font-weight:700; color:#27ae60;">${formatRp(j.service_price)}</td>
          </tr>
        `;
      }).join('');
    } else {
      document.getElementById('totalMotorDisplay').textContent = '0';
      document.getElementById('totalWagesDisplay').textContent = 'Rp 0';
      document.getElementById('jobsTableBody').innerHTML = '<tr><td colspan="7" class="empty-state">Mekanik ini belum pernah menangani servis.</td></tr>';
    }
  } catch (err) {
    document.getElementById('jobsTableBody').innerHTML = '<tr><td colspan="7" class="empty-state" style="color:#e74c3c;">Gagal memuat data pekerjaan.</td></tr>';
  }
}

function closeJobsModal() {
  document.getElementById('modalJobs').classList.add('hidden');
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function escHtml(str) { return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function escAttr(str) { return String(str).replace(/'/g,"\\'"); }

// ── Init ──────────────────────────────────────────────────────────────────────
loadData();
