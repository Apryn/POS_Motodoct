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

document.getElementById('welcomeText').textContent = user.username || 'Admin';
document.getElementById('userAvatar').textContent = (user.username || 'A')[0].toUpperCase();

const isAdminOrOwner = user.role === 'admin' || user.role === 'owner';

// Hide "+ Tambah Templat" button if not admin/owner
if (!isAdminOrOwner) {
  const addTmplBtn = document.querySelector('button[onclick="openTemplateModal()"]');
  if (addTmplBtn) addTmplBtn.style.display = 'none';
}

const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

// Riwayat notif disimpan di localStorage
const RIWAYAT_KEY = 'notif_riwayat';
let threshold = parseInt(localStorage.getItem('notif_threshold') || '5');
document.getElementById('thresholdInput').value = threshold;
let customers = [];
let reminderTemplates = [];



function openSidebar() { document.getElementById('sidebar')?.classList.add('open'); document.getElementById('sidebarOverlay')?.classList.add('open'); }
function closeSidebar() { document.getElementById('sidebar')?.classList.remove('open'); document.getElementById('sidebarOverlay')?.classList.remove('open'); }
function logout() { localStorage.clear(); window.location.href = 'login.html'; }

function showToast(msg, color = '#1a1a2e') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.style.background = color;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3500);
}

function addRiwayat(msg, type = 'stok') {
  const riwayat = JSON.parse(localStorage.getItem(RIWAYAT_KEY) || '[]');
  riwayat.unshift({
    msg,
    type,
    time: new Date().toLocaleString('id-ID')
  });
  // Simpan max 20 riwayat
  localStorage.setItem(RIWAYAT_KEY, JSON.stringify(riwayat.slice(0, 20)));
  renderRiwayat();
}

function renderRiwayat() {
  const riwayat = JSON.parse(localStorage.getItem(RIWAYAT_KEY) || '[]');
  const el = document.getElementById('riwayatList');

  if (!riwayat.length) {
    el.innerHTML = `<div style="text-align:center;padding:24px;color:var(--text-muted);background:#fff;border-radius:10px;border:1px solid var(--border);font-size:13px;">Belum ada riwayat notifikasi.</div>`;
    return;
  }

  el.innerHTML = riwayat.map(r => `
    <div class="riwayat-item">
      <span style="font-size:18px;">${r.type === 'daily' ? '📊' : '🔔'}</span>
      <div class="riwayat-msg">${r.msg}</div>
      <div class="riwayat-time">${r.time}</div>
    </div>
  `).join('');
}

// ===== LOAD STOK =====
async function loadStok() {
  try {
    const res = await fetch(`${API}/notif/stok?threshold=${threshold}`, { headers });
    const data = await res.json();
    const items = data.data || [];

    const habis   = items.filter(s => s.stock === 0);
    const menipis = items.filter(s => s.stock > 0 && s.stock <= threshold);

    const el = document.getElementById('stokSection');

    if (habis.length === 0 && menipis.length === 0) {
      el.innerHTML = `
        <div class="notif-empty">
          <div class="icon">✅</div>
          <p><strong>Semua stok aman!</strong></p>
          <p style="margin-top:4px;font-size:12px;">Tidak ada sparepart yang perlu direstock saat ini.</p>
        </div>`;
      return;
    }

    let html = '';

    if (habis.length > 0) {
      html += `<div class="notif-section-title">❌ Stok Habis <span class="badge-count red">${habis.length}</span></div>
        <div class="notif-list">
          ${habis.map(s => `
            <div class="notif-item">
              <div class="notif-icon red">❌</div>
              <div class="notif-info">
                <div class="notif-name">${s.name}</div>
                <div class="notif-detail">${s.code ? `Kode: <b>${s.code}</b>` : ''}${s.rack_location ? ` · Rak: <b>${s.rack_location}</b>` : ''}</div>
              </div>
              <div class="notif-stock red">0 pcs</div>
            </div>`).join('')}
        </div>`;
    }

    if (menipis.length > 0) {
      html += `<div class="notif-section-title" style="margin-top:${habis.length?'8px':'0'}">⚠️ Stok Menipis <span class="badge-count orange">${menipis.length}</span></div>
        <div class="notif-list">
          ${menipis.map(s => `
            <div class="notif-item">
              <div class="notif-icon orange">⚠️</div>
              <div class="notif-info">
                <div class="notif-name">${s.name}</div>
                <div class="notif-detail">${s.code ? `Kode: <b>${s.code}</b>` : ''}${s.rack_location ? ` · Rak: <b>${s.rack_location}</b>` : ''}</div>
              </div>
              <div class="notif-stock orange">${s.stock} pcs</div>
            </div>`).join('')}
        </div>`;
    }

    el.innerHTML = html;
  } catch (err) {
    document.getElementById('stokSection').innerHTML = `<div style="color:var(--red);padding:16px;">Gagal memuat data stok.</div>`;
  }
}

// ===== LOAD OIL REMINDERS =====
async function loadOilReminders() {
  const tbody = document.getElementById('oilReminderTableBody');
  if (!tbody) return;

  try {
    const res = await fetch(`${API}/reminders`, { headers });
    const data = await res.json();
    const reminders = data.data || [];

    const countEl = document.getElementById('oilReminderCount');
    if (countEl) {
      const pendingCount = reminders.filter(r => r.status === 'pending').length;
      countEl.textContent = pendingCount;
    }

    if (reminders.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" class="empty-state">Belum ada pengingat terdaftar.</td></tr>`;
      return;
    }

    tbody.innerHTML = reminders.map((r, idx) => {
      const formatIndo = (dateStr) => {
        if (!dateStr) return '-';
        const d = new Date(dateStr);
        return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
      };

      let dayText = '';
      let daysLeft = r.days_left;
      if (daysLeft === undefined || daysLeft === null) {
        // Fallback: hitung sisa hari di frontend jika backend belum direstart
        const scheduledDate = new Date(r.scheduled_date);
        const today = new Date();
        scheduledDate.setHours(0,0,0,0);
        today.setHours(0,0,0,0);
        const diffTime = scheduledDate - today;
        daysLeft = Math.round(diffTime / (1000 * 60 * 60 * 24));
      }
      if (daysLeft < 0) {
        dayText = `<span style="color:#e74c3c; font-weight:700; font-size:11px;">Lewat ${Math.abs(daysLeft)} hari</span>`;
      } else if (daysLeft === 0) {
        dayText = `<span style="color:#e67e22; font-weight:700; font-size:11px;">Hari ini</span>`;
      } else {
        dayText = `<span style="color:#27ae60; font-weight:600; font-size:11px;">${daysLeft} hari lagi</span>`;
      }

      const actionButton = r.status === 'pending'
        ? `<button class="btn-primary" onclick="sendWhatsAppReminder(${r.id}, '${escJs(r.customer_name)}', '${r.phone || ''}', '${r.license_plate}', '${escJs(r.sparepart_name)}', '${formatIndo(r.last_change_date)}')" style="padding:4px 8px; font-size:11px; background:#25d366; border-color:#25d366; display:inline-flex; align-items:center; gap:4px; font-weight:700; color:#fff; cursor:pointer; border-radius:6px; height:22px;">
            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
            WA
           </button>`
        : `<span style="color:#15803d; font-size:11px; font-weight:700; background:#f0fdf4; padding:2px 8px; border-radius:12px;">Selesai</span>`;

      const deleteBtn = `<button class="btn-danger" onclick="deleteReminder(${r.id})" style="padding:4px; font-size:11px; background:#e74c3c; border:1px solid #e74c3c; display:inline-flex; align-items:center; justify-content:center; color:#fff; cursor:pointer; border-radius:6px; width:22px; height:22px;" title="Hapus Pengingat">
            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
           </button>`;

      return `
        <tr>
          <td style="padding: 8px 10px;">
            <div style="font-weight:700; color:#333; font-size:12.5px;">${r.customer_name}</div>
            <div style="margin-top:2px;"><span style="font-family:monospace; background:#e2e8f0; padding:1px 4px; border-radius:4px; font-size:9.5px; font-weight:700; letter-spacing:0.5px; color:#475569;">${r.license_plate}</span></div>
          </td>
          <td style="font-weight:500; color:#475569; font-size:12px; padding: 8px 10px; max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escHtml(r.sparepart_name)}">${r.sparepart_name}</td>
          <td style="padding: 8px 10px;">
            <div>${dayText}</div>
            <div style="font-size:10px; color:#94a3b8; margin-top:2px;">Jadwal: ${formatIndo(r.scheduled_date)}</div>
          </td>
          <td style="padding: 8px 10px;">
            <div style="display:flex; gap:6px; align-items:center; justify-content:center;">
              ${actionButton}
              ${deleteBtn}
            </div>
          </td>
        </tr>
      `;
    }).join('');

  } catch (err) {
    console.error("Error loadOilReminders:", err);
    tbody.innerHTML = `<tr><td colspan="4" class="empty-state" style="color:var(--red);">Gagal memuat data pengingat.</td></tr>`;
  }
}

function escJs(str) {
  if (!str) return '';
  return str.replace(/'/g, "\\'").replace(/"/g, '\\"');
}

function escHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

async function sendWhatsAppReminder(id, name, phone, plate, serviceName, lastDate) {
  if (!phone) {
    alert("Pelanggan tidak memiliki nomor HP terdaftar!");
    return;
  }

  let cleanPhone = phone.replace(/[^0-9]/g, '');
  if (cleanPhone.startsWith('0')) {
    cleanPhone = '62' + cleanPhone.substring(1);
  }

  // Temukan template yang cocok berdasarkan keyword di serviceName
  const matched = reminderTemplates.find(t => serviceName.toLowerCase().includes(t.service_keyword.toLowerCase()));
  
  let templateText = '';
  if (matched) {
    templateText = matched.wa_template;
  } else {
    // Template fallback jika tidak ada kata kunci yang cocok
    templateText = 'Halo Kak {{name}},\n\nkami dari Bengkel Motodoct ingin mengingatkan bahwa motor Anda dengan plat nomor {{license_plate}} sudah waktunya untuk melakukan perawatan berkala: *{{service_name}}*.\n\nSilakan mampir ke bengkel kami untuk menjaga performa mesin motor Anda agar tetap prima. Terima kasih! 😊🙏';
  }

  // Lakukan penggantian variabel dinamis
  const text = templateText
    .replace(/\{\{name\}\}/g, name)
    .replace(/\{\{license_plate\}\}/g, plate)
    .replace(/\{\{service_name\}\}/g, serviceName)
    .replace(/\{\{last_date\}\}/g, lastDate);

  const waUrl = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(text)}`;
  window.open(waUrl, '_blank');

  try {
    const res = await fetch(`${API}/reminders/${id}/status`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ status: 'sent' })
    });
    const data = await res.json();
    if (data.success) {
      showToast('✅ Pengingat berhasil ditandai terkirim!', '#27ae60');
      loadOilReminders();
    }
  } catch (err) {
    console.error("Gagal memperbarui status pengingat:", err);
  }
}

// ===== CUSTOM REMINDER HANDLERS =====
async function loadCustomers() {
  try {
    const res = await fetch(`${API}/customers`, { headers });
    const data = await res.json();
    if (data.success) {
      customers = data.data || [];
      const dl = document.getElementById('reminderCustomerDatalist');
      if (dl) {
        dl.innerHTML = customers.map(c => `<option value="${c.name} (${c.license_plate || '-'})"></option>`).join('');
      }
    }
  } catch (err) {
    console.error("Gagal memuat pelanggan untuk pengingat:", err);
  }
}

function openAddReminderModal() {
  const modal = document.getElementById('modalAddReminder');
  if (modal) {
    modal.classList.remove('hidden');
    
    // Inisialisasi dropdown template
    const sel = document.getElementById('reminderTemplateSelect');
    if (sel) {
      let optionsHtml = '<option value="">-- Pilih Tipe Servis --</option>';
      optionsHtml += reminderTemplates.map(t => `<option value="${t.id}">${t.name} (${t.interval_days} hari)</option>`).join('');
      optionsHtml += '<option value="kustom">Lainnya (Kustom)...</option>';
      sel.innerHTML = optionsHtml;
    }
    
    // Reset inputs
    document.getElementById('reminderCustomerInput').value = '';
    if (sel) sel.value = '';
    document.getElementById('reminderNameInput').value = '';
    document.getElementById('reminderDateInput').value = '';
    document.getElementById('customReminderNameContainer').style.display = 'none';
  }
}

function closeAddReminderModal() {
  const modal = document.getElementById('modalAddReminder');
  if (modal) modal.classList.add('hidden');
}

function handleReminderTemplateSelectChange() {
  const selVal = document.getElementById('reminderTemplateSelect').value;
  const customContainer = document.getElementById('customReminderNameContainer');
  const customInput = document.getElementById('reminderNameInput');
  const dateInput = document.getElementById('reminderDateInput');

  if (selVal === 'kustom') {
    customContainer.style.display = 'block';
    customInput.required = true;
    customInput.value = '';
    dateInput.value = '';
  } else if (selVal) {
    customContainer.style.display = 'none';
    customInput.required = false;
    customInput.value = '';
    
    // Auto-calculate date: today + interval_days dari template terpilih
    const matched = reminderTemplates.find(t => t.id === parseInt(selVal));
    if (matched) {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + matched.interval_days);
      dateInput.value = targetDate.toISOString().split('T')[0];
    }
  } else {
    customContainer.style.display = 'none';
    customInput.required = false;
    customInput.value = '';
    dateInput.value = '';
  }
}

async function saveCustomReminder() {
  const customerInputVal = document.getElementById('reminderCustomerInput').value;
  const templateVal = document.getElementById('reminderTemplateSelect').value;
  const customNameVal = document.getElementById('reminderNameInput').value;
  const dateInputVal = document.getElementById('reminderDateInput').value;

  if (!customerInputVal || !templateVal || !dateInputVal) {
    showToast('⚠️ Mohon lengkapi semua field wajib', '#e74c3c');
    return;
  }

  let finalName = '';
  if (templateVal === 'kustom') {
    if (!customNameVal) {
      showToast('⚠️ Silakan masukkan nama tindakan kustom', '#e74c3c');
      return;
    }
    finalName = customNameVal;
  } else {
    const matchedT = reminderTemplates.find(t => t.id === parseInt(templateVal));
    if (matchedT) finalName = matchedT.name;
  }

  // Cocokkan input autocomplete ke pelanggan terdaftar
  const matched = customers.find(c => `${c.name} (${c.license_plate || '-'})` === customerInputVal);
  if (!matched) {
    showToast('⚠️ Pelanggan tidak terdaftar! Pilih dari daftar autocomplete.', '#e74c3c');
    return;
  }

  try {
    const res = await fetch(`${API}/reminders`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        customer_id: matched.id,
        sparepart_name: finalName,
        scheduled_date: dateInputVal
      })
    });
    const data = await res.json();
    if (data.success) {
      showToast('✅ ' + data.message, '#27ae60');
      closeAddReminderModal();
      loadOilReminders();
    } else {
      showToast('❌ ' + data.message, '#e74c3c');
    }
  } catch (err) {
    console.error("Gagal menyimpan pengingat kustom:", err);
    showToast('❌ Gagal menghubungi server', '#e74c3c');
  }
}

async function deleteReminder(id) {
  if (!confirm('Apakah Anda yakin ingin menghapus jadwal pengingat ini?')) return;
  try {
    const res = await fetch(`${API}/reminders/${id}`, {
      method: 'DELETE',
      headers
    });
    const data = await res.json();
    if (data.success) {
      showToast('✅ ' + data.message, '#27ae60');
      loadOilReminders();
    } else {
      showToast('❌ ' + data.message, '#e74c3c');
    }
  } catch (err) {
    console.error("Gagal menghapus pengingat:", err);
    showToast('❌ Gagal menghubungi server', '#e74c3c');
  }
}

// ===== REMINDER TEMPLATES CRUD HANDLERS =====
async function loadTemplates() {
  const tbody = document.getElementById('templateTableBody');
  if (!tbody) return;

  try {
    const res = await fetch(`${API}/reminders/templates`, { headers });
    const data = await res.json();
    reminderTemplates = data.data || [];
    renderTemplates();
  } catch (err) {
    console.error("Gagal loadTemplates:", err);
    tbody.innerHTML = `<tr><td colspan="5" class="empty-state" style="color:var(--red);">Gagal memuat data templat.</td></tr>`;
  }
}

function renderTemplates() {
  const tbody = document.getElementById('templateTableBody');
  if (!tbody) return;

  if (reminderTemplates.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty-state">Belum ada templat pengingat kustom.</td></tr>`;
    return;
  }

  tbody.innerHTML = reminderTemplates.map(t => `
    <tr>
      <td style="font-family:monospace; font-weight:700; color:#1a1a2e; font-size:12px; padding: 10px;">${t.service_keyword}</td>
      <td style="font-weight:600; color:#333; font-size:12px; padding: 10px;">${t.name}</td>
      <td style="text-align:center; font-weight:700; color:#27ae60; font-size:12px; padding: 10px;">${t.interval_days} hari</td>
      <td style="font-size:11.5px; color:#555; max-width:280px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; padding: 10px;" title="${escHtml(t.wa_template)}">${t.wa_template}</td>
      <td style="text-align:center; padding: 10px;">
        <div style="display:flex; gap:6px; align-items:center; justify-content:center;">
          ${isAdminOrOwner ? `
            <button onclick="openTemplateModal(${t.id})" class="btn-primary" style="padding:4px 8px; font-size:11px; background:#f39c12; border-color:#f39c12; color:#fff; font-weight:700; cursor:pointer; border-radius:6px; display:inline-flex; align-items:center; gap:2px; height:22px;">Edit</button>
            <button onclick="deleteTemplate(${t.id})" class="btn-danger" style="padding:4px; font-size:11px; background:#e74c3c; border-color:#e74c3c; color:#fff; font-weight:700; cursor:pointer; border-radius:6px; display:inline-flex; align-items:center; justify-content:center; width:22px; height:22px;">
              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          ` : '<span style="color:#aaa; font-size:11px;">Tidak ada akses</span>'}
        </div>
      </td>
    </tr>
  `).join('');
}

function openTemplateModal(id = null) {
  const modal = document.getElementById('modalTemplate');
  if (!modal) return;

  const titleEl = document.getElementById('templateModalTitle');
  const idInput = document.getElementById('templateIdInput');
  const keywordInput = document.getElementById('templateKeywordInput');
  const nameInput = document.getElementById('templateNameInput');
  const intervalInput = document.getElementById('templateIntervalInput');
  const waInput = document.getElementById('templateWaInput');

  modal.classList.remove('hidden');

  if (id) {
    titleEl.textContent = 'Edit Templat Pengingat';
    const t = reminderTemplates.find(x => x.id === id);
    if (t) {
      idInput.value = t.id;
      keywordInput.value = t.service_keyword;
      // Jangan izinkan edit keyword untuk template bawaan demi stabilitas transaksi POS
      if (['oli', 'cvt', 'ban'].includes(t.service_keyword)) {
        keywordInput.disabled = true;
        keywordInput.style.background = '#f5f5f5';
      } else {
        keywordInput.disabled = false;
        keywordInput.style.background = '#fff';
      }
      nameInput.value = t.name;
      intervalInput.value = t.interval_days;
      waInput.value = t.wa_template;
    }
  } else {
    titleEl.textContent = 'Tambah Templat Pengingat';
    idInput.value = '';
    keywordInput.value = '';
    keywordInput.disabled = false;
    keywordInput.style.background = '#fff';
    nameInput.value = '';
    intervalInput.value = '';
    waInput.value = '';
  }
}

function closeTemplateModal() {
  const modal = document.getElementById('modalTemplate');
  if (modal) modal.classList.add('hidden');
}

async function saveTemplate() {
  const id = document.getElementById('templateIdInput').value;
  const keyword = document.getElementById('templateKeywordInput').value.toLowerCase().trim();
  const name = document.getElementById('templateNameInput').value.trim();
  const interval = parseInt(document.getElementById('templateIntervalInput').value);
  const wa = document.getElementById('templateWaInput').value.trim();

  if (!keyword || !name || !interval || !wa) {
    showToast('⚠️ Mohon lengkapi semua field wajib', '#e74c3c');
    return;
  }

  const url = id ? `${API}/reminders/templates/${id}` : `${API}/reminders/templates`;
  const method = id ? 'PUT' : 'POST';

  try {
    const res = await fetch(url, {
      method,
      headers,
      body: JSON.stringify({ service_keyword: keyword, name, interval_days: interval, wa_template: wa })
    });
    const data = await res.json();
    if (data.success) {
      showToast('✅ ' + data.message, '#27ae60');
      closeTemplateModal();
      loadTemplates();
    } else {
      showToast('❌ ' + data.message, '#e74c3c');
    }
  } catch (err) {
    console.error("Gagal saveTemplate:", err);
    showToast('❌ Gagal menghubungi server', '#e74c3c');
  }
}

async function deleteTemplate(id) {
  const t = reminderTemplates.find(x => x.id === id);
  if (t && ['oli', 'cvt', 'ban'].includes(t.service_keyword)) {
    alert('Templat bawaan (oli, cvt, ban) tidak dapat dihapus demi kestabilan database transaksi POS!');
    return;
  }

  if (!confirm('Apakah Anda yakin ingin menghapus templat pengingat kustom ini?')) return;

  try {
    const res = await fetch(`${API}/reminders/templates/${id}`, { method: 'DELETE', headers });
    const data = await res.json();
    if (data.success) {
      showToast('✅ ' + data.message, '#27ae60');
      loadTemplates();
    } else {
      showToast('❌ ' + data.message, '#e74c3c');
    }
  } catch (err) {
    console.error("Gagal deleteTemplate:", err);
    showToast('❌ Gagal menghubungi server', '#e74c3c');
  }
}

// ===== KIRIM NOTIF STOK =====
async function sendStok() {
  const btn = document.getElementById('btnSendStok');
  btn.disabled = true; btn.textContent = 'Mengirim...';
  try {
    const res = await fetch(`${API}/notif/send`, { method: 'POST', headers });
    const data = await res.json();
    if (data.success) {
      showToast('✅ ' + data.message, '#27ae60');
      addRiwayat('Notifikasi stok menipis/habis dikirim ke Telegram', 'stok');
    } else {
      showToast('❌ ' + data.message, '#e74c3c');
    }
  } catch { showToast('❌ Tidak bisa terhubung ke server', '#e74c3c'); }
  finally { btn.disabled = false; btn.textContent = '📨 Kirim Notif Stok'; }
}

// ===== KIRIM LAPORAN HARIAN =====
async function sendDaily() {
  const btn = document.getElementById('btnSendDaily');
  btn.disabled = true; btn.textContent = 'Mengirim...';
  try {
    const res = await fetch(`${API}/notif/send-daily`, { method: 'POST', headers });
    const data = await res.json();
    if (data.success) {
      showToast('✅ ' + data.message, '#27ae60');
      addRiwayat('Laporan harian dikirim ke Telegram', 'daily');
    } else {
      showToast('❌ ' + data.message, '#e74c3c');
    }
  } catch { showToast('❌ Tidak bisa terhubung ke server', '#e74c3c'); }
  finally { btn.disabled = false; btn.textContent = '📈 Kirim Laporan Harian'; }
}

// ===== THRESHOLD =====
function applyThreshold() {
  const val = parseInt(document.getElementById('thresholdInput').value) || 5;
  threshold = val;
  localStorage.setItem('notif_threshold', val);
  showToast(`✅ Threshold diubah ke ${val} pcs`, '#1a1a2e');
  loadStok();
}

// ===== TEST TELEGRAM KONEKSI =====
async function testTelegram() {
  const btn = document.getElementById('btnTestTelegram');
  btn.disabled = true; btn.textContent = 'Menghubungkan...';
  try {
    const res = await fetch(`${API}/notif/test-telegram`, { method: 'POST', headers });
    const data = await res.json();
    if (data.success) {
      showToast('✅ ' + data.message, '#f39c12');
      addRiwayat('Tes koneksi bot Telegram berhasil terkirim', 'stok');
    } else {
      showToast('❌ ' + data.message, '#e74c3c');
    }
  } catch { showToast('❌ Tidak bisa terhubung ke server', '#e74c3c'); }
  finally { btn.disabled = false; btn.textContent = '🔌 Tes Koneksi Bot'; }
}

// Init
loadStok();
loadCustomers();
loadTemplates();
loadOilReminders();
renderRiwayat();


