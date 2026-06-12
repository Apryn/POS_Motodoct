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
      <td><strong>${Number(m.commission_rate || 90).toFixed(1)}%</strong></td>
      <td>
        <div class="action-btns">
          <button class="btn-primary" style="padding: 5px 9px; font-size: 11px; display: inline-flex; align-items: center; gap: 4px;" onclick="openJobs(${m.id}, '${escAttr(m.name)}')">💼 Detail Kerja</button>
          <button class="btn-edit"    onclick="openEdit(${m.id})">Edit</button>
          ${isAdminOrOwner ? `<button class="btn-del-row" onclick="openDelete(${m.id}, '${escAttr(m.name)}')">Hapus</button>` : ''}
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
  document.getElementById('fieldKomisi').value = '90';
  document.getElementById('modalMekanik').classList.remove('hidden');
}

function openEdit(id) {
  const m = mechanics.find(x => x.id === id);
  if (!m) return;
  editId = id;
  document.getElementById('modalTitle').textContent = 'Edit Mekanik';
  document.getElementById('fieldNama').value = m.name;
  document.getElementById('fieldHp').value   = m.phone || '';
  document.getElementById('fieldKomisi').value = m.commission_rate || '90';
  document.getElementById('modalMekanik').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modalMekanik').classList.add('hidden');
}

async function saveMechanic() {
  const payload = {
    name:  document.getElementById('fieldNama').value.trim(),
    phone: document.getElementById('fieldHp').value.trim() || null,
    commission_rate: parseFloat(document.getElementById('fieldKomisi').value) || 90.00
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
let activeMechanicId = null;

async function openJobs(id, name) {
  activeMechanicId = id;
  
  // Reset select all checkbox
  const selectAllEl = document.getElementById('selectAllJobs');
  if (selectAllEl) selectAllEl.checked = false;
  
  // Reset claim button
  const btnClaim = document.getElementById('btnClaimCommissions');
  if (btnClaim) {
    btnClaim.disabled = true;
    btnClaim.textContent = 'Cairkan Komisi Terpilih (Total: Rp 0)';
  }

  document.getElementById('jobsMechanicName').textContent = name;
  document.getElementById('unpaidWagesDisplay').textContent = 'Rp 0';
  document.getElementById('unpaidJobsDetail').textContent = 'Memuat...';
  document.getElementById('paidWagesDisplay').textContent = 'Rp 0';
  document.getElementById('paidJobsDetail').textContent = 'Memuat...';
  document.getElementById('totalWagesDisplay').textContent = 'Rp 0';
  document.getElementById('totalJobsDetail').textContent = 'Memuat...';
  document.getElementById('jobsTableBody').innerHTML = '<tr><td colspan="11" class="empty-state">Memuat histori pekerjaan...</td></tr>';
  document.getElementById('modalJobs').classList.remove('hidden');

  try {
    const res = await fetch(`${API}/mechanics/${id}/jobs`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    
    if (data.success && data.data.length > 0) {
      const list = data.data;

      let totalUnpaidNet = 0;
      let totalPaidNet = 0;
      let countUnpaid = 0;
      let countPaid = 0;

      const rowsHtml = list.map((j, i) => {
        const commRate = parseFloat(j.commission_rate || 90.00);
        const totalJasa = parseFloat(j.service_price || 0);
        const komisiNet = (totalJasa * commRate) / 100;
        const tokoCut = totalJasa - komisiNet;
        
        const isPaid = j.commission_status === 'paid';
        
        if (isPaid) {
          totalPaidNet += komisiNet;
          countPaid++;
        } else {
          totalUnpaidNet += komisiNet;
          countUnpaid++;
        }

        const tgl = new Date(j.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        const tglCair = j.claimed_at 
          ? new Date(j.claimed_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
          : '-';

        const checkboxHtml = isPaid
          ? `<span style="color:#10b981; font-weight:bold; font-size:14px;">✓</span>`
          : `<input type="checkbox" class="job-checkbox" data-id="${j.transaction_service_id}" data-net="${komisiNet}" onclick="onJobCheckboxChange()" style="cursor:pointer; transform: scale(1.1);">`;

        const statusBadgeHtml = isPaid
          ? `<span style="background:#d1fae5; color:#059669; font-size:10px; font-weight:700; padding:2px 6px; border-radius:4px; border:1px solid #a7f3d0; display:inline-block;">Sudah Cair</span>`
          : `<span style="background:#fff3c7; color:#d97706; font-size:10px; font-weight:700; padding:2px 6px; border-radius:4px; border:1px solid #fde68a; display:inline-block;">Belum Cair</span>`;

        return `
          <tr style="${isPaid ? 'background:#fafafa; color:#64748b;' : ''}">
            <td style="text-align:center; padding:10px 0;">${checkboxHtml}</td>
            <td>${tgl}</td>
            <td><strong>${escHtml(j.invoice_number)}</strong></td>
            <td>${escHtml(j.customer_name || 'Pelanggan Umum')}</td>
            <td><span class="code-badge" style="background:#1e293b; color:#ffffff; font-weight:800; font-size:11px; padding:3px 8px; border-radius:4px; border:1px solid #475569; letter-spacing:0.5px; display:inline-block; white-space:nowrap;">${escHtml(j.license_plate || '-')}</span></td>
            <td>${escHtml(j.service_name)}</td>
            <td style="text-align:right; font-weight:700;">${formatRp(totalJasa)}</td>
            <td style="text-align:right; color:#ef4444;">${formatRp(tokoCut)}</td>
            <td style="text-align:right; font-weight:700; color:#10b981;">${formatRp(komisiNet)}</td>
            <td style="text-align:center;">${statusBadgeHtml}</td>
            <td>${tglCair}</td>
          </tr>
        `;
      }).join('');

      document.getElementById('unpaidWagesDisplay').textContent = formatRp(totalUnpaidNet);
      document.getElementById('unpaidJobsDetail').textContent = `${countUnpaid} servis belum diambil`;
      
      document.getElementById('paidWagesDisplay').textContent = formatRp(totalPaidNet);
      document.getElementById('paidJobsDetail').textContent = `${countPaid} servis sudah diambil`;

      document.getElementById('totalWagesDisplay').textContent = formatRp(totalUnpaidNet + totalPaidNet);
      document.getElementById('totalJobsDetail').textContent = `${list.length} servis terdaftar`;

      document.getElementById('jobsTableBody').innerHTML = rowsHtml;
    } else {
      document.getElementById('unpaidWagesDisplay').textContent = 'Rp 0';
      document.getElementById('unpaidJobsDetail').textContent = '0 servis belum diambil';
      document.getElementById('paidWagesDisplay').textContent = 'Rp 0';
      document.getElementById('paidJobsDetail').textContent = '0 servis sudah diambil';
      document.getElementById('totalWagesDisplay').textContent = 'Rp 0';
      document.getElementById('totalJobsDetail').textContent = '0 servis terdaftar';
      document.getElementById('jobsTableBody').innerHTML = '<tr><td colspan="11" class="empty-state">Mekanik ini belum memiliki histori pekerjaan.</td></tr>';
    }
  } catch (err) {
    console.error(err);
    document.getElementById('jobsTableBody').innerHTML = '<tr><td colspan="11" class="empty-state" style="color:#e74c3c;">Gagal memuat data pekerjaan.</td></tr>';
  }
}

function onJobCheckboxChange() {
  const checkboxes = document.querySelectorAll('.job-checkbox:checked');
  let totalChecked = 0;
  checkboxes.forEach(cb => {
    totalChecked += parseFloat(cb.getAttribute('data-net') || 0);
  });

  const btnClaim = document.getElementById('btnClaimCommissions');
  if (btnClaim) {
    btnClaim.textContent = `Cairkan Komisi Terpilih (Total: ${formatRp(totalChecked)})`;
    btnClaim.disabled = checkboxes.length === 0;
  }

  // Sync selectAll checkbox status
  const totalCheckboxes = document.querySelectorAll('.job-checkbox');
  const selectAllEl = document.getElementById('selectAllJobs');
  if (selectAllEl && totalCheckboxes.length > 0) {
    selectAllEl.checked = checkboxes.length === totalCheckboxes.length;
  }
}

function toggleSelectAllJobs() {
  const selectAllEl = document.getElementById('selectAllJobs');
  if (!selectAllEl) return;
  
  const checked = selectAllEl.checked;
  const checkboxes = document.querySelectorAll('.job-checkbox');
  checkboxes.forEach(cb => {
    cb.checked = checked;
  });
  
  onJobCheckboxChange();
}

async function claimSelectedCommissions() {
  if (!activeMechanicId) return;

  const checkedBox = document.querySelectorAll('.job-checkbox:checked');
  if (checkedBox.length === 0) return;

  const ids = Array.from(checkedBox).map(cb => parseInt(cb.getAttribute('data-id')));
  
  let totalChecked = 0;
  checkedBox.forEach(cb => {
    totalChecked += parseFloat(cb.getAttribute('data-net') || 0);
  });

  const confirmMsg = `Apakah Anda yakin ingin mencairkan komisi sebesar ${formatRp(totalChecked)} untuk mekanik ini?\n\nKasir wajib mencocokkan bon fisik 3-ply dengan invoice terpilih terlebih dahulu.`;
  if (!confirm(confirmMsg)) return;

  const btnClaim = document.getElementById('btnClaimCommissions');
  const originalText = btnClaim.textContent;
  btnClaim.disabled = true;
  btnClaim.textContent = 'Memproses...';

  try {
    const res = await fetch(`${API}/mechanics/${activeMechanicId}/claim-commissions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ ids })
    });
    const data = await res.json();
    if (data.success) {
      alert(`✅ Berhasil mencairkan komisi sebesar ${formatRp(totalChecked)}!`);
      // Reload detail pekerjaan modal
      const mechName = document.getElementById('jobsMechanicName').textContent;
      await openJobs(activeMechanicId, mechName);
      // Reload main mechanics table data
      await loadData();
    } else {
      alert('Gagal mencairkan komisi: ' + (data.message || 'Terjadi kesalahan'));
      btnClaim.disabled = false;
      btnClaim.textContent = originalText;
    }
  } catch (err) {
    console.error(err);
    alert('Koneksi error!');
    btnClaim.disabled = false;
    btnClaim.textContent = originalText;
  }
}

function closeJobsModal() {
  document.getElementById('modalJobs').classList.add('hidden');
  activeMechanicId = null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function escHtml(str) { return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function escAttr(str) { return String(str).replace(/'/g,"\\'"); }

// ── Init ──────────────────────────────────────────────────────────────────────
loadData();
