const API = 'http://localhost:3000/api';
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

let purchases = [];
let spareparts = [];
let deleteId = null;
let importRows = [];

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

function calcTotal() {
  const qty = parseFloat(document.getElementById('fieldQty')?.value || 0);
  const harga = parseFloat(document.getElementById('fieldHargaBeli')?.value || 0);
  const total = qty * harga;
  const el = document.getElementById('fieldTotal');
  if (el) el.value = total;
}

function calcHargaJual() {
  const harga = parseFloat(document.getElementById('fieldHargaBeli')?.value || 0);
  const jual = Math.ceil(harga * 1.3);
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

// Add modal
function openAddModal() {
  document.getElementById('formPembelian').reset();
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
  const hargaJual = parseFloat(document.getElementById('fieldHargaJual').value) || 0;
  const rak = document.getElementById('fieldRak').value.trim();
  const catatan = document.getElementById('fieldCatatan').value.trim();

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
    } else {
      alert('Gagal: ' + data.message);
    }
  } catch (err) {
    alert('Koneksi error!');
  } finally {
    if (btnSave) { btnSave.disabled = false; btnSave.textContent = 'Simpan'; }
  }
}

// Delete
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

// ===== IMPORT EXCEL =====
function parseRows(sheetData) {
  // Columns: No, Supplier, Kode, Nama, Qty, Beli/PCS, Beli/Total, Jual/PCS, Diskon, Lokasi Rak
  const rows = [];
  const grouped = {};

  sheetData.forEach((row, idx) => {
    if (idx === 0) return; // skip header
    const no = row[0];
    const supplier = String(row[1] || '').trim();
    const kode = String(row[2] || '').trim();
    const nama = String(row[3] || '').trim();
    const qty = parseInt(row[4]) || 0;
    const beliPcs = parseFloat(row[5]) || 0;
    const jualPcs = parseFloat(row[7]) || 0;
    const diskon = parseFloat(row[8]) || 0;
    const lokasiRak = String(row[9] || '').trim();

    const beliTotal = parseFloat(row[6]) || (beliPcs * qty); // ambil dari kolom Beli/Total

    if (!nama || !qty) return;

    // Group key: kode + supplier + harga beli (gabung hanya kalau sama persis)
    const key = `${kode}||${supplier}||${beliPcs}`;
    if (grouped[key]) {
      grouped[key].qty += qty;
      grouped[key].beliTotal += beliTotal; // jumlahkan langsung dari Excel
    } else {
      grouped[key] = { supplier, kode, nama, qty, beliPcs, beliTotal, jualPcs, diskon, lokasiRak };
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

  tbody.innerHTML = importRows.map((r, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${r.supplier || '-'}</td>
      <td><span class="code-badge">${r.kode || '-'}</span></td>
      <td>${r.nama}</td>
      <td>${r.qty}</td>
      <td>${rupiah(r.beliPcs)}</td>
      <td>${rupiah(r.beliTotal)}</td>
      <td>${rupiah(r.jualPcs)}</td>
      <td>${r.lokasiRak || '-'}</td>
    </tr>
  `).join('');

  document.getElementById('modalPreview').classList.remove('hidden');
}

function closePreviewModal() {
  document.getElementById('modalPreview').classList.add('hidden');
}

async function submitImport() {
  if (!importRows.length) return;

  const btnImport = document.getElementById('btnImportAll');
  if (btnImport) { btnImport.disabled = true; btnImport.textContent = 'Mengimpor...'; }

  let success = 0;
  let failed = 0;

  for (const row of importRows) {
    try {
      // Cek existing sparepart by kode
      let sparepartId = null;
      const existing = spareparts.find(s => s.code === row.kode);

      if (existing) {
        sparepartId = existing.id;
        // Update sparepart
        await fetch(`${API}/spareparts/${sparepartId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            code: row.kode,
            name: row.nama,
            supplier: row.supplier,
            buy_price: row.beliPcs,
            price: row.jualPcs || Math.ceil(row.beliPcs * 1.3),
            rack_location: row.lokasiRak,
            stock: (existing.stock || 0) + row.qty,
            category_id: existing.category_id,
            discount: row.diskon
          })
        });
      } else {
        // Buat sparepart baru
        const resCreate = await fetch(`${API}/spareparts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            code: row.kode,
            name: row.nama,
            supplier: row.supplier,
            buy_price: row.beliPcs,
            price: row.jualPcs || Math.ceil(row.beliPcs * 1.3),
            rack_location: row.lokasiRak,
            stock: row.qty,
            discount: row.diskon
          })
        });
        const createData = await resCreate.json();
        if (createData.success) sparepartId = createData.data.id;
      }

      // Catat ke purchases
      if (sparepartId) {
        await fetch(`${API}/purchases`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            sparepart_id: sparepartId,
            supplier: row.supplier,
            quantity: row.qty,
            buy_price: row.beliPcs,
            sell_price: row.jualPcs || Math.ceil(row.beliPcs * 1.3),
            rack_location: row.lokasiRak,
            note: 'Import Excel'
          })
        });
        success++;
      }
    } catch (err) {
      failed++;
      console.error('Import row error:', err);
    }
  }

  if (btnImport) { btnImport.disabled = false; btnImport.textContent = 'Import Semua'; }
  closePreviewModal();
  loadData();
  alert(`Import selesai! Berhasil: ${success}, Gagal: ${failed}`);
}

// Download template
function downloadTemplate() {
  const headers = [['No', 'Supplier', 'Kode', 'Nama', 'Qty', 'Beli/PCS', 'Beli/Total', 'Jual/PCS', 'Diskon', 'Lokasi Rak']];
  const example = [[1, 'Supplier A', 'SP001', 'Oli Mesin 1L', 10, 25000, 250000, 35000, 0, 'RAK-A1']];
  const ws = XLSX.utils.aoa_to_sheet([...headers, ...example]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Template');
  XLSX.writeFile(wb, 'template_pembelian.xlsx');
}

// File input listener
const importFileEl = document.getElementById('importFile');
if (importFileEl) importFileEl.addEventListener('change', handleImportFile);

loadData();
