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

// Rupiah Short format helper
function rupiahShort(n) {
  n = Number(n || 0);
  if (n >= 1000000000) return 'Rp ' + (n / 1000000000).toFixed(1).replace('.', ',') + ' M';
  if (n >= 1000000) return 'Rp ' + (n / 1000000).toFixed(1).replace('.', ',') + ' Jt';
  if (n >= 1000) return 'Rp ' + (n / 1000).toFixed(1).replace('.', ',') + ' Rb';
  return 'Rp ' + n.toLocaleString('id-ID');
}

function logout() {
  localStorage.clear();
  window.location.href = 'login.html';
}

function roundToNearest500(val) {
  return Math.ceil(val / 500) * 500;
}

let purchases = [];
let spareparts = [];
let deleteId = null;
let importRows = [];
let isImporting = false;

async function loadData() {
  try {
    const [resP, resS] = await Promise.all([
      fetch(`${API}/purchases`, { headers: { Authorization: `Bearer ${token}` } }),
      fetch(`${API}/spareparts`, { headers: { Authorization: `Bearer ${token}` } })
    ]);
    const [pData, sData] = await Promise.all([resP.json(), resS.json()]);
    if (pData.success) purchases = pData.data;
    if (sData.success) spareparts = sData.data;
    renderStats();
    renderTable();
    populateSparepartSelect();
  } catch (err) {
    console.error('Load error:', err);
  }
}

function renderStats() {
  const total = purchases.length;
  const nominal = purchases.reduce((s, p) => s + parseFloat(p.total || 0), 0);
  const now = new Date();
  const bulanIni = purchases.filter(p => {
    const d = new Date(p.created_at);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const nominalBulan = bulanIni.reduce((s, p) => s + parseFloat(p.total || 0), 0);

  document.getElementById('statTotal').textContent = total;
  document.getElementById('statNominal').textContent = rupiahShort(nominal);
  document.getElementById('statBulan').textContent = bulanIni.length;
  document.getElementById('statNominalBulan').textContent = rupiahShort(nominalBulan);
}

function populateSparepartSelect() {
  const sel = document.getElementById('fieldSparepart');
  if (!sel) return;
  sel.innerHTML = '<option value="">-- Pilih Sparepart --</option>' +
    spareparts.map(s => `<option value="${s.id}" data-supplier="${s.supplier || ''}" data-buy="${s.buy_price || 0}" data-price="${s.price || 0}" data-rack="${s.rack_location || ''}">${s.name} (${s.code || '-'})</option>`).join('');
}

function onSparepartChange() {
  const sel = document.getElementById('fieldSparepart');
  const opt = sel.options[sel.selectedIndex];
  if (!opt || !opt.value) return;
  document.getElementById('fieldSupplier').value = opt.dataset.supplier || '';
  document.getElementById('fieldHargaBeli').value = opt.dataset.buy || '';
  document.getElementById('fieldRak').value = opt.dataset.rack || '';
  calcTotal();
  calcHargaJual();
}

// Calculate total purchase amount
function calcTotal() {
  const qty = parseFloat(document.getElementById('fieldQty')?.value || 0);
  const harga = parseFloat(document.getElementById('fieldHargaBeli')?.value || 0);
  const total = qty * harga;
  const el = document.getElementById('fieldTotal');
  if (el) el.value = total;
}

// Calculate general selling price
function calcHargaJual() {
  const harga = parseFloat(document.getElementById('fieldHargaBeli')?.value || 0);
  const markup = parseFloat(document.getElementById('fieldMarkup')?.value || 30);
  const jual = roundToNearest500(harga * (1 + markup / 100));
  const el = document.getElementById('fieldHargaJual');
  if (el) el.value = jual;
}

function renderTable() {
  const search = document.getElementById('searchInput')?.value.toLowerCase() || '';
  const from = document.getElementById('filterFrom')?.value || '';
  const to = document.getElementById('filterTo')?.value || '';

  let filtered = purchases.filter(p => {
    const matchSearch = !search ||
      (p.sparepart_name || '').toLowerCase().includes(search) ||
      (p.supplier || '').toLowerCase().includes(search) ||
      (p.sparepart_code || '').toLowerCase().includes(search);
    const dateStr = p.created_at ? p.created_at.split('T')[0] : '';
    const matchFrom = !from || dateStr >= from;
    const matchTo = !to || dateStr <= to;
    return matchSearch && matchFrom && matchTo;
  });

  const tbody = document.getElementById('pembelianTableBody');
  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="9" class="empty-state">Tidak ada data pembelian</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map((p, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${p.created_at ? new Date(p.created_at).toLocaleDateString('id-ID') : '-'}</td>
      <td>${p.supplier || '-'}</td>
      <td>${p.sparepart_name || '-'}</td>
      <td>${p.quantity}</td>
      <td>${rupiah(p.buy_price)}</td>
      <td>${rupiah(p.total)}</td>
      <td>${p.note || '-'}</td>
      <td>
        <button class="btn-del-row" onclick="openDeleteModal(${p.id})">Hapus</button>
      </td>
    </tr>
  `).join('');
}

function resetFilter() {
  document.getElementById('searchInput').value = '';
  document.getElementById('filterFrom').value = '';
  document.getElementById('filterTo').value = '';
  renderTable();
}

document.getElementById('searchInput')?.addEventListener('input', renderTable);
document.getElementById('filterFrom')?.addEventListener('change', renderTable);
document.getElementById('filterTo')?.addEventListener('change', renderTable);

function openAddModal() {
  document.getElementById('formPembelian').reset();
  const savedMarkup = localStorage.getItem('default_markup') || '30';
  const markupEl = document.getElementById('fieldMarkup');
  if (markupEl) markupEl.value = savedMarkup;
  document.getElementById('fieldTotal').value = '';
  document.getElementById('fieldHargaJual').value = '';
  document.getElementById('modalPembelian').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modalPembelian').classList.add('hidden');
}

async function savePembelian() {
  const sparepartId = document.getElementById('fieldSparepart').value;
  const supplier = document.getElementById('fieldSupplier').value.trim();
  const qty = parseInt(document.getElementById('fieldQty').value) || 0;
  const hargaBeli = parseFloat(document.getElementById('fieldHargaBeli').value) || 0;
  const markupVal = document.getElementById('fieldMarkup')?.value || '30';
  const hargaJual = parseFloat(document.getElementById('fieldHargaJual').value) || 0;
  const rak = document.getElementById('fieldRak').value.trim();
  const catatan = document.getElementById('fieldCatatan').value.trim();

  if (markupVal) {
    localStorage.setItem('default_markup', markupVal);
  }

  if (!sparepartId) { alert('Pilih sparepart!'); return; }
  if (!qty || qty <= 0) { alert('Qty harus lebih dari 0!'); return; }
  if (!hargaBeli || hargaBeli <= 0) { alert('Harga beli harus diisi!'); return; }

  const btnSave = document.getElementById('btnSavePembelian');
  if (btnSave) { btnSave.disabled = true; btnSave.textContent = 'Menyimpan...'; }

  try {
    const res = await fetch(`${API}/purchases`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        sparepart_id: parseInt(sparepartId),
        supplier,
        quantity: qty,
        buy_price: hargaBeli,
        sell_price: hargaJual,
        rack_location: rak,
        note: catatan
      })
    });
    const data = await res.json();
    if (data.success) {
      closeModal();
      loadData();
      if (data.data?.harga_naik && data.data?.saran) {
        setTimeout(() => alert(`⚠️ ${data.data.saran}`), 300);
      }
    } else {
      alert('Gagal: ' + data.message);
    }
  } catch (err) {
    alert('Koneksi error!');
  } finally {
    if (btnSave) { btnSave.disabled = false; btnSave.textContent = 'Simpan'; }
  }
}

function openDeleteModal(id) {
  deleteId = id;
  document.getElementById('modalDelete').classList.remove('hidden');
}

function closeDeleteModal() {
  document.getElementById('modalDelete').classList.add('hidden');
  deleteId = null;
}

async function confirmDelete() {
  if (!deleteId) return;
  try {
    const res = await fetch(`${API}/purchases/${deleteId}`, {
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

function openDeleteAllModal() {
  const passwordInput = document.getElementById('fieldDeleteAllPassword');
  if (passwordInput) passwordInput.value = '';
  document.getElementById('modalDeleteAll').classList.remove('hidden');
}

function closeDeleteAllModal() {
  document.getElementById('modalDeleteAll').classList.add('hidden');
}

async function confirmDeleteAll() {
  const passwordInput = document.getElementById('fieldDeleteAllPassword');
  const password = passwordInput ? passwordInput.value : '';
  if (!password) {
    alert('Password wajib diisi!');
    return;
  }
  
  try {
    const res = await fetch(`${API}/purchases/all`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
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
    console.error(err);
    alert('Koneksi error!');
  }
}

// ===== IMPORT EXCEL =====
function parseRows(sheetData) {
  if (!sheetData || sheetData.length < 2) return [];
  
  const headers = sheetData[0].map(h => String(h || '').trim().toLowerCase());
  
  const supplierIdx = headers.indexOf('supplier');
  const kodeIdx = headers.indexOf('kode');
  
  let namaIdx = headers.indexOf('nama');
  if (namaIdx === -1) namaIdx = headers.indexOf('nama barang');
  if (namaIdx === -1) namaIdx = 3; // fallback
  
  let merkIdx = headers.indexOf('merk');
  if (merkIdx === -1) merkIdx = headers.indexOf('brand');
  if (merkIdx === -1) merkIdx = 4; // fallback
  
  let tipeIdx = headers.indexOf('tipe');
  if (tipeIdx === -1) tipeIdx = headers.indexOf('tipe motor');
  if (tipeIdx === -1) tipeIdx = headers.indexOf('type');
  
  let qtyIdx = headers.indexOf('qty');
  if (qtyIdx === -1) qtyIdx = headers.indexOf('quantity');
  if (qtyIdx === -1) qtyIdx = 5; // fallback
  
  let beliPcsIdx = headers.indexOf('beli/pcs');
  if (beliPcsIdx === -1) beliPcsIdx = headers.indexOf('harga beli');
  if (beliPcsIdx === -1) beliPcsIdx = 6; // fallback
  
  let beliTotalIdx = headers.indexOf('beli/total');
  if (beliTotalIdx === -1) beliTotalIdx = 7; // fallback
  
  let jualPcsIdx = headers.indexOf('jual/pcs');
  if (jualPcsIdx === -1) jualPcsIdx = headers.indexOf('harga jual');
  if (jualPcsIdx === -1) jualPcsIdx = 8; // fallback
  
  let diskonIdx = headers.indexOf('diskon');
  if (diskonIdx === -1) diskonIdx = 9; // fallback
  
  let lokasiRakIdx = headers.indexOf('lokasi rak');
  if (lokasiRakIdx === -1) lokasiRakIdx = headers.indexOf('rak');
  if (lokasiRakIdx === -1) lokasiRakIdx = 10; // fallback

  const grouped = {};

  sheetData.forEach((row, idx) => {
    if (idx === 0) return; // skip header
    const excelRowNumber = idx + 1;
    
    const supplier = supplierIdx !== -1 ? String(row[supplierIdx] || '').trim() : '';
    const kode = kodeIdx !== -1 ? String(row[kodeIdx] || '').trim() : '';
    const nama = String(row[namaIdx] || '').trim();
    const merk = merkIdx !== -1 ? String(row[merkIdx] || '').trim() : '';
    const tipe = tipeIdx !== -1 ? String(row[tipeIdx] || '').trim() : '';
    const qty = parseInt(row[qtyIdx]) || 0;
    const beliPcs = parseFloat(row[beliPcsIdx]) || 0;
    const beliTotal = beliTotalIdx !== -1 && row[beliTotalIdx] !== undefined ? parseFloat(row[beliTotalIdx]) : (beliPcs * qty);
    const jualPcs = jualPcsIdx !== -1 ? parseFloat(row[jualPcsIdx]) : 0;
    const diskon = diskonIdx !== -1 ? parseFloat(row[diskonIdx]) : 0;
    const lokasiRak = lokasiRakIdx !== -1 ? String(row[lokasiRakIdx] || '').trim() : '';

    if (!nama || !qty) return;

    const key = kode 
      ? `code:${kode.toLowerCase()}` 
      : `name:${nama.toLowerCase()}||${supplier}||${beliPcs}`;

    if (grouped[key]) {
      grouped[key].qty += qty;
      grouped[key].beliTotal += beliTotal;
      grouped[key].mergedRows.push(excelRowNumber);
      grouped[key].allRows.push({
        excelRowNumber, supplier, kode, nama, merk, tipe, qty, beliPcs, beliTotal, jualPcs, diskon, lokasiRak
      });
    } else {
      grouped[key] = { 
        supplier, 
        kode, 
        nama, 
        merk, 
        tipe,
        qty, 
        beliPcs, 
        beliTotal, 
        jualPcs, 
        diskon, 
        lokasiRak,
        originalRow: excelRowNumber,
        mergedRows: [],
        allRows: [{
          excelRowNumber, supplier, kode, nama, merk, tipe, qty, beliPcs, beliTotal, jualPcs, diskon, lokasiRak
        }],
        selectedRowIndex: 0
      };
    }
  });

  return Object.values(grouped);
}

function handleImportFile(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(evt) {
    try {
      const wb = XLSX.read(evt.target.result, { type: 'binary' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
      importRows = parseRows(data);
      showImportPreview();
    } catch (err) {
      alert('Gagal membaca file: ' + err.message);
    }
  };
  reader.readAsBinaryString(file);
  e.target.value = '';
}

function showImportPreview() {
  const tbody = document.getElementById('previewTableBody');
  document.getElementById('importCount').textContent = importRows.length;

  const savedMarkup = localStorage.getItem('default_markup') || '30';
  const importMarkupEl = document.getElementById('importMarkupPercent');
  if (importMarkupEl) importMarkupEl.value = savedMarkup;

  tbody.innerHTML = importRows.map((r, i) => {
    const existing = r.kode 
      ? spareparts.find(s => s.code === r.kode)
      : spareparts.find(s => s.name.toLowerCase() === r.nama.toLowerCase() && s.supplier === r.supplier && parseFloat(s.buy_price) === r.beliPcs);

    let statusBadge = '';
    if (existing) {
      statusBadge = `<span class="badge" style="background: rgba(245, 158, 11, 0.1); color: #d97706; font-size: 10px; padding: 2px 8px; border-radius: 12px; font-weight: 600; border: 1px solid rgba(245, 158, 11, 0.2); vertical-align: middle;">UPDATE</span>`;
    } else {
      statusBadge = `<span class="badge" style="background: rgba(16, 185, 129, 0.1); color: #059669; font-size: 10px; padding: 2px 8px; border-radius: 12px; font-weight: 600; border: 1px solid rgba(16, 185, 129, 0.2); vertical-align: middle;">BARU</span>`;
    }

    let mergeInfo = '';
    if (r.mergedRows && r.mergedRows.length > 0) {
      mergeInfo = `<button class="btn-merge-detail" onclick="openMergeConflictModal(${i})" style="font-size:10px;color:#3b82f6;margin-top:4px;font-weight:600;background:rgba(59,130,246,0.06);padding:4px 8px;border-radius:6px;display:inline-block;border:1px solid rgba(59,130,246,0.12);cursor:pointer; transition: all 0.2s; outline: none; font-family: inherit;">ℹ️ Digabung dari ${1 + r.mergedRows.length} baris (Klik untuk pilih data utama)</button>`;
    }

    let qtyHtml = '';
    if (existing) {
      qtyHtml = `<div style="font-weight:600; font-size:13px; color:#0f172a;">${r.qty}</div><div style="color:#64748b;font-size:10px;margin-top:2px;font-weight:500;">Stok saat ini: ${existing.stock}</div>`;
    } else {
      qtyHtml = `<div style="font-weight:600; font-size:13px; color:#0f172a;">${r.qty}</div><span style="display:inline-block; font-size:9.5px; font-weight:600; padding:1px 6px; border-radius:12px; margin-top:3px; background:rgba(16, 185, 129, 0.08); color:#059669; border: 1px solid rgba(16, 185, 129, 0.15)">Barang Baru</span>`;
    }

    let priceHtml = '';
    if (existing) {
      const dbPrice = parseFloat(existing.buy_price) || 0;
      if (r.beliPcs > dbPrice) {
        priceHtml = `<div style="font-weight:600; font-size:13px; color:#0f172a;">${rupiah(r.beliPcs)}</div><span style="display:inline-block; font-size:9.5px; font-weight:600; padding:1px 6px; border-radius:12px; margin-top:3px; background:rgba(239, 68, 68, 0.08); color:#dc2626; border: 1px solid rgba(239, 68, 68, 0.15)">▲ Naik ${rupiah(r.beliPcs - dbPrice)}</span>`;
      } else if (r.beliPcs < dbPrice) {
        priceHtml = `<div style="font-weight:600; font-size:13px; color:#0f172a;">${rupiah(r.beliPcs)}</div><span style="display:inline-block; font-size:9.5px; font-weight:600; padding:1px 6px; border-radius:12px; margin-top:3px; background:rgba(16, 185, 129, 0.08); color:#059669; border: 1px solid rgba(16, 185, 129, 0.15)">▼ Turun ${rupiah(dbPrice - r.beliPcs)}</span>`;
      } else {
        priceHtml = `<div style="font-weight:600; font-size:13px; color:#0f172a;">${rupiah(r.beliPcs)}</div><span style="display:inline-block; font-size:9.5px; font-weight:600; padding:1px 6px; border-radius:12px; margin-top:3px; background:#f1f5f9; color:#64748b; border: 1px solid #e2e8f0;">(Tetap)</span>`;
      }
    } else {
      priceHtml = `<div style="font-weight:600; font-size:13px; color:#0f172a;">${rupiah(r.beliPcs)}</div><span style="display:inline-block; font-size:9.5px; font-weight:600; padding:1px 6px; border-radius:12px; margin-top:3px; background:rgba(16, 185, 129, 0.08); color:#059669; border: 1px solid rgba(16, 185, 129, 0.15)">Barang Baru</span>`;
    }

    return `
      <tr>
        <td>${i + 1}</td>
        <td>${r.supplier || '-'}</td>
        <td><span class="code-badge">${r.kode || '-'}</span></td>
        <td>
          <div style="font-weight:600;display:flex;align-items:center;flex-wrap:wrap;gap:4px;">
            <span>${r.nama}</span>
            ${statusBadge}
          </div>
          ${mergeInfo}
        </td>
        <td>${r.merk || '-'}</td>
        <td>${r.tipe || '-'}</td>
        <td>${qtyHtml}</td>
        <td>${priceHtml}</td>
        <td>${rupiah(r.beliTotal)}</td>
        <td>${rupiah(r.jualPcs)}</td>
        <td>${r.lokasiRak || '-'}</td>
      </tr>
    `;
  }).join('');

  document.getElementById('modalPreview').classList.remove('hidden');
}

function closePreviewModal() {
  if (isImporting) return;
  document.getElementById('modalPreview').classList.add('hidden');
}

let currentMergeIndex = null;
let currentMergeSelectedIndices = {
  supplier: 0,
  kode: 0,
  nama: 0,
  merk: 0,
  tipe: 0,
  beliPcs: 0,
  jualPcs: 0,
  lokasiRak: 0
};

function isAllFieldsFromRow(idx) {
  return currentMergeSelectedIndices.supplier === idx &&
         currentMergeSelectedIndices.kode === idx &&
         currentMergeSelectedIndices.nama === idx &&
         currentMergeSelectedIndices.merk === idx &&
         currentMergeSelectedIndices.tipe === idx &&
         currentMergeSelectedIndices.beliPcs === idx &&
         currentMergeSelectedIndices.jualPcs === idx &&
         currentMergeSelectedIndices.lokasiRak === idx;
}

function selectAllFieldsFromRow(idx) {
  currentMergeSelectedIndices.supplier = idx;
  currentMergeSelectedIndices.kode = idx;
  currentMergeSelectedIndices.nama = idx;
  currentMergeSelectedIndices.merk = idx;
  currentMergeSelectedIndices.tipe = idx;
  currentMergeSelectedIndices.beliPcs = idx;
  currentMergeSelectedIndices.jualPcs = idx;
  currentMergeSelectedIndices.lokasiRak = idx;
  renderMergeDetailTable();
}

function selectMergeCell(field, idx) {
  currentMergeSelectedIndices[field] = idx;
  renderMergeDetailTable();
}

function renderMergeDetailTable() {
  const r = importRows[currentMergeIndex];
  const tbody = document.getElementById('mergeDetailTableBody');
  tbody.innerHTML = r.allRows.map((row, idx) => {
    return `
      <tr>
        <td style="text-align: center; vertical-align: middle;">
          <input type="radio" name="rowSelectAll" value="${idx}" ${isAllFieldsFromRow(idx) ? 'checked' : ''} onclick="selectAllFieldsFromRow(${idx})" style="cursor: pointer; width: 18px; height: 18px; accent-color: #10b981;" />
        </td>
        <td style="text-align: center; font-weight: 600; color: #64748b;">#${row.excelRowNumber}</td>
        
        <td class="selectable-cell ${currentMergeSelectedIndices.supplier === idx ? 'selected' : ''}" 
            onclick="selectMergeCell('supplier', ${idx})">
          ${row.supplier || '-'}
        </td>
        
        <td class="selectable-cell ${currentMergeSelectedIndices.kode === idx ? 'selected' : ''}" 
            onclick="selectMergeCell('kode', ${idx})">
          <span class="code-badge">${row.kode || '-'}</span>
        </td>
        
        <td class="selectable-cell ${currentMergeSelectedIndices.nama === idx ? 'selected' : ''}" 
            onclick="selectMergeCell('nama', ${idx})">
          ${row.nama || '-'}
        </td>
        
        <td class="selectable-cell ${currentMergeSelectedIndices.merk === idx ? 'selected' : ''}" 
            onclick="selectMergeCell('merk', ${idx})">
          ${row.merk || '-'}
        </td>
        
        <td class="selectable-cell ${currentMergeSelectedIndices.tipe === idx ? 'selected' : ''}" 
            onclick="selectMergeCell('tipe', ${idx})">
          ${row.tipe || '-'}
        </td>
        
        <td style="text-align: center; font-weight: 600; background: #fafafa; color: #64748b;">
          ${row.qty}
        </td>
        
        <td class="selectable-cell ${currentMergeSelectedIndices.beliPcs === idx ? 'selected' : ''}" 
            onclick="selectMergeCell('beliPcs', ${idx})" style="text-align: right;">
          ${rupiah(row.beliPcs)}
        </td>
        
        <td class="selectable-cell ${currentMergeSelectedIndices.jualPcs === idx ? 'selected' : ''}" 
            onclick="selectMergeCell('jualPcs', ${idx})" style="text-align: right;">
          ${rupiah(row.jualPcs)}
        </td>
        
        <td class="selectable-cell ${currentMergeSelectedIndices.lokasiRak === idx ? 'selected' : ''}" 
            onclick="selectMergeCell('lokasiRak', ${idx})" style="text-align: center;">
          ${row.lokasiRak || '-'}
        </td>
      </tr>
    `;
  }).join('');
}

function openMergeConflictModal(index) {
  currentMergeIndex = index;
  const r = importRows[index];
  
  if (!r.selectedIndices) {
    r.selectedIndices = {
      supplier: r.selectedRowIndex || 0,
      kode: r.selectedRowIndex || 0,
      nama: r.selectedRowIndex || 0,
      merk: r.selectedRowIndex || 0,
      tipe: r.selectedRowIndex || 0,
      beliPcs: r.selectedRowIndex || 0,
      jualPcs: r.selectedRowIndex || 0,
      lokasiRak: r.selectedRowIndex || 0
    };
  }
  
  currentMergeSelectedIndices = { ...r.selectedIndices };
  renderMergeDetailTable();
  
  document.getElementById('modalMergeDetail').classList.remove('hidden');
}

function closeMergeDetailModal() {
  document.getElementById('modalMergeDetail').classList.add('hidden');
  currentMergeIndex = null;
}

function saveMergeDetailSelection() {
  if (currentMergeIndex === null) return;
  
  const r = importRows[currentMergeIndex];
  r.selectedIndices = { ...currentMergeSelectedIndices };
  
  // Ambil nilai masing-masing kolom dari index baris terpilihnya
  r.supplier = r.allRows[currentMergeSelectedIndices.supplier].supplier;
  r.kode = r.allRows[currentMergeSelectedIndices.kode].kode;
  r.nama = r.allRows[currentMergeSelectedIndices.nama].nama;
  r.merk = r.allRows[currentMergeSelectedIndices.merk].merk;
  r.tipe = r.allRows[currentMergeSelectedIndices.tipe].tipe;
  r.beliPcs = r.allRows[currentMergeSelectedIndices.beliPcs].beliPcs;
  r.jualPcs = r.allRows[currentMergeSelectedIndices.jualPcs].jualPcs;
  r.lokasiRak = r.allRows[currentMergeSelectedIndices.lokasiRak].lokasiRak;
  r.diskon = r.allRows[currentMergeSelectedIndices.beliPcs].diskon; // default diskon ikut dengan baris harga beli
  
  // Re-run preview table render to update values
  showImportPreview();
  closeMergeDetailModal();
}

async function submitImport() {
  if (!importRows.length || isImporting) return;

  const markupPercent = parseFloat(document.getElementById('importMarkupPercent')?.value || 30);
  localStorage.setItem('default_markup', markupPercent);

  isImporting = true;

  // Hide action buttons in preview modal footer
  const btnCancel = document.getElementById('btnImportCancel');
  const btnImport = document.getElementById('btnImportAll');
  if (btnCancel) btnCancel.style.display = 'none';
  if (btnImport) btnImport.style.display = 'none';

  // Hide close cross button in modal header
  const closeBtn = document.querySelector('#modalPreview .modal-close');
  if (closeBtn) closeBtn.style.display = 'none';

  // Show progress container
  const progressContainer = document.getElementById('importProgressContainer');
  const progressBar = document.getElementById('importProgressBar');
  const progressText = document.getElementById('importProgressText');
  const progressPercent = document.getElementById('importProgressPercent');
  const successCountEl = document.getElementById('importSuccessCount');
  const failedCountEl = document.getElementById('importFailedCount');

  if (progressContainer) progressContainer.classList.remove('hidden');
  if (progressBar) progressBar.style.width = '0%';
  if (progressText) progressText.textContent = `Memulai impor...`;
  if (progressPercent) progressPercent.textContent = '0%';
  if (successCountEl) successCountEl.textContent = '0';
  if (failedCountEl) failedCountEl.textContent = '0';

  let success = 0;
  let failed = 0;
  const total = importRows.length;

  for (let i = 0; i < total; i++) {
    const row = importRows[i];
    try {
      let sparepartId = null;
      const existing = spareparts.find(s => s.code === row.kode);

      const finalPrice = row.jualPcs || roundToNearest500(row.beliPcs * (1 + markupPercent / 100));

      if (existing) {
        sparepartId = existing.id;
        await fetch(`${API}/spareparts/${sparepartId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            code: row.kode,
            name: row.nama,
            brand: row.merk || null,
            type: row.tipe || null,
            supplier: row.supplier,
            buy_price: row.beliPcs,
            price: finalPrice,
            rack_location: row.lokasiRak,
            stock: (existing.stock || 0) + row.qty,
            category_id: existing.category_id,
            discount: row.diskon
          })
        });
      } else {
        const resCreate = await fetch(`${API}/spareparts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            code: row.kode,
            name: row.nama,
            brand: row.merk || null,
            type: row.tipe || null,
            supplier: row.supplier,
            buy_price: row.beliPcs,
            price: finalPrice,
            rack_location: row.lokasiRak,
            stock: row.qty,
            discount: row.diskon
          })
        });
        const createData = await resCreate.json();
        if (createData.success) sparepartId = createData.data.id;
      }

      if (sparepartId) {
        await fetch(`${API}/purchases`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            sparepart_id: sparepartId,
            supplier: row.supplier,
            quantity: row.qty,
            buy_price: row.beliPcs,
            sell_price: finalPrice,
            rack_location: row.lokasiRak,
            note: 'Import Excel'
          })
        });
        success++;
      } else {
        failed++;
      }
    } catch (err) {
      failed++;
      console.error('Import row error:', err);
    }

    // Update progress bar
    const currentProgress = Math.round(((i + 1) / total) * 100);
    if (progressBar) progressBar.style.width = `${currentProgress}%`;
    if (progressPercent) progressPercent.textContent = `${currentProgress}%`;
    if (progressText) progressText.textContent = `Mengimpor ${i + 1} dari ${total} baris...`;
    if (successCountEl) successCountEl.textContent = success;
    if (failedCountEl) failedCountEl.textContent = failed;
  }

  // Ensure it shows 100% and final status
  if (progressBar) progressBar.style.width = '100%';
  if (progressPercent) progressPercent.textContent = '100%';
  if (progressText) progressText.textContent = 'Impor selesai!';

  // Wait 500ms for visual polish
  await new Promise(resolve => setTimeout(resolve, 500));

  alert(`Import selesai! Berhasil: ${success}, Gagal: ${failed}`);

  // Restore action buttons and close button
  if (btnCancel) btnCancel.style.display = '';
  if (btnImport) btnImport.style.display = '';
  if (closeBtn) closeBtn.style.display = '';

  // Hide progress container
  if (progressContainer) progressContainer.classList.add('hidden');

  isImporting = false;
  closePreviewModal();
  loadData();
}

function downloadTemplate() {
  const headers = [['No', 'Supplier', 'Kode', 'Nama', 'Merk', 'Tipe Motor', 'Qty', 'Beli/PCS', 'Beli/Total', 'Jual/PCS', 'Diskon', 'Lokasi Rak']];
  const example = [[1, 'Supplier A', 'SP001', 'Oli Mesin 1L', 'Federal', 'Beat, Vario', 10, 25000, 250000, 35000, 0, 'RAK-A1']];
  const ws = XLSX.utils.aoa_to_sheet([...headers, ...example]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Template');
  XLSX.writeFile(wb, 'template_pembelian.xlsx');
}

const importFileEl = document.getElementById('importFile');
if (importFileEl) importFileEl.addEventListener('change', handleImportFile);

loadData();
