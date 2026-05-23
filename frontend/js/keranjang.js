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

const headers = { Authorization: `Bearer ${token}` };

function openSidebar() { document.getElementById('sidebar')?.classList.add('open'); document.getElementById('sidebarOverlay')?.classList.add('open'); }
function closeSidebar() { document.getElementById('sidebar')?.classList.remove('open'); document.getElementById('sidebarOverlay')?.classList.remove('open'); }
function logout() { localStorage.clear(); window.location.href = 'login.html'; }

function rupiah(n) { return 'Rp ' + Number(n || 0).toLocaleString('id-ID'); }

let allCarts = [];

async function loadCarts() {
  try {
    const res = await fetch(`${API}/saved-carts`, { headers });
    const data = await res.json();
    allCarts = data.data || [];
    renderCarts(allCarts);
    updateStats(allCarts);
  } catch (err) {
    console.error(err);
  }
}

function updateStats(carts) {
  document.getElementById('statTotal').textContent = carts.length;
  const totalNilai = carts.reduce((sum, c) => {
    const items = JSON.parse(c.cart_data || '[]');
    return sum + items.reduce((s, i) => s + i.price * i.qty, 0);
  }, 0);
  document.getElementById('statNilai').textContent = rupiah(totalNilai);
}

function filterCarts() {
  const q = document.getElementById('searchInput').value.toLowerCase();
  const filtered = allCarts.filter(c =>
    c.license_plate.toLowerCase().includes(q) ||
    (c.customer_name || '').toLowerCase().includes(q)
  );
  renderCarts(filtered);
}

function renderCarts(carts) {
  const grid = document.getElementById('cartGrid');

  if (!carts.length) {
    grid.innerHTML = `
      <div class="empty-carts" style="grid-column:1/-1;">
        <div class="icon">🗂</div>
        <h3>Tidak ada keranjang tersimpan</h3>
        <p>Semua servis sudah selesai atau belum ada yang disimpan.</p>
      </div>`;
    return;
  }

  grid.innerHTML = carts.map(c => {
    const items = JSON.parse(c.cart_data || '[]');
    const total = items.reduce((s, i) => s + i.price * i.qty, 0);
    const tgl = new Date(c.created_at).toLocaleString('id-ID', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });

    const itemsHtml = items.slice(0, 3).map(i => `
      <div class="cart-item-row">
        <span>${i.name} ×${i.qty}</span>
        <span>${rupiah(i.price * i.qty)}</span>
      </div>`).join('') +
      (items.length > 3 ? `<div style="font-size:11px;color:#aaa;margin-top:2px;">+${items.length - 3} item lainnya</div>` : '');

    return `
      <div class="cart-card">
        <div class="cart-card-header">
          <span class="plate-badge">${c.license_plate}</span>
          <span class="cart-card-time">${tgl}</span>
        </div>
        <div class="cart-card-body">
          <div class="cart-card-meta">
            ${c.customer_name ? `<div class="cart-meta-row">👤 <strong>${c.customer_name}</strong></div>` : ''}
            ${c.mechanic_name ? `<div class="cart-meta-row">🔧 Mekanik: <strong>${c.mechanic_name}</strong></div>` : ''}
            ${c.note ? `<div class="cart-meta-row">📝 ${c.note}</div>` : ''}
          </div>
          <div class="cart-items-list">${itemsHtml}</div>
          <div class="cart-total">
            <span>Total Estimasi</span>
            <span>${rupiah(total)}</span>
          </div>
        </div>
        <div class="cart-card-footer">
          <button class="btn-lanjut" onclick="lanjutBayar(${c.id})">🧾 Lanjut Bayar</button>
          <button class="btn-hapus-cart" onclick="hapusCart(${c.id})">🗑</button>
        </div>
      </div>`;
  }).join('');
}

function lanjutBayar(id) {
  // Simpan ID ke localStorage, kasir akan load otomatis
  localStorage.setItem('loadCartId', id);
  window.location.href = 'transaksi.html';
}

async function hapusCart(id) {
  if (!confirm('Hapus keranjang ini?')) return;
  try {
    const res = await fetch(`${API}/saved-carts/${id}`, { method: 'DELETE', headers });
    const data = await res.json();
    if (data.success) loadCarts();
    else alert(data.message);
  } catch { alert('Gagal menghapus!'); }
}

loadCarts();
