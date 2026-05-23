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

// Set user info
const welcomeEl = document.getElementById('welcomeText');
const avatarEl = document.getElementById('userAvatar');
if (welcomeEl) welcomeEl.textContent = user.username || 'Admin';
if (avatarEl) avatarEl.textContent = (user.username || 'A')[0].toUpperCase();

function openSidebar() {
  document.getElementById('sidebar')?.classList.add('open');
  document.getElementById('sidebarOverlay')?.classList.add('open');
}
function closeSidebar() {
  document.getElementById('sidebar')?.classList.remove('open');
  document.getElementById('sidebarOverlay')?.classList.remove('open');
}

function rupiah(n) {
  return 'Rp ' + Number(n || 0).toLocaleString('id-ID');
}

function exportExcel() {
  if (!spareparts.length) { alert('Tidak ada data untuk diekspor!'); return; }

  const headers = [
    'No', 'Kode', 'Nama Barang', 'Kategori', 'Supplier',
    'Lokasi Rak', 'Stok', 'Harga Beli', 'Harga Jual', 'Diskon (%)', 'Status'
  ];

  const rows = spareparts.map((s, i) => [
    i + 1,
    s.code || '',
    s.name,
    s.category_name || '',
    s.supplier || '',
    s.rack_location || '',
    s.stock,
    s.buy_price || 0,
    s.price,
    s.discount || 0,
    s.stock === 0 ? 'Habis' : s.stock <= 5 ? 'Menipis' : 'Aman'
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

  // Set lebar kolom
  ws['!cols'] = [
    { wch: 5 }, { wch: 20 }, { wch: 30 }, { wch: 15 }, { wch: 15 },
    { wch: 12 }, { wch: 8 }, { wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 10 }
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Stok Gudang');

  const now = new Date();
  const tgl = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`;
  XLSX.writeFile(wb, `stok_gudang_${tgl}.xlsx`);
}

function logout() {
  localStorage.clear();
  window.location.href = 'login.html';
}

let spareparts = [];
let categories = [];
let editId = null;
let deleteId = null;

async function loadData() {
  try {
    const [resS, resC] = await Promise.all([
      fetch(`${API}/spareparts`, { headers: { Authorization: `Bearer ${token}` } }),
      fetch(`${API}/categories`, { headers: { Authorization: `Bearer ${token}` } })
    ]);
    const [sData, cData] = await Promise.all([resS.json(), resC.json()]);
    if (sData.success) spareparts = sData.data;
    if (cData.success) categories = cData.data;
    renderStats();
    renderTable();
    populateCategoryFilter();
    populateCategorySelect();
  } catch (err) {
    console.error('Load error:', err);
  }
}

function renderStats() {
  const total = spareparts.length;
  const aman = spareparts.filter(p => p.stock > 5).length;
  const menipis = spareparts.filter(p => p.stock > 0 && p.stock <= 5).length;
  const habis = spareparts.filter(p => p.stock === 0).length;
  document.getElementById('statTotal').textContent = total;
  document.getElementById('statAman').textContent = aman;
  document.getElementById('statMenipis').textContent = menipis;
  document.getElementById('statHabis').textContent = habis;
}

function populateCategoryFilter() {
  const sel = document.getElementById('filterKategori');
  if (!sel) return;
  sel.innerHTML = '<option value="">Semua Kategori</option>' +
    categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
}

function populateCategorySelect() {
  const sel = document.getElementById('fieldKategori');
  if (!sel) return;
  sel.innerHTML = '<option value="">-- Pilih Kategori --</option>' +
    categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
}

function getStatusBadge(stock) {
  if (stock === 0) return '<span class="badge badge-habis">Habis</span>';
  if (stock <= 5) return '<span class="badge badge-menipis">Menipis</span>';
  return '<span class="badge badge-aman">Aman</span>';
}

function renderTable() {
  const search = document.getElementById('searchInput')?.value.toLowerCase() || '';
  const katFilter = document.getElementById('filterKategori')?.value || '';
  const stokFilter = document.getElementById('filterStok')?.value || '';

  let filtered = spareparts.filter(p => {
    const matchSearch = !search ||
      p.name.toLowerCase().includes(search) ||
      (p.code || '').toLowerCase().includes(search) ||
      (p.rack_location || '').toLowerCase().includes(search);
    const matchKat = !katFilter || String(p.category_id) === katFilter;
    const matchStok = !stokFilter ||
      (stokFilter === 'aman' && p.stock > 5) ||
      (stokFilter === 'menipis' && p.stock > 0 && p.stock <= 5) ||
      (stokFilter === 'habis' && p.stock === 0);
    return matchSearch && matchKat && matchStok;
  });

  const tbody = document.getElementById('sparepartTableBody');
  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="9" class="empty-state">Tidak ada data sparepart</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map((p, i) => `
    <tr>
      <td>${i + 1}</td>
      <td><span class="code-badge">${p.code || '-'}</span></td>
      <td>${p.name}</td>
      <td>${p.category_name || '-'}</td>
      <td>${p.rack_location || '-'}</td>
      <td><strong>${p.stock}</strong></td>
      <td>${rupiah(p.price)}</td>
      <td>${getStatusBadge(p.stock)}</td>
      <td>
        <div class="action-btns">
          <button class="btn-edit" onclick="openEditModal(${p.id})">Edit</button>
          <button class="btn-del-row" onclick="openDeleteModal(${p.id}, '${p.name.replace(/'/g, "\\'")}')">Hapus</button>
        </div>
      </td>
    </tr>
  `).join('');
}

// Search & filter events
document.getElementById('searchInput')?.addEventListener('input', renderTable);
document.getElementById('filterKategori')?.addEventListener('change', renderTable);
document.getElementById('filterStok')?.addEventListener('change', renderTable);

// Add modal
function openAddModal() {
  editId = null;
  document.getElementById('modalTitle').textContent = 'Tambah Sparepart';
  document.getElementById('formSparepart').reset();
  document.getElementById('modalSparepart').classList.remove('hidden');
}

function openEditModal(id) {
  const p = spareparts.find(s => s.id === id);
  if (!p) return;
  editId = id;
  document.getElementById('modalTitle').textContent = 'Edit Sparepart';
  document.getElementById('fieldKode').value = p.code || '';
  document.getElementById('fieldRak').value = p.rack_location || '';
  document.getElementById('fieldNama').value = p.name;
  document.getElementById('fieldKategori').value = p.category_id || '';
  document.getElementById('fieldStok').value = p.stock;
  document.getElementById('fieldHarga').value = p.price;
  document.getElementById('modalSparepart').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modalSparepart').classList.add('hidden');
}

async function saveSparepart() {
  const payload = {
    code: document.getElementById('fieldKode').value.trim(),
    rack_location: document.getElementById('fieldRak').value.trim(),
    name: document.getElementById('fieldNama').value.trim(),
    category_id: document.getElementById('fieldKategori').value || null,
    stock: parseInt(document.getElementById('fieldStok').value) || 0,
    price: parseFloat(document.getElementById('fieldHarga').value) || 0
  };

  if (!payload.name) { alert('Nama wajib diisi!'); return; }

  const btnSave = document.getElementById('btnSaveSparepart');
  if (btnSave) { btnSave.disabled = true; btnSave.textContent = 'Menyimpan...'; }

  try {
    const url = editId ? `${API}/spareparts/${editId}` : `${API}/spareparts`;
    const method = editId ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success) {
      closeModal();
      loadData();
    } else {
      alert('Gagal: ' + data.message);
    }
  } catch (err) {
    alert('Koneksi error!');
  } finally {
    if (btnSave) { btnSave.disabled = false; btnSave.textContent = 'Simpan'; }
  }
}

// Delete single
function openDeleteModal(id, name) {
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
    const res = await fetch(`${API}/spareparts/${deleteId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    if (data.success) {
      closeDeleteModal();
      loadData();
    } else {
      alert('Gagal: ' + data.message);
    }
  } catch (err) {
    alert('Koneksi error!');
  }
}

// Delete all
function openDeleteAllModal() {
  document.getElementById('deleteAllPassword').value = '';
  document.getElementById('modalDeleteAll').classList.remove('hidden');
}

function closeDeleteAllModal() {
  document.getElementById('modalDeleteAll').classList.add('hidden');
}

async function confirmDeleteAll() {
  const password = document.getElementById('deleteAllPassword').value;
  if (!password) { alert('Masukkan password!'); return; }

  const btnConfirm = document.getElementById('btnConfirmDeleteAll');
  if (btnConfirm) { btnConfirm.disabled = true; btnConfirm.textContent = 'Menghapus...'; }

  try {
    const res = await fetch(`${API}/spareparts/all`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ password })
    });
    const data = await res.json();
    if (data.success) {
      closeDeleteAllModal();
      loadData();
    } else {
      alert('Gagal: ' + data.message);
    }
  } catch (err) {
    alert('Koneksi error!');
  } finally {
    if (btnConfirm) { btnConfirm.disabled = false; btnConfirm.textContent = 'Hapus Semua'; }
  }
}

loadData();
