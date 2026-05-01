const API = 'http://localhost:3000/api';
const token = localStorage.getItem('token');
const user = JSON.parse(localStorage.getItem('user') || '{}');

if (!token) window.location.href = 'login.html';

// Set user info
const userDisplayEl = document.getElementById('userDisplay');
const userRoleEl = document.getElementById('userRole');
const userAvatarEl = document.getElementById('userAvatar');
if (userDisplayEl) userDisplayEl.textContent = user.username || user.name || 'Admin';
if (userRoleEl) userRoleEl.textContent = user.role || 'Kasir';
if (userAvatarEl) userAvatarEl.textContent = (user.username || user.name || 'A')[0].toUpperCase();

// Clock
function updateClock() {
  const now = new Date();
  const days = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
  const months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
  const day = days[now.getDay()];
  const date = now.getDate();
  const month = months[now.getMonth()];
  const year = now.getFullYear();
  const hh = String(now.getHours()).padStart(2,'0');
  const mm = String(now.getMinutes()).padStart(2,'0');
  const el = document.getElementById('clockDisplay');
  if (el) el.textContent = `${day}, ${date} ${month} ${year} · ${hh}:${mm} WIB`;
}
updateClock();
setInterval(updateClock, 1000);

function rupiah(n) {
  return 'Rp ' + Number(n || 0).toLocaleString('id-ID');
}

function logout() {
  localStorage.clear();
  window.location.href = 'login.html';
}

// State
let spareparts = [];
let services = [];
let mechanics = [];
let cart = [];
let activeTab = 'sparepart';
let paymentMethod = 'cash';

// Load data
async function loadData() {
  try {
    const [resS, resSv, resM] = await Promise.all([
      fetch(`${API}/spareparts`, { headers: { Authorization: `Bearer ${token}` } }),
      fetch(`${API}/services`, { headers: { Authorization: `Bearer ${token}` } }),
      fetch(`${API}/mechanics`, { headers: { Authorization: `Bearer ${token}` } })
    ]);
    const [sData, svData, mData] = await Promise.all([resS.json(), resSv.json(), resM.json()]);
    if (sData.success) spareparts = sData.data;
    if (svData.success) services = svData.data;
    if (mData.success) mechanics = mData.data;
    renderProducts();
    renderMechanicSelect();
  } catch (err) {
    console.error('Load data error:', err);
  }
}

// Tab switching
function switchTab(tab) {
  activeTab = tab;
  document.getElementById('tabSparepart').classList.toggle('hidden', tab !== 'sparepart');
  document.getElementById('tabServis').classList.toggle('hidden', tab !== 'servis');
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
}

// Render product grids
function renderProducts(filter = '') {
  const spGrid = document.getElementById('tabSparepart');
  const svGrid = document.getElementById('tabServis');

  const filteredSp = spareparts.filter(p =>
    p.stock > 0 &&
    (p.name.toLowerCase().includes(filter.toLowerCase()) ||
     (p.code || '').toLowerCase().includes(filter.toLowerCase()))
  );

  spGrid.innerHTML = filteredSp.length ? filteredSp.map(p => `
    <div class="product-card" onclick="addToCartById(${p.id}, 'sparepart')">
      <div class="product-code">${p.code || '-'}</div>
      <div class="product-name">${p.name}</div>
      <div class="product-price">${rupiah(p.price)}</div>
      <div class="product-stock ${p.stock <= 5 ? 'low' : ''}">Stok: ${p.stock}</div>
    </div>
  `).join('') : '<div class="empty-state">Tidak ada produk</div>';

  const filteredSv = services.filter(s =>
    s.name.toLowerCase().includes(filter.toLowerCase())
  );

  svGrid.innerHTML = filteredSv.length ? filteredSv.map(s => `
    <div class="product-card" onclick="addToCartById(${s.id}, 'servis')">
      <div class="product-name">${s.name}</div>
      <div class="product-price">${rupiah(s.price)}</div>
      <div class="product-type">Servis</div>
    </div>
  `).join('') : '<div class="empty-state">Tidak ada servis</div>';
}

// Barcode scan
const barcodeInput = document.getElementById('barcodeInput');
if (barcodeInput) {
  barcodeInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      const code = barcodeInput.value.trim();
      if (!code) return;
      const found = spareparts.find(p => p.code === code);
      if (found) {
        if (found.stock <= 0) {
          alert(`Stok ${found.name} habis!`);
        } else {
          addToCartById(found.id, 'sparepart');
        }
      } else {
        alert(`Kode "${code}" tidak ditemukan!`);
      }
      barcodeInput.value = '';
    }
  });
  barcodeInput.addEventListener('input', () => {
    renderProducts(barcodeInput.value);
  });
}

// Add to cart
function addToCartById(id, type) {
  if (type === 'sparepart') {
    const item = spareparts.find(p => p.id === id);
    if (!item) return;
    const existing = cart.find(c => c.id === id && c.type === 'sparepart');
    if (existing) {
      if (existing.qty >= item.stock) {
        alert('Stok tidak mencukupi!');
        return;
      }
      existing.qty++;
    } else {
      cart.push({ id, type: 'sparepart', name: item.name, price: item.price, qty: 1, maxQty: item.stock });
    }
  } else {
    const item = services.find(s => s.id === id);
    if (!item) return;
    const existing = cart.find(c => c.id === id && c.type === 'servis');
    if (existing) return; // servis tidak duplikat
    cart.push({ id, type: 'servis', name: item.name, price: item.price, qty: 1, mechanic_id: null });
  }
  renderCart();
}

function changeQty(idx, delta) {
  const item = cart[idx];
  if (!item) return;
  const newQty = item.qty + delta;
  if (newQty <= 0) {
    cart.splice(idx, 1);
  } else {
    if (item.type === 'sparepart' && newQty > item.maxQty) {
      alert('Stok tidak mencukupi!');
      return;
    }
    item.qty = newQty;
  }
  renderCart();
}

function removeFromCart(idx) {
  cart.splice(idx, 1);
  renderCart();
}

function renderCart() {
  const cartList = document.getElementById('cartList');
  const mechanicRow = document.getElementById('mechanicRow');
  const hasServis = cart.some(c => c.type === 'servis');

  if (mechanicRow) mechanicRow.classList.toggle('hidden', !hasServis);

  const cartCountEl = document.getElementById('cartCount');
  if (cartCountEl) cartCountEl.textContent = `${cart.length} item`;

  if (!cart.length) {
    cartList.innerHTML = '<div class="empty-cart">Belum ada item</div>';
    updateTotals();
    return;
  }

  cartList.innerHTML = cart.map((item, idx) => `
    <div class="cart-item">
      <div class="cart-item-info">
        <span class="cart-item-name">${item.name}</span>
        <span class="cart-item-type ${item.type}">${item.type === 'servis' ? '🔧 Servis' : '🔩 Part'}</span>
      </div>
      <div class="cart-item-controls">
        <button class="qty-btn" onclick="changeQty(${idx}, -1)">−</button>
        <span class="qty-val">${item.qty}</span>
        <button class="qty-btn" onclick="changeQty(${idx}, 1)">+</button>
        <span class="cart-item-price">${rupiah(item.price * item.qty)}</span>
        <button class="btn-remove" onclick="removeFromCart(${idx})">✕</button>
      </div>
    </div>
  `).join('');

  updateTotals();
}

function updateTotals() {
  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  document.getElementById('subtotalDisplay').textContent = rupiah(subtotal);
  document.getElementById('totalDisplay').textContent = rupiah(subtotal);
  updateChange();
}

// Mechanic select
function renderMechanicSelect() {
  const sel = document.getElementById('selectMechanic');
  if (!sel) return;
  sel.innerHTML = '<option value="">-- Pilih Mekanik --</option>' +
    mechanics.map(m => `<option value="${m.id}">${m.name}</option>`).join('');
}

// Payment
function selectPayment(method) {
  paymentMethod = method;
  document.querySelectorAll('.pay-btn').forEach(b => b.classList.toggle('active', b.dataset.method === method));
  const cashInput = document.getElementById('cashInput');
  if (cashInput) cashInput.classList.toggle('hidden', method !== 'cash');
  updateChange();
}

function updateChange() {
  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const cash = parseFloat(document.getElementById('cashReceived')?.value || 0);
  const changeEl = document.getElementById('changeDisplay');
  if (changeEl) {
    if (paymentMethod === 'cash') {
      const change = cash - total;
      changeEl.textContent = change >= 0 ? rupiah(change) : '—';
      changeEl.style.color = change >= 0 ? '#27ae60' : '#e74c3c';
    } else {
      changeEl.textContent = '—';
    }
  }
}

const cashReceivedEl = document.getElementById('cashReceived');
if (cashReceivedEl) cashReceivedEl.addEventListener('input', updateChange);

// Process transaction
async function processTransaction() {
  if (!cart.length) {
    alert('Keranjang kosong!');
    return;
  }

  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);

  if (paymentMethod === 'cash') {
    const cash = parseFloat(document.getElementById('cashReceived')?.value || 0);
    if (cash < total) {
      alert('Uang yang diterima kurang!');
      return;
    }
  }

  const mechanicId = document.getElementById('selectMechanic')?.value || null;
  const hasServis = cart.some(c => c.type === 'servis');
  if (hasServis && !mechanicId) {
    alert('Pilih mekanik untuk servis!');
    return;
  }

  const sparepartsPayload = cart
    .filter(c => c.type === 'sparepart')
    .map(c => ({ sparepart_id: c.id, quantity: c.qty, price: c.price }));

  const servicesPayload = cart
    .filter(c => c.type === 'servis')
    .map(c => ({ service_id: c.id, mechanic_id: parseInt(mechanicId), price: c.price }));

  const btnProcess = document.getElementById('btnProcess');
  if (btnProcess) { btnProcess.disabled = true; btnProcess.textContent = 'Memproses...'; }

  try {
    const res = await fetch(`${API}/transactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        payment_method: paymentMethod,
        spareparts: sparepartsPayload,
        services: servicesPayload
      })
    });
    const data = await res.json();
    if (data.success) {
      showStruk(data.data, total);
      clearCart();
      await loadData(); // refresh stok realtime
    } else {
      alert('Gagal: ' + data.message);
    }
  } catch (err) {
    alert('Koneksi error!');
    console.error(err);
  } finally {
    if (btnProcess) { btnProcess.disabled = false; btnProcess.textContent = 'BAYAR'; }
  }
}

function clearCart() {
  cart = [];
  if (document.getElementById('cashReceived')) document.getElementById('cashReceived').value = '';
  renderCart();
  selectPayment('cash');
}

// Struk modal
function showStruk(trxData, total) {
  const cash = parseFloat(document.getElementById('cashReceived')?.value || 0);
  const change = paymentMethod === 'cash' ? cash - total : 0;
  const now = new Date();

  const itemsHtml = cart.map(i => `
    <tr>
      <td>${i.name}</td>
      <td style="text-align:center">${i.qty}</td>
      <td style="text-align:right">${rupiah(i.price * i.qty)}</td>
    </tr>
  `).join('');

  document.getElementById('strukContent').innerHTML = `
    <div style="text-align:center;margin-bottom:12px">
      <strong style="font-size:16px">MOTODOCT</strong><br>
      <small>Bengkel Motor Terpercaya</small><br>
      <small>${now.toLocaleString('id-ID')}</small>
    </div>
    <hr style="border:1px dashed #ccc;margin:8px 0">
    <div style="font-size:12px;margin-bottom:4px">No: <strong>${trxData.invoice_number}</strong></div>
    <table style="width:100%;font-size:13px;border-collapse:collapse">
      <thead><tr><th style="text-align:left">Item</th><th>Qty</th><th style="text-align:right">Harga</th></tr></thead>
      <tbody>${itemsHtml}</tbody>
    </table>
    <hr style="border:1px dashed #ccc;margin:8px 0">
    <div style="display:flex;justify-content:space-between;font-weight:700;font-size:14px">
      <span>TOTAL</span><span>${rupiah(total)}</span>
    </div>
    ${paymentMethod === 'cash' ? `
    <div style="display:flex;justify-content:space-between;font-size:13px;margin-top:4px">
      <span>Bayar</span><span>${rupiah(cash)}</span>
    </div>
    <div style="display:flex;justify-content:space-between;font-size:13px">
      <span>Kembalian</span><span>${rupiah(change)}</span>
    </div>` : `<div style="font-size:13px;margin-top:4px">Metode: ${paymentMethod.toUpperCase()}</div>`}
    <hr style="border:1px dashed #ccc;margin:8px 0">
    <div style="text-align:center;font-size:12px;color:#888">Terima kasih atas kunjungan Anda!</div>
  `;

  document.getElementById('modalStruk').classList.remove('hidden');
}

function closeStruk() {
  document.getElementById('modalStruk').classList.add('hidden');
}

function printStruk() {
  const content = document.getElementById('strukContent').innerHTML;
  const win = window.open('', '_blank', 'width=400,height=600');
  win.document.write(`<html><head><title>Struk</title><style>body{font-family:monospace;padding:16px;font-size:13px}hr{border:1px dashed #ccc}</style></head><body>${content}</body></html>`);
  win.document.close();
  win.print();
}

// Init
loadData();
selectPayment('cash');
renderCart();
