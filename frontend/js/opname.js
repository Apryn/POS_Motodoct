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

function logout() {
  localStorage.clear();
  window.location.href = 'login.html';
}

// State
let categories = [];
let opnameItems = []; // Active opname sheet items
let activeTab = 'sheet';

// History State
let historyData = [];
let historyPage = 1;
const historyLimit = 20;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  await loadCategories();
  
  // Set default dates for history filters (past 30 days)
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(today.getDate() - 30);
  
  document.getElementById('historyStart').value = thirtyDaysAgo.toISOString().split('T')[0];
  document.getElementById('historyEnd').value = today.toISOString().split('T')[0];
  
  // Listen to history filters
  document.getElementById('historySearch').addEventListener('input', debounce(loadHistoryData, 400));
  document.getElementById('historyStart').addEventListener('change', loadHistoryData);
  document.getElementById('historyEnd').addEventListener('change', loadHistoryData);
});

// Helper debounce
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

async function loadCategories() {
  try {
    const res = await fetch(`${API}/categories`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const d = await res.json();
    if (d.success) {
      categories = d.data;
      const catSelects = ['opnameCategory'];
      catSelects.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
          el.innerHTML = '<option value="">Semua Kategori</option>' +
            categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
        }
      });
    }
  } catch (err) {
    console.error('Error load categories:', err);
  }
}

function switchTab(tab) {
  activeTab = tab;
  
  // Update buttons
  document.getElementById('tabBtnSheet').classList.toggle('active', tab === 'sheet');
  document.getElementById('tabBtnHistory').classList.toggle('active', tab === 'history');
  
  // Custom border color
  document.getElementById('tabBtnSheet').style.borderBottomColor = tab === 'sheet' ? '#e87722' : 'transparent';
  document.getElementById('tabBtnSheet').style.color = tab === 'sheet' ? '#e87722' : '#64748b';
  document.getElementById('tabBtnHistory').style.borderBottomColor = tab === 'history' ? '#e87722' : 'transparent';
  document.getElementById('tabBtnHistory').style.color = tab === 'history' ? '#e87722' : '#64748b';
  
  // Update contents
  document.getElementById('tabContentSheet').classList.toggle('active', tab === 'sheet');
  document.getElementById('tabContentHistory').classList.toggle('active', tab === 'history');
  
  if (tab === 'history') {
    historyPage = 1;
    loadHistoryData();
  }
}

// Generate Opname Sheet
async function generateOpnameSheet() {
  const limit = document.getElementById('opnameLimit').value;
  const sortBy = document.getElementById('opnameSort').value;
  const categoryId = document.getElementById('opnameCategory').value;
  const rack = encodeURIComponent(document.getElementById('opnameRack').value.trim());
  
  let url = `${API}/spareparts/opname/list?limit=${limit}&sortBy=${sortBy}`;
  if (categoryId) url += `&category_id=${categoryId}`;
  if (rack) url += `&rack_location=${rack}`;
  
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const d = await res.json();
    if (d.success) {
      opnameItems = d.data;
      renderOpnameSheet();
    } else {
      alert('Gagal mengambil daftar barang: ' + d.message);
    }
  } catch (err) {
    console.error('Error generate sheet:', err);
    alert('Terjadi kesalahan koneksi server.');
  }
}

function renderOpnameSheet() {
  const body = document.getElementById('opnameSheetBody');
  const emptyState = document.getElementById('sheetEmptyState');
  const container = document.getElementById('opnameSheetContainer');
  const configCard = document.getElementById('configCard');
  
  if (opnameItems.length === 0) {
    body.innerHTML = '';
    emptyState.classList.remove('hidden');
    container.classList.add('hidden');
    alert('Tidak ada barang yang memenuhi kriteria pencarian!');
    return;
  }
  
  emptyState.classList.add('hidden');
  container.classList.remove('hidden');
  configCard.style.opacity = '0.5';
  configCard.style.pointerEvents = 'none'; // Lock config during count
  
  document.getElementById('itemCountBadge').textContent = `${opnameItems.length} Item`;
  
  // Set print header info
  const today = new Date().toLocaleDateString('id-ID', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
  const limitVal = document.getElementById('opnameLimit').value;
  const catText = document.getElementById('opnameCategory').options[document.getElementById('opnameCategory').selectedIndex].text;
  const rackVal = document.getElementById('opnameRack').value.trim() || 'Semua';
  
  const printMetaEl = document.getElementById('printMetaInfo');
  if (printMetaEl) {
    printMetaEl.textContent = `Tanggal: ${today} | Kategori: ${catText} | Lokasi Rak: ${rackVal} | Jumlah: ${limitVal} Item`;
  }
  
  body.innerHTML = opnameItems.map((item, idx) => {
    return `
      <tr data-id="${item.id}">
        <td style="text-align:center; font-weight:600; color:#64748b;">${idx + 1}</td>
        <td><span class="code-badge">${item.code || '-'}</span></td>
        <td style="font-weight:600; color:#1e293b;">${item.name}</td>
        <td style="color:#64748b; font-size:11px;">${item.nama_lain || '-'}</td>
        <td><span style="font-size:11px; font-weight:500; color:#64748b;">${item.category_name || '-'}</span></td>
        <td style="color:#475569; font-weight:500;">${item.brand || '-'}</td>
        <td style="color:#475569; font-weight:500;">${item.type || '-'}</td>
        <td style="font-weight:500; color:#475569;">${item.rack_location || '-'}</td>
        <td style="text-align:center; font-weight:700; color:#1e293b; background:#f8fafc;">${item.stock} ${item.unit || 'pcs'}</td>
        <td style="text-align:center;">
          <input type="number" class="input-qty-phys" id="phys-${item.id}" value="" placeholder="0" min="0" oninput="calculateRowDifference(${item.id}, ${item.stock})" />
        </td>
        <!-- Kolom khusus cetak fisik (kosong dengan titik-titik untuk ditulis manual) -->
        <td class="print-only-cell" style="text-align:center; border-bottom:1px solid #000; font-family: monospace;">..................</td>
        <td class="print-only-cell" style="border-bottom:1px solid #000; font-family: monospace;">....................................</td>
        <td style="text-align:center;">
          <span class="diff-badge diff-zero" id="diff-${item.id}">0</span>
        </td>
        <td>
          <input type="text" class="input-reason" id="reason-${item.id}" placeholder="Catatan selisih (misal: Rusak, Hilang)..." />
        </td>
        <td style="text-align:center;">
          <button class="btn-action-sm btn-edit" onclick="setPhysToSystem(${item.id}, ${item.stock})">Sesuai</button>
        </td>
      </tr>
    `;
  }).join('');
}

function calculateRowDifference(itemId, systemStock) {
  const inputEl = document.getElementById(`phys-${itemId}`);
  const diffEl = document.getElementById(`diff-${itemId}`);
  
  if (!inputEl || !diffEl) return;
  
  const physVal = inputEl.value;
  if (physVal === '') {
    diffEl.textContent = '0';
    diffEl.className = 'diff-badge diff-zero';
    return;
  }
  
  const physStock = parseInt(physVal) || 0;
  const diff = physStock - systemStock;
  
  diffEl.textContent = diff > 0 ? `+${diff}` : diff;
  
  if (diff === 0) {
    diffEl.className = 'diff-badge diff-zero';
  } else if (diff < 0) {
    diffEl.className = 'diff-badge diff-negative';
  } else {
    diffEl.className = 'diff-badge diff-positive';
  }
}

function setPhysToSystem(itemId, systemStock) {
  const inputEl = document.getElementById(`phys-${itemId}`);
  if (inputEl) {
    inputEl.value = systemStock;
    calculateRowDifference(itemId, systemStock);
  }
}

function applyAllSystemStock() {
  opnameItems.forEach(item => {
    setPhysToSystem(item.id, item.stock);
  });
}

function cancelOpnameSheet() {
  if (confirm('Apakah Anda yakin ingin membatalkan lembar opname ini? Semua data hitung yang belum disimpan akan hilang.')) {
    resetOpnameSession();
  }
}

function resetOpnameSession() {
  opnameItems = [];
  document.getElementById('opnameSheetBody').innerHTML = '';
  document.getElementById('sheetEmptyState').classList.remove('hidden');
  document.getElementById('opnameSheetContainer').classList.add('hidden');
  
  const configCard = document.getElementById('configCard');
  configCard.style.opacity = '1';
  configCard.style.pointerEvents = 'auto';
}

async function submitOpnameSheet() {
  // Validate all inputs are filled
  const itemsToSubmit = [];
  let allFilled = true;
  
  for (const item of opnameItems) {
    const physInput = document.getElementById(`phys-${item.id}`);
    const reasonInput = document.getElementById(`reason-${item.id}`);
    
    if (!physInput || physInput.value === '') {
      allFilled = false;
      physInput.style.borderColor = '#e74c3c';
      physInput.focus();
      break;
    }
    
    itemsToSubmit.push({
      sparepart_id: item.id,
      physical_stock: parseInt(physInput.value) || 0,
      reason: reasonInput ? reasonInput.value.trim() : ''
    });
  }
  
  if (!allFilled) {
    alert('Harap isi semua stok fisik barang sebelum menyimpan!');
    return;
  }
  
  if (!confirm(`Apakah Anda yakin ingin menyimpan hasil penyesuaian untuk ${opnameItems.length} item ini ke dalam database?`)) {
    return;
  }
  
  try {
    const res = await fetch(`${API}/spareparts/opname/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ items: itemsToSubmit })
    });
    
    const d = await res.json();
    if (d.success) {
      alert('Stock opname berhasil disimpan dan stok telah disesuaikan!');
      resetOpnameSession();
      switchTab('history');
    } else {
      alert('Gagal menyimpan opname: ' + d.message);
    }
  } catch (err) {
    console.error('Error submit opname:', err);
    alert('Terjadi kesalahan koneksi server.');
  }
}

// History Loader
async function loadHistoryData() {
  const search = document.getElementById('historySearch').value.trim();
  const start = document.getElementById('historyStart').value;
  const end = document.getElementById('historyEnd').value;
  
  const offset = (historyPage - 1) * historyLimit;
  
  let url = `${API}/spareparts/opname/history?limit=${historyLimit}&offset=${offset}`;
  if (start) url += `&start_date=${start}`;
  if (end) url += `&end_date=${end}`;
  
  const tbody = document.getElementById('historyTableBody');
  tbody.innerHTML = `<tr><td colspan="9" class="empty-state">Memuat riwayat...</td></tr>`;
  
  try {
    // 1. Ambil data riwayat opname
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const d = await res.json();
    
    if (d.success) {
      historyData = d.data;
      
      // Filter pencarian client-side jika ada text search
      // (Kita filter client-side agar pencarian nama/kode responsif, 
      // tetapi query database memfilter tanggal & paginasi)
      let displayData = historyData;
      if (search) {
        const q = search.toLowerCase();
        displayData = historyData.filter(h => 
          h.sparepart_name.toLowerCase().includes(q) || 
          (h.sparepart_code && h.sparepart_code.toLowerCase().includes(q))
        );
      }
      
      renderHistoryTable(displayData);
    } else {
      tbody.innerHTML = `<tr><td colspan="9" class="empty-state text-danger">Gagal memuat: ${d.message}</td></tr>`;
    }
  } catch (err) {
    console.error('Error load history:', err);
    tbody.innerHTML = `<tr><td colspan="9" class="empty-state text-danger">Koneksi server terputus.</td></tr>`;
  }
}

function renderHistoryTable(data) {
  const tbody = document.getElementById('historyTableBody');
  
  if (data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="empty-state">Tidak ada riwayat stock opname.</td></tr>`;
    document.getElementById('historyInfo').textContent = 'Menampilkan 0 riwayat';
    document.getElementById('btnPrevHistory').disabled = true;
    document.getElementById('btnNextHistory').disabled = true;
    return;
  }
  
  tbody.innerHTML = data.map((row, idx) => {
    const tgl = new Date(row.created_at).toLocaleString('id-ID', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit'
    });
    
    const diff = row.difference;
    let diffBadge = '';
    if (diff === 0) {
      diffBadge = `<span class="diff-badge diff-zero">0</span>`;
    } else if (diff < 0) {
      diffBadge = `<span class="diff-badge diff-negative">${diff}</span>`;
    } else {
      diffBadge = `<span class="diff-badge diff-positive">+${diff}</span>`;
    }
    
    const num = (historyPage - 1) * historyLimit + idx + 1;
    
    return `
      <tr>
        <td style="text-align:center; font-weight:600; color:#64748b;">${num}</td>
        <td style="font-weight:500; color:#475569;">${tgl}</td>
        <td><span class="code-badge">${row.sparepart_code || '-'}</span></td>
        <td style="font-weight:600; color:#1e293b;">${row.sparepart_name}</td>
        <td style="text-align:center; font-weight:500; color:#475569;">${row.system_stock}</td>
        <td style="text-align:center; font-weight:600; color:#1e293b;">${row.physical_stock}</td>
        <td style="text-align:center;">${diffBadge}</td>
        <td style="color:#475569;">${row.reason || '<span style="color:#cbd5e1; font-style:italic;">tanpa catatan</span>'}</td>
        <td style="font-weight:600; color:#e87722;">${row.user_name}</td>
      </tr>
    `;
  }).join('');
  
  // Update Pagination Controls
  document.getElementById('historyInfo').textContent = `Menampilkan ${data.length} riwayat`;
  document.getElementById('btnPrevHistory').disabled = historyPage === 1;
  document.getElementById('btnNextHistory').disabled = data.length < historyLimit;
}

function changeHistoryPage(dir) {
  if (dir === -1 && historyPage > 1) {
    historyPage--;
    loadHistoryData();
  } else if (dir === 1 && historyData.length === historyLimit) {
    historyPage++;
    loadHistoryData();
  }
}
