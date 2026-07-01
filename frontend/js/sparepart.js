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

const isAdminOrOwner = user.role === 'admin' || user.role === 'owner';

// Hide bulk adjust button and Harga Beli header if not admin/owner
if (!isAdminOrOwner) {
  const bulkBtn = document.querySelector('button[onclick="openBulkAdjustModal()"]');
  if (bulkBtn) bulkBtn.style.display = 'none';
  
  const hbHeader = document.getElementById('headerHargaBeli');
  if (hbHeader) hbHeader.style.display = 'none';
}

// Hide stock opname button for kasir
if (user.role === 'kasir') {
  const opnameBtn = document.querySelector('button[onclick="window.location.href=\'opname.html\'"]');
  if (opnameBtn) opnameBtn.style.display = 'none';
}

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

function formatOpnameDate(dateStr) {
  if (!dateStr) return '<span style="color:#94a3b8; font-style:italic;">Belum</span>';
  const d = new Date(dateStr);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function normalizeUnit(u) {
  if (!u) return 'pcs';
  const val = String(u).trim().toLowerCase();
  if (['pcs', 'psc', 'pc', 'piece', 'pieces', 'pices'].includes(val)) return 'pcs';
  if (['set', 'st', 'sets'].includes(val)) return 'set';
  if (['botol', 'btl'].includes(val)) return 'botol';
  if (['liter', 'ltr'].includes(val)) return 'liter';
  if (['pack', 'pak', 'pck'].includes(val)) return 'pack';
  if (['dus', 'box', 'karton', 'kotak'].includes(val)) return 'dus';
  if (['kaleng', 'klg'].includes(val)) return 'kaleng';
  return val;
}

function exportExcel() {
  if (!spareparts.length) { alert('Tidak ada data untuk diekspor!'); return; }

  const headers = [
    'No', 'Kode', 'Nama Barang', 'Kategori', 'Merk', 'Tipe Motor', 'Supplier',
    'Lokasi Rak', 'Stok', 'Harga Beli', 'Harga Jual', 'Diskon (%)', 'Status'
  ];

  const rows = spareparts.map((s, i) => [
    i + 1,
    s.code || '',
    s.name,
    s.category_name || '',
    s.brand || '',
    s.type || '',
    s.supplier || '',
    s.rack_location || '',
    s.stock ? `${s.stock} ${normalizeUnit(s.unit)}` : '0 pcs',
    Number(s.buy_price) || 0,
    Number(s.price) || 0,
    Number(s.discount) || 0,
    s.stock === 0 ? 'Habis' : s.stock <= 5 ? 'Menipis' : 'Aman'
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

  // Set lebar kolom
  ws['!cols'] = [
    { wch: 5 }, { wch: 20 }, { wch: 30 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 },
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
let currentPage = 1;
const itemsPerPage = 50;
let filteredCount = 0;
let selectedSparepartIds = new Set();

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
    categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('') +
    '<option value="ADD_NEW" style="color: #ea6c0a; font-weight: bold;">+ Tambah Kategori Baru</option>';
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

  const keywords = search.split(/\s+/).filter(Boolean);

  let filtered = spareparts.filter(p => {
    let matchSearch = true;
    if (keywords.length > 0) {
      const searchString = `${p.name} ${p.nama_lain || ''} ${p.code || ''} ${p.rack_location || ''} ${p.type || ''}`.toLowerCase();
      matchSearch = keywords.every(kw => searchString.includes(kw));
    }
    const matchKat = !katFilter || String(p.category_id) === katFilter;
    const matchStok = !stokFilter ||
      (stokFilter === 'aman' && p.stock > 5) ||
      (stokFilter === 'menipis' && p.stock > 0 && p.stock <= 5) ||
      (stokFilter === 'habis' && p.stock === 0);
    return matchSearch && matchKat && matchStok;
  });

  // Client-side sorting
  const sortBy = document.getElementById('sortSpareparts')?.value || 'name_asc';
  filtered.sort((a, b) => {
    if (sortBy === 'name_asc') {
      return a.name.localeCompare(b.name);
    }
    if (sortBy === 'opname_asc') {
      const dateA = a.last_opname_at ? new Date(a.last_opname_at).getTime() : 0;
      const dateB = b.last_opname_at ? new Date(b.last_opname_at).getTime() : 0;
      if (dateA === dateB) return a.name.localeCompare(b.name);
      return dateA - dateB;
    }
    if (sortBy === 'opname_desc') {
      const dateA = a.last_opname_at ? new Date(a.last_opname_at).getTime() : 0;
      const dateB = b.last_opname_at ? new Date(b.last_opname_at).getTime() : 0;
      if (dateA === dateB) return a.name.localeCompare(b.name);
      return dateB - dateA;
    }
    return 0;
  });

  filteredCount = filtered.length;

  const totalPages = Math.ceil(filtered.length / itemsPerPage) || 1;
  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;

  const startIdx = (currentPage - 1) * itemsPerPage;
  const endIdx = startIdx + itemsPerPage;
  const paginated = filtered.slice(startIdx, endIdx);

  const tbody = document.getElementById('sparepartTableBody');
  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="${isAdminOrOwner ? 15 : 14}" class="empty-state">Tidak ada data sparepart</td></tr>`;
    updatePaginationUI(0, 0, 0);
    return;
  }

  tbody.innerHTML = paginated.map((p, i) => `
    <tr>
      <td style="text-align: center; vertical-align: middle;">
        <input type="checkbox" class="sparepart-checkbox" value="${p.id}" ${selectedSparepartIds.has(p.id) ? 'checked' : ''} 
               onchange="handleRowCheckboxChange(this)" style="cursor: pointer; width: 16px; height: 16px; accent-color: #e87722;">
      </td>
      <td>${startIdx + i + 1}</td>
      <td><span class="code-badge">${p.code || '-'}</span></td>
      <td>${p.name}</td>
      <td>
        <div class="alias-cell" style="position: relative;">
          <span class="alias-text" style="cursor: pointer; border-bottom: 1px dashed #94a3b8; display: inline-block; min-width: 60px;" 
                onclick="enableInlineEdit(${p.id}, this)" title="Klik untuk edit langsung">${escHtml(p.nama_lain || '-')}</span>
        </div>
      </td>
      <td>
        <div class="category-cell" style="position: relative;">
          <span class="category-text" style="cursor: pointer; border-bottom: 1px dashed #94a3b8; display: inline-block; min-width: 60px;" 
                onclick="enableInlineCategoryEdit(${p.id}, this)" title="Klik untuk edit kategori langsung">${escHtml(p.category_name || '-')}</span>
        </div>
      </td>
      <td>${p.brand || '-'}</td>
      <td>${p.type || '-'}</td>
      <td>
        <div class="rack-cell" style="position: relative;">
          <span class="rack-text" style="cursor: pointer; border-bottom: 1px dashed #94a3b8; display: inline-block; min-width: 60px;" 
                onclick="enableInlineRackEdit(${p.id}, this)" title="Klik untuk edit rak langsung">${escHtml(p.rack_location || '-')}</span>
        </div>
      </td>
      <td>
        <strong style="cursor: pointer; border-bottom: 1px dashed #e87722; color: #e87722; display: inline-block;" 
                onclick="openStockCard(${p.id})" 
                title="Klik untuk melihat Kartu Stok (Mutasi) dan riwayat barang">${p.stock} ${normalizeUnit(p.unit)}</strong>
      </td>
      ${isAdminOrOwner ? `
        <td>
          <div class="price-cell" style="position: relative;">
            <span class="buy-price-text" style="cursor: pointer; border-bottom: 1px dashed #cbd5e1; display: inline-block; min-width: 60px;" 
                  onclick="enableInlinePriceEdit(${p.id}, this, 'buy_price')" title="Klik untuk edit langsung">${rupiah(p.buy_price)}</span>
          </div>
        </td>
      ` : ''}
      <td>
        <div class="price-cell" style="position: relative;">
          <span class="price-text" style="cursor: pointer; border-bottom: 1px dashed #94a3b8; font-weight:600; display: inline-block; min-width: 60px;" 
                onclick="enableInlinePriceEdit(${p.id}, this, 'price')" title="Klik untuk edit langsung">${rupiah(p.price)}</span>
        </div>
      </td>
      <td>${formatOpnameDate(p.last_opname_at)}</td>
      <td>${getStatusBadge(p.stock)}</td>
      <td>
        <div class="action-btns">
          <button class="btn-edit" onclick="openEditModal(${p.id})">Edit</button>
          ${isAdminOrOwner ? `<button class="btn-del-row" onclick="openDeleteModal(${p.id}, '${p.name.replace(/'/g, "\\'")}')">Hapus</button>` : ''}
        </div>
      </td>
    </tr>
  `).join('');

  // Sync the master checkbox
  const pageCheckboxes = document.querySelectorAll('.sparepart-checkbox');
  const allChecked = pageCheckboxes.length > 0 && Array.from(pageCheckboxes).every(cb => cb.checked);
  const selectAll = document.getElementById('selectAllCheckbox');
  if (selectAll) selectAll.checked = allChecked;

  updatePaginationUI(filtered.length, startIdx, endIdx);
}

// Search & filter events
let searchTimeout;
document.getElementById('searchInput')?.addEventListener('input', function() {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    currentPage = 1;
    renderTable();
  }, 250);
});
document.getElementById('filterKategori')?.addEventListener('change', function() {
  currentPage = 1;
  renderTable();
});
document.getElementById('filterStok')?.addEventListener('change', function() {
  currentPage = 1;
  renderTable();
});
document.getElementById('sortSpareparts')?.addEventListener('change', function() {
  currentPage = 1;
  renderTable();
});

function updatePaginationUI(totalItems, start, end) {
  const container = document.getElementById('paginationContainer');
  if (!container) return;

  if (totalItems === 0) {
    container.style.display = 'none';
    return;
  } else {
    container.style.display = 'flex';
  }

  const displayStart = start + 1;
  const displayEnd = Math.min(end, totalItems);
  
  const infoEl = document.getElementById('paginationInfo');
  if (infoEl) {
    infoEl.textContent = `Menampilkan ${displayStart} - ${displayEnd} dari ${totalItems} item`;
  }

  const btnFirst = document.getElementById('btnFirstPage');
  const btnPrev = document.getElementById('btnPrevPage');
  const btnNext = document.getElementById('btnNextPage');
  const btnLast = document.getElementById('btnLastPage');
  
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;

  const totalPagesEl = document.getElementById('paginationTotalPages');
  if (totalPagesEl) {
    totalPagesEl.textContent = totalPages;
  }
  
  const selectEl = document.getElementById('paginationSelect');
  if (selectEl) {
    if (selectEl.options.length !== totalPages) {
      let optionsHtml = '';
      for (let i = 1; i <= totalPages; i++) {
        optionsHtml += `<option value="${i}">${i}</option>`;
      }
      selectEl.innerHTML = optionsHtml;
    }
    selectEl.value = currentPage;
  }
  
  if (btnFirst) {
    btnFirst.disabled = currentPage === 1;
    btnFirst.style.opacity = currentPage === 1 ? '0.5' : '1';
    btnFirst.style.cursor = currentPage === 1 ? 'not-allowed' : 'pointer';
  }
  if (btnPrev) {
    btnPrev.disabled = currentPage === 1;
    btnPrev.style.opacity = currentPage === 1 ? '0.5' : '1';
    btnPrev.style.cursor = currentPage === 1 ? 'not-allowed' : 'pointer';
  }
  if (btnNext) {
    btnNext.disabled = currentPage === totalPages;
    btnNext.style.opacity = currentPage === totalPages ? '0.5' : '1';
    btnNext.style.cursor = currentPage === totalPages ? 'not-allowed' : 'pointer';
  }
  if (btnLast) {
    btnLast.disabled = currentPage === totalPages;
    btnLast.style.opacity = currentPage === totalPages ? '0.5' : '1';
    btnLast.style.cursor = currentPage === totalPages ? 'not-allowed' : 'pointer';
  }
}

window.getLastPage = function() {
  return Math.ceil(filteredCount / itemsPerPage) || 1;
};

window.goToPage = function(pageNum) {
  const lastPage = window.getLastPage();
  if (pageNum < 1) pageNum = 1;
  if (pageNum > lastPage) pageNum = lastPage;
  currentPage = pageNum;
  renderTable();
};

window.changePage = function(delta) {
  window.goToPage(currentPage + delta);
};

// Add quick category creation inline
document.getElementById('fieldKategori')?.addEventListener('change', async function() {
  if (this.value === 'ADD_NEW') {
    const newName = prompt('Masukkan nama kategori baru:');
    if (!newName || !newName.trim()) {
      this.value = '';
      return;
    }
    try {
      const res = await fetch(`${API}/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: newName.trim() })
      });
      const data = await res.json();
      if (data.success) {
        const newCatId = data.data?.id;
        
        // Reload all categories
        const resC = await fetch(`${API}/categories`, { headers: { Authorization: `Bearer ${token}` } });
        const cData = await resC.json();
        if (cData.success) {
          categories = cData.data;
          populateCategoryFilter();
          populateCategorySelect();
          if (newCatId) {
            this.value = newCatId;
          }
        }
      } else {
        alert('Gagal menambah kategori: ' + data.message);
        this.value = '';
      }
    } catch (err) {
      alert('Koneksi error!');
      this.value = '';
    }
  }
});

function setRackSelectValue(selectId, value) {
  const selectEl = document.getElementById(selectId);
  if (!selectEl) return;
  
  // Remove any previous temporary legacy options
  const tempOpt = selectEl.querySelector('.temp-legacy-option');
  if (tempOpt) tempOpt.remove();

  const val = (value || '').trim();
  if (val) {
    // Generate standard options to check
    const standardRacks = [];
    for (let i = 1; i <= 12; i++) {
      standardRacks.push(`${i}A`, `${i}B`, `${i}C`);
    }
    
    if (!standardRacks.includes(val)) {
      const opt = document.createElement('option');
      opt.value = val;
      opt.textContent = `${val} (Non-standar)`;
      opt.className = 'temp-legacy-option';
      opt.style.color = '#ef4444'; // Red color to indicate non-standard
      selectEl.insertBefore(opt, selectEl.options[1]);
    }
  }
  selectEl.value = val;
}

// Add modal
function openAddModal() {
  editId = null;
  document.getElementById('modalTitle').textContent = 'Tambah Sparepart';
  document.getElementById('formSparepart').reset();
  setRackSelectValue('fieldRak', '');
  const namaLainEl = document.getElementById('fieldNamaLain');
  if (namaLainEl) namaLainEl.value = '';
  const savedMarkup = localStorage.getItem('default_markup') || '30';
  const markupEl = document.getElementById('fieldMarkup');
  if (markupEl) markupEl.value = savedMarkup;
  document.getElementById('modalSparepart').classList.remove('hidden');
}

function openEditModal(id) {
  const p = spareparts.find(s => s.id === id);
  if (!p) return;
  editId = id;
  document.getElementById('modalTitle').textContent = 'Edit Sparepart';
  document.getElementById('fieldKode').value = p.code || '';
  setRackSelectValue('fieldRak', p.rack_location);
  document.getElementById('fieldNama').value = p.name;
  const namaLainEl = document.getElementById('fieldNamaLain');
  if (namaLainEl) namaLainEl.value = p.nama_lain || '';
  document.getElementById('fieldKategori').value = p.category_id || '';
  document.getElementById('fieldSupplier').value = p.supplier || '';
  document.getElementById('fieldStok').value = p.stock;
  
  const buyPriceRaw = parseFloat(p.buy_price) || 0;
  const priceRaw = parseFloat(p.price) || 0;
  document.getElementById('fieldHargaBeli').value = buyPriceRaw ? Math.round(buyPriceRaw).toLocaleString('id-ID') : '0';
  document.getElementById('fieldHarga').value = priceRaw ? Math.round(priceRaw).toLocaleString('id-ID') : '0';
  
  let markupVal = '';
  if (buyPriceRaw > 0) {
    markupVal = Math.round(((priceRaw - buyPriceRaw) / buyPriceRaw) * 100);
  }
  const markupEl = document.getElementById('fieldMarkup');
  if (markupEl) markupEl.value = markupVal;

  document.getElementById('fieldDiskon').value = p.discount || 0;
  document.getElementById('fieldMerk').value = p.brand || '';
  document.getElementById('fieldTipe').value = p.type || '';
  document.getElementById('fieldSatuan').value = normalizeUnit(p.unit);
  document.getElementById('modalSparepart').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modalSparepart').classList.add('hidden');
}

async function saveSparepart() {
  const markupVal = document.getElementById('fieldMarkup')?.value || '30';
  localStorage.setItem('default_markup', markupVal);

  const payload = {
    code: document.getElementById('fieldKode').value.trim(),
    rack_location: document.getElementById('fieldRak').value.trim(),
    name: document.getElementById('fieldNama').value.trim(),
    nama_lain: document.getElementById('fieldNamaLain')?.value.trim() || null,
    category_id: document.getElementById('fieldKategori').value || null,
    supplier: document.getElementById('fieldSupplier').value.trim() || null,
    brand: document.getElementById('fieldMerk').value.trim() || null,
    type: document.getElementById('fieldTipe').value.trim() || null,
    stock: parseInt(document.getElementById('fieldStok').value) || 0,
    buy_price: parseFloat(document.getElementById('fieldHargaBeli').value.replace(/\./g, '')) || 0,
    price: parseFloat(document.getElementById('fieldHarga').value.replace(/\./g, '')) || 0,
    discount: parseFloat(document.getElementById('fieldDiskon').value) || 0,
    unit: document.getElementById('fieldSatuan').value
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

function openBulkAdjustModal() {
  const sel = document.getElementById('bulkAdjustCategory');
  if (sel) {
    let optionsHtml = '';
    if (selectedSparepartIds.size > 0) {
      optionsHtml += `<option value="selected" style="font-weight: bold; color: #e87722;">Item yang Dipilih (${selectedSparepartIds.size} item)</option>`;
    }
    optionsHtml += '<option value="">Semua Kategori</option>' +
      categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    sel.innerHTML = optionsHtml;
    
    if (selectedSparepartIds.size > 0) {
      sel.value = 'selected';
    } else {
      sel.value = '';
    }
  }
  document.getElementById('bulkAdjustValue').value = '';
  document.getElementById('bulkAdjustPassword').value = '';
  document.getElementById('bulkAdjustError').style.display = 'none';
  const btnSave = document.getElementById('btnSaveBulkAdjust');
  if (btnSave) {
    btnSave.disabled = false;
    btnSave.textContent = 'Terapkan Perubahan';
  }
  
  document.getElementById('modalBulkAdjust').classList.remove('hidden');
  setTimeout(() => document.getElementById('bulkAdjustValue').focus(), 100);
}

function closeBulkAdjustModal() {
  document.getElementById('modalBulkAdjust').classList.add('hidden');
}

async function submitBulkAdjust() {
  const category_value = document.getElementById('bulkAdjustCategory').value;
  const adjust_value = parseFloat(document.getElementById('bulkAdjustValue').value);
  const rounding = parseInt(document.getElementById('bulkAdjustRounding').value);
  const password = document.getElementById('bulkAdjustPassword').value;
  const errEl = document.getElementById('bulkAdjustError');

  if (isNaN(adjust_value)) {
    errEl.textContent = 'Nilai penyesuaian wajib diisi!';
    errEl.style.display = 'block';
    return;
  }
  if (!password) {
    errEl.textContent = 'Password verifikasi wajib diisi!';
    errEl.style.display = 'block';
    return;
  }

  const btnSave = document.getElementById('btnSaveBulkAdjust');
  if (btnSave) {
    btnSave.disabled = true;
    btnSave.textContent = 'Memproses...';
  }

  const payload = {
    price_type: 'sell',
    adjust_type: 'markup',
    adjust_value,
    rounding,
    password
  };

  if (category_value === 'selected') {
    payload.sparepart_ids = Array.from(selectedSparepartIds);
  } else if (category_value !== '') {
    payload.category_id = parseInt(category_value);
  }

  try {
    const res = await fetch(`${API}/spareparts/bulk-adjust`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success) {
      selectedSparepartIds.clear();
      updateBulkButtonState();
      closeBulkAdjustModal();
      loadData();
      alert(data.message);
    } else {
      errEl.textContent = data.message || 'Gagal menyesuaikan harga';
      errEl.style.display = 'block';
      if (btnSave) {
        btnSave.disabled = false;
        btnSave.textContent = 'Terapkan Perubahan';
      }
    }
  } catch (err) {
    errEl.textContent = 'Koneksi error!';
    errEl.style.display = 'block';
    if (btnSave) {
      btnSave.disabled = false;
      btnSave.textContent = 'Terapkan Perubahan';
    }
  }
}

window.toggleSelectAll = function(masterCheckbox) {
  const checkboxes = document.querySelectorAll('.sparepart-checkbox');
  checkboxes.forEach(cb => {
    cb.checked = masterCheckbox.checked;
    const id = parseInt(cb.value);
    if (masterCheckbox.checked) {
      selectedSparepartIds.add(id);
    } else {
      selectedSparepartIds.delete(id);
    }
  });
  updateBulkButtonState();
};

window.handleRowCheckboxChange = function(cb) {
  const id = parseInt(cb.value);
  if (cb.checked) {
    selectedSparepartIds.add(id);
  } else {
    selectedSparepartIds.delete(id);
  }
  
  const checkboxes = document.querySelectorAll('.sparepart-checkbox');
  const allChecked = checkboxes.length > 0 && Array.from(checkboxes).every(c => c.checked);
  const selectAll = document.getElementById('selectAllCheckbox');
  if (selectAll) selectAll.checked = allChecked;
  
  updateBulkButtonState();
};

function updateBulkButtonState() {
  const bulkBtn = document.querySelector('button[onclick="openBulkAdjustModal()"]');
  if (!bulkBtn) return;
  
  if (selectedSparepartIds.size > 0) {
    bulkBtn.innerHTML = `⚡ Ubah Harga Pilihan (${selectedSparepartIds.size})`;
    bulkBtn.classList.remove('btn-secondary');
    bulkBtn.classList.add('btn-primary');
  } else {
    bulkBtn.innerHTML = `⚡ Ubah Harga Massal`;
    bulkBtn.classList.remove('btn-primary');
    bulkBtn.classList.add('btn-secondary');
  }
}


window.enableInlinePriceEdit = function(id, spanEl, priceField) {
  if (spanEl.dataset.editing === 'true') return;
  spanEl.dataset.editing = 'true';
  
  const p = spareparts.find(s => s.id === id);
  if (!p) return;
  
  const currentValueRaw = parseFloat(p[priceField]) || 0;
  const currentValueFormatted = Math.round(currentValueRaw).toLocaleString('id-ID');
  
  const input = document.createElement('input');
  input.type = 'text';
  input.value = currentValueFormatted;
  input.className = 'inline-edit-input';
  input.style.width = '100px';
  input.style.display = 'inline-block';
  input.style.height = '26px';
  input.style.padding = '2px 6px';
  
  const parent = spanEl.parentNode;
  parent.innerHTML = '';
  parent.appendChild(input);
  input.focus();
  input.select();
  
  input.addEventListener('input', function() {
    let val = this.value.replace(/\D/g, '');
    if (val) {
      val = Number(val).toLocaleString('id-ID');
    }
    this.value = val;
  });
  
  let isSaved = false;
  
  const saveValue = async () => {
    if (isSaved) return;
    isSaved = true;
    
    const rawVal = input.value.replace(/\./g, '');
    const newValue = parseFloat(rawVal) || 0;
    
    if (newValue === currentValueRaw) {
      renderTable();
      return;
    }
    
    try {
      const payload = {
        code: p.code || '',
        rack_location: p.rack_location || '',
        name: p.name,
        nama_lain: p.nama_lain || null,
        category_id: p.category_id || null,
        supplier: p.supplier || '',
        brand: p.brand || '',
        type: p.type || '',
        stock: parseInt(p.stock) || 0,
        buy_price: priceField === 'buy_price' ? newValue : (parseFloat(p.buy_price) || 0),
        price: priceField === 'price' ? newValue : (parseFloat(p.price) || 0),
        discount: parseFloat(p.discount) || 0,
        unit: p.unit
      };
      
      const res = await fetch(`${API}/spareparts/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        loadData();
      } else {
        alert('Gagal mengupdate harga: ' + data.message);
        renderTable();
      }
    } catch (err) {
      console.error(err);
      alert('Koneksi error!');
      renderTable();
    }
  };
  
  const cancelEdit = () => {
    if (isSaved) return;
    isSaved = true;
    renderTable();
  };
  
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveValue();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelEdit();
    }
  });
  
  input.addEventListener('blur', () => {
    saveValue();
  });
};

loadData();

// Helper to format text input to thousands separator with dots
function formatNumberInput(inputEl) {
  let val = inputEl.value.replace(/\D/g, ''); // keep only digits
  if (val) {
    val = Number(val).toLocaleString('id-ID');
  }
  inputEl.value = val;
}

// Calculate general selling price based on purchase price and markup
function calcHargaJual() {
  const rawHarga = document.getElementById('fieldHargaBeli')?.value.replace(/\./g, '') || '0';
  const harga = parseFloat(rawHarga);
  const markup = parseFloat(document.getElementById('fieldMarkup')?.value || 0);
  const jual = Math.ceil((harga * (1 + markup / 100)) / 1000) * 1000; // Round to nearest 1000
  const el = document.getElementById('fieldHarga');
  if (el) el.value = jual ? Math.round(jual).toLocaleString('id-ID') : '0';
}

// Calculate markup percentage based on purchase price and selling price
function calcMarkupFromHargaJual() {
  const rawHargaBeli = document.getElementById('fieldHargaBeli')?.value.replace(/\./g, '') || '0';
  const rawHargaJual = document.getElementById('fieldHarga')?.value.replace(/\./g, '') || '0';
  const hargaBeli = parseFloat(rawHargaBeli);
  const hargaJual = parseFloat(rawHargaJual);
  let markup = 0;
  if (hargaBeli > 0) {
    markup = Math.round(((hargaJual - hargaBeli) / hargaBeli) * 100);
  }
  const el = document.getElementById('fieldMarkup');
  if (el) el.value = markup || '';
}

// Event listeners for real-time price formatting & markup calculations
document.getElementById('fieldHargaBeli')?.addEventListener('input', function() {
  formatNumberInput(this);
  calcHargaJual();
});
document.getElementById('fieldMarkup')?.addEventListener('input', function() {
  calcHargaJual();
});
document.getElementById('fieldHarga')?.addEventListener('input', function() {
  formatNumberInput(this);
  calcMarkupFromHargaJual();
});

// HTML sanitization helper
function escHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escAttr(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Inline editing for sparepart alias (nama_lain)
window.enableInlineEdit = function(id, spanEl) {
  if (spanEl.dataset.editing === 'true') return;
  spanEl.dataset.editing = 'true';
  
  const p = spareparts.find(s => s.id === id);
  const currentValue = p ? (p.nama_lain || '') : '';
  
  const input = document.createElement('input');
  input.type = 'text';
  input.value = currentValue;
  input.className = 'inline-edit-input';
  
  const parent = spanEl.parentNode;
  parent.innerHTML = '';
  parent.appendChild(input);
  input.focus();
  input.select();
  
  let isSaved = false;
  
  const saveValue = async () => {
    if (isSaved) return;
    isSaved = true;
    
    const newValue = input.value.trim();
    if (newValue === currentValue) {
      renderTable();
      return;
    }
    
    try {
      const payload = {
        code: p.code || '',
        rack_location: p.rack_location || '',
        name: p.name,
        nama_lain: newValue || null,
        category_id: p.category_id || null,
        supplier: p.supplier || '',
        brand: p.brand || '',
        type: p.type || '',
        stock: parseInt(p.stock) || 0,
        buy_price: parseFloat(p.buy_price) || 0,
        price: parseFloat(p.price) || 0,
        discount: parseFloat(p.discount) || 0,
        unit: p.unit
      };
      
      const res = await fetch(`${API}/spareparts/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        loadData();
      } else {
        alert('Gagal mengupdate nama lain: ' + data.message);
        renderTable();
      }
    } catch (err) {
      console.error(err);
      alert('Koneksi error!');
      renderTable();
    }
  };
  
  const cancelEdit = () => {
    if (isSaved) return;
    isSaved = true;
    renderTable();
  };
  
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveValue();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelEdit();
    }
  });
  
  input.addEventListener('blur', () => {
    saveValue();
  });
};

// Inline editing for sparepart category directly from the table row dropdown select
window.enableInlineCategoryEdit = function(id, spanEl) {
  if (spanEl.dataset.editing === 'true') return;
  spanEl.dataset.editing = 'true';
  
  const p = spareparts.find(s => s.id === id);
  const currentCatId = p ? (p.category_id || '') : '';
  
  const select = document.createElement('select');
  select.className = 'inline-edit-select';
  
  // Populate options
  let optionsHtml = '<option value="">-- Tanpa Kategori --</option>';
  optionsHtml += categories.map(c => `<option value="${c.id}" ${c.id == currentCatId ? 'selected' : ''}>${escHtml(c.name)}</option>`).join('');
  select.innerHTML = optionsHtml;
  
  const parent = spanEl.parentNode;
  parent.innerHTML = '';
  parent.appendChild(select);
  select.focus();
  
  let isSaved = false;
  
  const saveValue = async () => {
    if (isSaved) return;
    isSaved = true;
    
    const newCatId = select.value ? parseInt(select.value) : null;
    if (newCatId === (p.category_id || null)) {
      renderTable();
      return;
    }
    
    try {
      const payload = {
        code: p.code || '',
        rack_location: p.rack_location || '',
        name: p.name,
        nama_lain: p.nama_lain || null,
        category_id: newCatId,
        supplier: p.supplier || '',
        brand: p.brand || '',
        type: p.type || '',
        stock: parseInt(p.stock) || 0,
        buy_price: parseFloat(p.buy_price) || 0,
        price: parseFloat(p.price) || 0,
        discount: parseFloat(p.discount) || 0,
        unit: p.unit
      };
      
      const res = await fetch(`${API}/spareparts/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        loadData();
      } else {
        alert('Gagal mengupdate kategori: ' + data.message);
        renderTable();
      }
    } catch (err) {
      console.error(err);
      alert('Koneksi error!');
      renderTable();
    }
  };
  
  const cancelEdit = () => {
    if (isSaved) return;
    isSaved = true;
    renderTable();
  };
  
  select.addEventListener('change', () => {
    saveValue();
  });
  
  select.addEventListener('blur', () => {
    saveValue();
  });
  
  select.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      cancelEdit();
    }
  });
};

// Inline editing for sparepart rack location directly from the table row dropdown select
window.enableInlineRackEdit = function(id, spanEl) {
  if (spanEl.dataset.editing === 'true') return;
  spanEl.dataset.editing = 'true';
  
  const p = spareparts.find(s => s.id === id);
  const currentRack = p ? (p.rack_location || '') : '';
  
  const select = document.createElement('select');
  select.className = 'inline-edit-select';
  
  // Populate options (1A to 12C)
  const standardRacks = [];
  for (let i = 1; i <= 12; i++) {
    standardRacks.push(`${i}A`, `${i}B`, `${i}C`);
  }
  
  let optionsHtml = '<option value="">-- Tanpa Rak --</option>';
  if (currentRack && !standardRacks.includes(currentRack)) {
    optionsHtml += `<option value="${escAttr(currentRack)}" selected style="color:#ef4444;">${escHtml(currentRack)} (Non-standar)</option>`;
  }
  optionsHtml += standardRacks.map(opt => {
    const isSelected = opt === currentRack ? 'selected' : '';
    return `<option value="${opt}" ${isSelected}>${opt}</option>`;
  }).join('');
  
  select.innerHTML = optionsHtml;
  
  const parent = spanEl.parentNode;
  parent.innerHTML = '';
  parent.appendChild(select);
  select.focus();
  
  let isSaved = false;
  
  const saveValue = async () => {
    if (isSaved) return;
    isSaved = true;
    
    const newRack = select.value.trim() || null;
    if (newRack === (p.rack_location || null)) {
      renderTable();
      return;
    }
    
    try {
      const payload = {
        code: p.code || '',
        rack_location: newRack,
        name: p.name,
        nama_lain: p.nama_lain || null,
        category_id: p.category_id || null,
        supplier: p.supplier || '',
        brand: p.brand || '',
        type: p.type || '',
        stock: parseInt(p.stock) || 0,
        buy_price: parseFloat(p.buy_price) || 0,
        price: parseFloat(p.price) || 0,
        discount: parseFloat(p.discount) || 0,
        unit: p.unit
      };
      
      const res = await fetch(`${API}/spareparts/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        loadData();
      } else {
        alert('Gagal mengupdate lokasi rak: ' + data.message);
        renderTable();
      }
    } catch (err) {
      console.error(err);
      alert('Koneksi error!');
      renderTable();
    }
  };
  
  const cancelEdit = () => {
    if (isSaved) return;
    isSaved = true;
    renderTable();
  };
  
  select.addEventListener('change', () => {
    saveValue();
  });
  
  select.addEventListener('blur', () => {
    saveValue();
  });
  
  select.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      cancelEdit();
    }
  });
};

// Open and render the Stock Card (Mutasi) modal
window.openStockCard = async function(id) {
  const p = spareparts.find(s => s.id === id);
  const name = p ? p.name : 'Sparepart';
  
  document.getElementById('stockCardTitle').textContent = `📋 Kartu Stok — ${name}`;
  document.getElementById('stockCardSubtitle').textContent = 'Memuat riwayat mutasi...';
  const tbody = document.getElementById('stockCardTableBody');
  tbody.innerHTML = '<tr><td colspan="5" class="empty-state">Memuat data kartu stok...</td></tr>';
  document.getElementById('modalStockCard').classList.remove('hidden');

  try {
    const res = await fetch(`${API}/spareparts/${id}/stock-card`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) {
      const text = await res.text();
      let errorMsg = 'Server Error';
      try {
        const parsed = JSON.parse(text);
        errorMsg = parsed.message || errorMsg;
      } catch(_) {}
      tbody.innerHTML = `<tr><td colspan="5" class="empty-state" style="color:#e74c3c;">Gagal memuat: ${errorMsg}</td></tr>`;
      return;
    }
    const data = await res.json();
    if (data.success) {
      document.getElementById('stockCardSubtitle').innerHTML = `Kode: <strong style="color:#0f172a;">${data.sparepart.code || '-'}</strong> | Stok Saat Ini: <strong style="color:#e87722;">${data.sparepart.current_stock} pcs</strong>`;
      
      const ledger = data.data;
      if (!ledger.length) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty-state">Tidak ada riwayat mutasi stok.</td></tr>';
        return;
      }
      
      // Render logs in reverse chronological order (newest first)
      const reversedLedger = [...ledger].reverse();

      tbody.innerHTML = reversedLedger.map(m => {
        const tgl = m.created_at 
          ? new Date(m.created_at).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
          : '-';
          
        let typeBadge = '';
        if (m.type === 'pembelian') {
          typeBadge = '<span class="badge" style="background:#e8f8f0; color:#27ae60;">Pembelian</span>';
        } else if (m.type === 'penjualan') {
          typeBadge = '<span class="badge" style="background:#fdecea; color:#e74c3c;">Penjualan</span>';
        } else if (m.type === 'retur') {
          typeBadge = '<span class="badge" style="background:#fff8e6; color:#f39c12;">Retur</span>';
        } else {
          typeBadge = '<span class="badge" style="background:#eef2ff; color:#4a6cf7;">Penyesuaian</span>';
        }
        
        let qtyText = '';
        if (m.qty > 0) {
          qtyText = `<strong style="color:#27ae60;">+${m.qty}</strong>`;
        } else if (m.qty < 0) {
          qtyText = `<strong style="color:#e74c3c;">${m.qty}</strong>`;
        } else {
          qtyText = `<span>${m.qty}</span>`;
        }

        return `
          <tr>
            <td style="padding: 10px 12px; color: #64748b;">${tgl}</td>
            <td style="padding: 10px 12px; text-align: center;">${typeBadge}</td>
            <td style="padding: 10px 12px; font-weight: 500;">${escHtml(m.description)}</td>
            <td style="padding: 10px 12px; text-align: center; font-size: 13px;">${qtyText}</td>
            <td style="padding: 10px 12px; text-align: center; font-weight: 700; color: #0f172a;">${m.balance_after} pcs</td>
          </tr>
        `;
      }).join('');
    } else {
      tbody.innerHTML = `<tr><td colspan="5" class="empty-state" style="color:#e74c3c;">Gagal memuat: ${data.message}</td></tr>`;
    }
  } catch (err) {
    console.error(err);
    tbody.innerHTML = '<tr><td colspan="5" class="empty-state" style="color:#e74c3c;">Koneksi error!</td></tr>';
  }
};

window.closeStockCardModal = function() {
  document.getElementById('modalStockCard').classList.add('hidden');
};

