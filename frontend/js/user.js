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

// ===== USER INFO =====
document.getElementById('welcomeText').textContent = user.username || 'Admin';
document.getElementById('userAvatar').textContent = (user.username || 'A')[0].toUpperCase();

// State
let users = [];
let editId = null;
let deleteId = null;

// Load Data
async function loadUsers() {
  try {
    const res = await fetch(`${API}/users`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    if (data.success) {
      users = data.data;
      renderTable();
      updateStats();
    } else {
      alert('Gagal memuat data user!');
    }
  } catch (err) {
    console.error('Error loading users:', err);
  }
}

// Update Stats
function updateStats() {
  const total = users.length;
  const admins = users.filter(u => u.role === 'admin').length;
  const cashiers = users.filter(u => u.role === 'kasir').length;
  
  document.getElementById('statTotalUsers').textContent = total;
  document.getElementById('statTotalAdmins').textContent = admins;
  document.getElementById('statTotalCashiers').textContent = cashiers;
}

// Render Table
function renderTable(data = users) {
  const tbody = document.getElementById('userTableBody');
  if (!data.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-state">Tidak ada data pengguna</td></tr>';
    return;
  }

  tbody.innerHTML = data.map((u, index) => {
    const dateStr = new Date(u.created_at).toLocaleDateString('id-ID', {
      day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
    }) + ' WIB';
    
    // Badge styling for role
    let roleBadge = '';
    if (u.role === 'admin') {
      roleBadge = '<span style="background:rgba(59,130,246,0.1); color:#3b82f6; font-size:11px; padding:3px 8px; border-radius:12px; font-weight:700; text-transform:uppercase;">👑 Admin</span>';
    } else if (u.role === 'kasir') {
      roleBadge = '<span style="background:rgba(16,185,129,0.1); color:#10b981; font-size:11px; padding:3px 8px; border-radius:12px; font-weight:700; text-transform:uppercase;">🛒 Kasir</span>';
    } else if (u.role === 'gudang') {
      roleBadge = '<span style="background:rgba(245,158,11,0.1); color:#d97706; font-size:11px; padding:3px 8px; border-radius:12px; font-weight:700; text-transform:uppercase;">📦 Gudang</span>';
    } else if (u.role === 'owner') {
      roleBadge = '<span style="background:rgba(139,92,246,0.1); color:#7c3aed; font-size:11px; padding:3px 8px; border-radius:12px; font-weight:700; text-transform:uppercase;">👔 Owner</span>';
    } else {
      roleBadge = `<span style="background:#eee; color:#666; font-size:11px; padding:3px 8px; border-radius:12px; font-weight:700; text-transform:uppercase;">${u.role}</span>`;
    }
      
    // Prevent delete button for current logged-in user or master admin
    const isSelf = Number(u.id) === Number(user.id);
    const isAdminMaster = u.username === 'admin';
    
    let deleteBtn = '';
    if (isSelf) {
      deleteBtn = `<button class="btn-danger" disabled style="opacity:0.4; cursor:not-allowed; background:#888;" title="Anda tidak dapat menghapus diri sendiri">Hapus</button>`;
    } else if (isAdminMaster) {
      deleteBtn = `<button class="btn-danger" disabled style="opacity:0.4; cursor:not-allowed; background:#888;" title="Akun admin utama tidak dapat dihapus!">Hapus</button>`;
    } else {
      deleteBtn = `<button class="btn-danger" onclick="openDeleteModal(${u.id}, '${u.username}')">Hapus</button>`;
    }

    let editBtn = '';
    if (isAdminMaster && user.username !== 'admin') {
      editBtn = `<button class="btn-secondary" disabled style="opacity:0.4; cursor:not-allowed;" title="Hanya akun admin utama yang bisa mengedit akun ini">Edit</button>`;
    } else {
      editBtn = `<button class="btn-secondary" onclick="openModal(${u.id})">Edit</button>`;
    }

    return `
      <tr>
        <td style="text-align:center;">${index + 1}</td>
        <td style="font-weight:600; color:#1e293b;">${u.username} ${isSelf ? ' <span style="font-size:10px; color:#aaa; font-weight:normal;">(Anda)</span>' : ''}</td>
        <td>
          <div style="display:flex; align-items:center; gap:8px;">
            <span id="pwText-${u.id}" style="font-family:monospace; color:#888; background:#f1f5f9; padding:2px 6px; border-radius:4px; font-size:11px;">••••••••</span>
            <button type="button" onclick="toggleRowPassword(${u.id}, '${u.plain_password || ''}')" style="background:none; border:none; cursor:pointer; font-size:12px; padding:2px; display:inline-flex; align-items:center; justify-content:center;" title="Intip Kata Sandi">👁️</button>
          </div>
        </td>
        <td>${roleBadge}</td>
        <td>${dateStr}</td>
        <td style="text-align:center;">
          <div style="display:flex; justify-content:center; gap:8px;">
            ${editBtn}
            ${deleteBtn}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// Filter Table
function filterTable() {
  const val = document.getElementById('searchInput').value.trim().toLowerCase();
  const filtered = users.filter(u => u.username.toLowerCase().includes(val));
  renderTable(filtered);
}

// Modal Helpers
function openModal(id = null) {
  editId = id;
  const modal = document.getElementById('modalUser');
  const title = document.getElementById('modalTitle');
  const fieldPass = document.getElementById('fieldPassword');
  const labelPass = document.getElementById('labelPassword');
  const helpPass = document.getElementById('helpPassword');
  
  modal.classList.remove('hidden');
  document.getElementById('formUser').reset();

  if (id) {
    title.textContent = 'Edit Akun User';
    const found = users.find(u => u.id === id);
    if (found) {
      document.getElementById('fieldUsername').value = found.username;
      document.getElementById('fieldRole').value = found.role;
      document.getElementById('fieldPassword').value = found.plain_password || '';
    }
    fieldPass.required = false;
    helpPass.style.display = 'block';
    labelPass.innerHTML = 'Kata Sandi Baru <span style="font-size:10px; color:#aaa; font-weight:normal;">(Opsional)</span>';
  } else {
    title.textContent = 'Tambah Akun User';
    fieldPass.required = true;
    helpPass.style.display = 'none';
    labelPass.innerHTML = 'Kata Sandi / Password <span class="required">*</span>';
  }
}

// closeModal
function closeModal() {
  document.getElementById('modalUser').classList.add('hidden');
}

// Save User (Create or Update)
async function saveUser() {
  const username = document.getElementById('fieldUsername').value.trim();
  const password = document.getElementById('fieldPassword').value;
  const role = document.getElementById('fieldRole').value;

  const body = { username, role };
  if (password && password.trim() !== '') {
    body.password = password;
  }

  const url = editId ? `${API}/users/${editId}` : `${API}/users`;
  const method = editId ? 'PUT' : 'POST';

  try {
    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(body)
    });
    const result = await res.json();
    if (result.success) {
      alert(editId ? '✅ Akun user berhasil diperbarui!' : '✅ Akun user baru berhasil didaftarkan!');
      closeModal();
      loadUsers();
    } else {
      alert('⚠️ Gagal menyimpan: ' + (result.message || 'Terjadi kesalahan'));
    }
  } catch (err) {
    console.error('Save user error:', err);
    alert('Terjadi kesalahan koneksi!');
  }
}

// Delete Helpers
function openDeleteModal(id, name) {
  deleteId = id;
  document.getElementById('deleteItemName').textContent = name;
  document.getElementById('modalDelete').classList.remove('hidden');
}

function closeDeleteModal() {
  document.getElementById('modalDelete').classList.add('hidden');
}

async function confirmDelete() {
  if (!deleteId) return;
  try {
    const res = await fetch(`${API}/users/${deleteId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    const result = await res.json();
    if (result.success) {
      alert('✅ Akun user berhasil dihapus!');
      closeDeleteModal();
      loadUsers();
    } else {
      alert('⚠️ Gagal menghapus: ' + (result.message || 'Terjadi kesalahan'));
      closeDeleteModal();
    }
  } catch (err) {
    console.error('Delete user error:', err);
    alert('Terjadi kesalahan koneksi!');
  }
}

// Mobile sidebar helpers
function openSidebar() {
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('sidebarOverlay').classList.add('open');
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('open');
}

// Toggle Password Visibility in Modal Form
function togglePasswordVisibility() {
  const input = document.getElementById('fieldPassword');
  if (input) {
    input.type = input.type === 'password' ? 'text' : 'password';
  }
}

// Toggle Password Visibility in Data Table Rows
function toggleRowPassword(id, plainPassword) {
  const span = document.getElementById(`pwText-${id}`);
  if (span) {
    if (span.textContent === '••••••••') {
      span.textContent = plainPassword || '(Kosong)';
      span.style.color = '#1e293b';
      span.style.fontWeight = '700';
    } else {
      span.textContent = '••••••••';
      span.style.color = '#888';
      span.style.fontWeight = 'normal';
    }
  }
}

// Init
loadUsers();
