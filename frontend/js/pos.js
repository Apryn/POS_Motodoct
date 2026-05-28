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
let customers = [];
let cart = [];
let activeTab = 'sparepart';
let paymentMethod = 'cash';
let activeSavedCartId = null; // track keranjang tersimpan yang sedang aktif

// Load data
async function loadData() {
  try {
    const [resS, resSv, resM, resC] = await Promise.all([
      fetch(`${API}/spareparts`, { headers: { Authorization: `Bearer ${token}` } }),
      fetch(`${API}/services`, { headers: { Authorization: `Bearer ${token}` } }),
      fetch(`${API}/mechanics`, { headers: { Authorization: `Bearer ${token}` } }),
      fetch(`${API}/customers`, { headers: { Authorization: `Bearer ${token}` } })
    ]);
    const [sData, svData, mData, cData] = await Promise.all([
      resS.json(),
      resSv.json(),
      resM.json(),
      resC.json()
    ]);
    if (sData.success) spareparts = sData.data;
    if (svData.success) services = svData.data;
    if (mData.success) mechanics = mData.data;
    if (cData.success) customers = cData.data;
    renderProducts();
    renderMechanicSelect();
    renderCustomerSelect();
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
  const discountPct = parseFloat(document.getElementById('discountInput')?.value || 0);
  const discountAmt = Math.round(subtotal * discountPct / 100);
  const total = subtotal - discountAmt;

  document.getElementById('subtotalDisplay').textContent = rupiah(subtotal);
  if (discountAmt > 0) {
    document.getElementById('discountAmount').textContent = `- ${rupiah(discountAmt)}`;
    document.getElementById('discountRow').style.display = 'flex';
    document.getElementById('discountPctLabel').textContent = `(${discountPct}%)`;
  }
  document.getElementById('totalDisplay').textContent = rupiah(total);
  updateChange();
}

// Mechanic select
function renderMechanicSelect() {
  const sel = document.getElementById('selectMechanic');
  if (!sel) return;
  sel.innerHTML = '<option value="">-- Pilih Mekanik --</option>' +
    mechanics.map(m => `<option value="${m.id}">${m.name}</option>`).join('');
}

// Customer select (Datalist Autocomplete)
function renderCustomerSelect() {
  const dl = document.getElementById('customerDatalist');
  if (!dl) return;
  dl.innerHTML = customers.map(c => `<option value="${c.name} (${c.license_plate || '-'})"></option>`).join('');
}

// Payment
function selectPayment(method) {
  paymentMethod = method;
  document.querySelectorAll('.pay-btn').forEach(b => b.classList.toggle('active', b.dataset.method === method));
  const cashInput = document.getElementById('cashInput');
  if (cashInput) cashInput.classList.toggle('hidden', method !== 'cash');
  updateChange();
}

// Format input uang dengan titik ribuan
function formatCashInput(input) {
  // Ambil hanya angka
  const raw = input.value.replace(/\D/g, '');
  // Format dengan titik ribuan
  input.value = raw ? Number(raw).toLocaleString('id-ID') : '';
  updateChange();
}

function getCashValue() {
  const el = document.getElementById('cashReceived');
  if (!el) return 0;
  // Hapus titik sebelum parse
  return parseFloat(el.value.replace(/\./g, '').replace(',', '.')) || 0;
}

function updateChange() {
  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const discountPct = parseFloat(document.getElementById('discountInput')?.value || 0);
  const total = subtotal - Math.round(subtotal * discountPct / 100);
  const cash = getCashValue();
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

// Process transaction
async function processTransaction() {
  if (!cart.length) {
    alert('Keranjang kosong!');
    return;
  }

  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const discountPct = parseFloat(document.getElementById('discountInput')?.value || 0);
  const discountAmt = Math.round(subtotal * discountPct / 100);
  const total = subtotal - discountAmt;

  if (paymentMethod === 'cash') {
    const cash = getCashValue();
    if (cash < total) {
      alert('Uang yang diterima kurang!');
      return;
    }
  }

  const customerInputVal = document.getElementById('selectCustomerInput')?.value.trim() || '';
  let customerId = null;
  let customName = null;
  let customPlate = null;

  if (customerInputVal) {
    const matched = customers.find(c => `${c.name} (${c.license_plate || '-'})` === customerInputVal);
    if (matched) {
      customerId = matched.id;
    } else {
      // Smart parsing untuk input manual non-member
      const parenMatch = customerInputVal.match(/^(.*?)\s*\((.*?)\)$/);
      if (parenMatch) {
        customName = parenMatch[1].trim() || null;
        customPlate = parenMatch[2].trim() || null;
      } else {
        // Cek jika input diawali huruf lalu angka (format plat nomor)
        if (/^[a-zA-Z]{1,2}\s*\d+/.test(customerInputVal)) {
          customPlate = customerInputVal.toUpperCase();
        } else {
          customName = customerInputVal;
        }
      }
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
        customer_id: customerId ? parseInt(customerId) : null,
        payment_method: paymentMethod,
        spareparts: sparepartsPayload,
        services: servicesPayload,
        license_plate: customPlate,
        customer_name: customName
      })
    });
    const data = await res.json();
    if (data.success) {
      showStruk(data.data, total, subtotal, discountAmt);

      // Hapus keranjang tersimpan kalau transaksi dari saved cart
      if (activeSavedCartId) {
        await fetch(`${API}/saved-carts/${activeSavedCartId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        });
        activeSavedCartId = null;
      }

      clearCart();
      await loadData();
      loadSavedCarts();
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

function openDiscountModal() {
  document.getElementById('discountPassword').value = '';
  document.getElementById('discountInput').value = '';
  document.getElementById('discountError').style.display = 'none';
  document.getElementById('modalDiskon').classList.remove('hidden');
  setTimeout(() => document.getElementById('discountPassword').focus(), 100);
}

function closeDiscountModal() {
  document.getElementById('modalDiskon').classList.add('hidden');
}

async function applyDiscount() {
  const password = document.getElementById('discountPassword').value;
  const pct = parseFloat(document.getElementById('discountInput').value) || 0;
  const errEl = document.getElementById('discountError');

  if (!password) { errEl.textContent = 'Password wajib diisi!'; errEl.style.display = 'block'; return; }
  if (pct <= 0 || pct > 100) { errEl.textContent = 'Diskon harus antara 1-100%'; errEl.style.display = 'block'; return; }

  // Verifikasi password ke backend
  try {
    const res = await fetch(`${API}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: user.username, password })
    });
    const data = await res.json();

    if (!data.success) {
      errEl.textContent = 'Password salah!';
      errEl.style.display = 'block';
      return;
    }

    // Terapkan diskon
    closeDiscountModal();
    updateTotals();
    document.getElementById('discountRow').style.display = 'flex';
    document.getElementById('discountPctLabel').textContent = `(${pct}%)`;

  } catch {
    errEl.textContent = 'Tidak bisa terhubung ke server!';
    errEl.style.display = 'block';
  }
}

function clearCart() {
  cart = [];
  activeSavedCartId = null;
  if (document.getElementById('cashReceived')) document.getElementById('cashReceived').value = '';
  if (document.getElementById('discountInput')) document.getElementById('discountInput').value = '';
  if (document.getElementById('discountRow')) document.getElementById('discountRow').style.display = 'none';
  if (document.getElementById('selectCustomerInput')) document.getElementById('selectCustomerInput').value = '';
  renderCart();
  selectPayment('cash');
}

// ===== RECEIPT SETTINGS =====
const DEFAULT_RECEIPT_SETTINGS = {
  shopName: 'MOTODOCT',
  shopSlogan: 'Bengkel Motor Terpercaya',
  shopWA: '',
  shopIG: '',
  shopFooter: 'Terima kasih atas kunjungan Anda!'
};

function getReceiptSettings() {
  try {
    const saved = localStorage.getItem('receipt_settings');
    return saved ? JSON.parse(saved) : DEFAULT_RECEIPT_SETTINGS;
  } catch {
    return DEFAULT_RECEIPT_SETTINGS;
  }
}

function openReceiptSettings() {
  const cfg = getReceiptSettings();
  document.getElementById('cfgShopName').value = cfg.shopName || '';
  document.getElementById('cfgShopSlogan').value = cfg.shopSlogan || '';
  document.getElementById('cfgShopWA').value = cfg.shopWA || '';
  document.getElementById('cfgShopIG').value = cfg.shopIG || '';
  document.getElementById('cfgShopFooter').value = cfg.shopFooter || '';
  document.getElementById('modalReceiptSettings').classList.remove('hidden');
}

function closeReceiptSettings() {
  document.getElementById('modalReceiptSettings').classList.add('hidden');
}

function saveReceiptSettings() {
  const cfg = {
    shopName: document.getElementById('cfgShopName').value.trim() || 'MOTODOCT',
    shopSlogan: document.getElementById('cfgShopSlogan').value.trim() || 'Bengkel Motor Terpercaya',
    shopWA: document.getElementById('cfgShopWA').value.trim(),
    shopIG: document.getElementById('cfgShopIG').value.trim(),
    shopFooter: document.getElementById('cfgShopFooter').value.trim() || 'Terima kasih atas kunjungan Anda!'
  };
  localStorage.setItem('receipt_settings', JSON.stringify(cfg));
  closeReceiptSettings();
  alert('✅ Pengaturan struk berhasil disimpan!');
}

function escHtml(str) { 
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); 
}

// Struk modal
function showStruk(trxData, total, subtotal, discountAmt) {
  const cash = getCashValue();
  const change = paymentMethod === 'cash' ? cash - total : 0;
  const now = new Date();
  discountAmt = discountAmt || 0;
  subtotal = subtotal || total;
  
  const cfg = getReceiptSettings();

  const itemsHtml = cart.map(i => `
    <tr>
      <td>${i.name}</td>
      <td style="text-align:center">${i.qty}</td>
      <td style="text-align:right">${rupiah(i.price * i.qty)}</td>
    </tr>
  `).join('');

  let contactHtml = '';
  if (cfg.shopWA) contactHtml += `<small>WA: ${escHtml(cfg.shopWA)}</small><br>`;
  if (cfg.shopIG) contactHtml += `<small>IG: ${escHtml(cfg.shopIG)}</small><br>`;

  document.getElementById('strukContent').innerHTML = `
    <div style="text-align:center;margin-bottom:12px">
      <strong style="font-size:16px;text-transform:uppercase;">${escHtml(cfg.shopName)}</strong><br>
      <small>${escHtml(cfg.shopSlogan)}</small><br>
      ${contactHtml}
      <small>${now.toLocaleString('id-ID')}</small>
    </div>
    <hr style="border:1px dashed #ccc;margin:8px 0">
    <div style="font-size:12px;margin-bottom:4px">No: <strong>${trxData.invoice_number}</strong></div>
    <table style="width:100%;font-size:13px;border-collapse:collapse">
      <thead><tr><th style="text-align:left">Item</th><th>Qty</th><th style="text-align:right">Harga</th></tr></thead>
      <tbody>${itemsHtml}</tbody>
    </table>
    <hr style="border:1px dashed #ccc;margin:8px 0">
    <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:2px">
      <span>Subtotal</span><span>${rupiah(subtotal)}</span>
    </div>
    ${discountAmt > 0 ? `<div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:2px;color:#e74c3c">
      <span>Diskon (${document.getElementById('discountPctLabel')?.textContent || ''})</span><span>- ${rupiah(discountAmt)}</span>
    </div>
    <div style="font-size:11px;color:#27ae60;text-align:right;margin-bottom:4px;">🎉 Hemat ${rupiah(discountAmt)}!</div>` : ''}
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
    <div style="text-align:center;font-size:12px;color:#888">${escHtml(cfg.shopFooter)}</div>
  `;

  document.getElementById('modalStruk').classList.remove('hidden');
}

function closeStruk() {
  document.getElementById('modalStruk').classList.add('hidden');
}

function printStruk() {
  const content = document.getElementById('strukContent').innerHTML;
  const win = window.open('', '_blank', 'width=400,height=600');
  win.document.write(`
    <html>
      <head>
        <title>Struk Belanja - Motodoct</title>
        <style>
          @page {
            size: 58mm auto;
            margin: 0;
          }
          body {
            font-family: 'Courier New', Courier, monospace;
            width: 58mm;
            margin: 0;
            padding: 4mm 4mm 8mm 4mm;
            font-size: 11px;
            line-height: 1.3;
            color: #000;
            background: #fff;
            box-sizing: border-box;
          }
          h2, h3, strong {
            font-weight: bold;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 11px;
            margin: 6px 0;
          }
          th, td {
            padding: 3px 0;
            border: none;
          }
          hr {
            border: none;
            border-top: 1px dashed #000;
            margin: 6px 0;
          }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .no-print { display: none; }
        </style>
      </head>
      <body onload="window.print(); setTimeout(() => window.close(), 500);">
        ${content}
      </body>
    </html>
  `);
  win.document.close();
}

// ===== SAVED CARTS =====
async function loadSavedCarts() {
  try {
    const res = await fetch(`${API}/saved-carts`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    const list = document.getElementById('savedCartList');
    const count = document.getElementById('savedCartCount');
    const carts = data.data || [];

    if (count) count.textContent = carts.length;

    if (!carts.length) {
      if (list) list.innerHTML = '<div style="text-align:center;padding:16px;color:#aaa;font-size:12px;">Belum ada keranjang tersimpan</div>';
      return;
    }

    if (!list) return;

    list.innerHTML = carts.map(c => {
      const cartItems = JSON.parse(c.cart_data || '[]');
      const total = cartItems.reduce((s, i) => s + i.price * i.qty, 0);
      const tgl = new Date(c.created_at).toLocaleDateString('id-ID', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' });
      return `
        <div class="saved-cart-item">
          <span class="saved-cart-plate">${c.license_plate}</span>
          <div class="saved-cart-info">
            <div class="saved-cart-name">${c.customer_name || 'Tanpa nama'} ${c.mechanic_name ? '· ' + c.mechanic_name : ''}</div>
            <div class="saved-cart-detail">${cartItems.length} item · ${rupiah(total)} · ${tgl}</div>
          </div>
          <div class="saved-cart-actions">
            <button class="btn-load-cart" onclick="loadSavedCart(${c.id})">Lanjut</button>
            <button class="btn-del-cart" onclick="deleteSavedCart(${c.id})">✕</button>
          </div>
        </div>`;
    }).join('');
  } catch (err) {
    console.error('Load saved carts error:', err);
  }
}

function openSaveCartModal() {
  if (!cart.length) { alert('Keranjang kosong!'); return; }
  document.getElementById('savePlate').value = '';
  document.getElementById('saveCustomer').value = '';
  document.getElementById('saveNote').value = '';

  // Isi dropdown mekanik
  const sel = document.getElementById('saveMechanic');
  sel.innerHTML = '<option value="">-- Pilih Mekanik --</option>' +
    mechanics.map(m => `<option value="${m.id}">${m.name}</option>`).join('');

  document.getElementById('modalSaveCart').classList.remove('hidden');
  setTimeout(() => document.getElementById('savePlate').focus(), 100);
}

function closeSaveCartModal() {
  document.getElementById('modalSaveCart').classList.add('hidden');
}

async function confirmSaveCart() {
  const plate = document.getElementById('savePlate').value.trim().toUpperCase();
  if (!plate) { alert('Plat nomor wajib diisi!'); return; }

  const mechanic_id = document.getElementById('saveMechanic').value || null;

  try {
    const res = await fetch(`${API}/saved-carts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        license_plate: plate,
        customer_name: document.getElementById('saveCustomer').value.trim() || null,
        cart_data: cart,
        mechanic_id: mechanic_id ? parseInt(mechanic_id) : null,
        note: document.getElementById('saveNote').value.trim() || null,
      })
    });
    const data = await res.json();
    if (data.success) {
      closeSaveCartModal();
      clearCart();
      loadSavedCarts();
      alert(`✅ Keranjang ${plate} berhasil disimpan!`);
    } else {
      alert(data.message || 'Gagal menyimpan!');
    }
  } catch { alert('Tidak bisa terhubung ke server!'); }
}

async function loadSavedCart(id) {
  try {
    const res = await fetch(`${API}/saved-carts`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    const saved = (data.data || []).find(c => c.id === id);
    if (!saved) return;

    const cartItems = JSON.parse(saved.cart_data || '[]');
    cart = cartItems;
    activeSavedCartId = saved.id; // tandai keranjang ini sedang aktif

    // Set mekanik kalau ada
    if (saved.mechanic_id) {
      const sel = document.getElementById('selectMechanic');
      if (sel) sel.value = saved.mechanic_id;
    }

    // Auto-match plat nomor ke pelanggan terdaftar
    if (saved.license_plate) {
      const cleanedPlate = saved.license_plate.replace(/\s+/g, '').toUpperCase();
      const matchedCust = customers.find(c => (c.license_plate || '').replace(/\s+/g, '').toUpperCase() === cleanedPlate);
      const custInput = document.getElementById('selectCustomerInput');
      if (custInput) {
        if (matchedCust) {
          custInput.value = `${matchedCust.name} (${matchedCust.license_plate || '-'})`;
        } else {
          custInput.value = '';
        }
      }
    }

    renderCart();
    loadSavedCarts();
    alert(`✅ Keranjang ${saved.license_plate} dimuat!`);
  } catch { alert('Gagal memuat keranjang!'); }
}

async function deleteSavedCart(id) {
  if (!confirm('Hapus keranjang tersimpan ini?')) return;
  try {
    const res = await fetch(`${API}/saved-carts/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    if (data.success) loadSavedCarts();
  } catch { alert('Gagal menghapus!'); }
}

function openAddCustomerModal() {
  document.getElementById('addCustName').value = '';
  document.getElementById('addCustPlate').value = '';
  document.getElementById('addCustPhone').value = '';
  document.getElementById('modalAddCustomer').classList.remove('hidden');
  setTimeout(() => document.getElementById('addCustName').focus(), 100);
}

function closeAddCustomerModal() {
  document.getElementById('modalAddCustomer').classList.add('hidden');
}

async function saveNewCustomerQuick() {
  const name = document.getElementById('addCustName').value.trim();
  const plate = document.getElementById('addCustPlate').value.trim().toUpperCase();
  const phone = document.getElementById('addCustPhone').value.trim() || null;

  if (!name) { alert('Nama pelanggan wajib diisi!'); return; }
  if (!plate) { alert('Plat nomor wajib diisi!'); return; }

  try {
    const res = await fetch(`${API}/customers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ name, license_plate: plate, phone })
    });
    const data = await res.json();
    if (data.success) {
      // Reload daftar pelanggan
      const resC = await fetch(`${API}/customers`, { headers: { Authorization: `Bearer ${token}` } });
      const cData = await resC.json();
      if (cData.success) {
        customers = cData.data;
        renderCustomerSelect();
        
        // Pilih pelanggan yang baru saja ditambahkan secara otomatis
        const matched = customers.find(c => c.license_plate.replace(/\s+/g, '').toUpperCase() === plate.replace(/\s+/g, '').toUpperCase());
        if (matched) {
          document.getElementById('selectCustomerInput').value = `${matched.name} (${matched.license_plate || '-'})`;
        }
      }
      closeAddCustomerModal();
      alert(`✅ Pelanggan ${name} (${plate}) berhasil didaftarkan dan dipilih!`);
      // Update rekam medis button state if necessary
      if (typeof checkVehicleHistoryButton === 'function') checkVehicleHistoryButton();
    } else {
      alert('Gagal menyimpan: ' + (data.message || 'Terjadi kesalahan'));
    }
  } catch (err) {
    alert('Koneksi error!');
  }
}

// ===== VEHICLE SERVICE MEDICAL HISTORY =====
function getPlateFromInput() {
  const inputVal = document.getElementById('selectCustomerInput')?.value.trim() || '';
  if (!inputVal) return null;
  
  // 1. Cek kecocokan dengan member terdaftar
  const matched = customers.find(c => `${c.name} (${c.license_plate || '-'})` === inputVal);
  if (matched && matched.license_plate) {
    return matched.license_plate;
  }
  
  // 2. Smart parsing untuk non-member
  const parenMatch = inputVal.match(/^(.*?)\s*\((.*?)\)$/);
  if (parenMatch) {
    const plate = parenMatch[2].trim();
    if (plate && plate !== '-') return plate;
  }
  
  // Jika format plat nomor (misal: "B 1234 XYZ" atau "b 1234 xyz")
  if (/^[a-zA-Z]{1,2}\s*\d+/.test(inputVal)) {
    return inputVal.toUpperCase();
  }
  
  return null;
}

function checkVehicleHistoryButton() {
  const plate = getPlateFromInput();
  const btn = document.getElementById('btnVehicleHistory');
  if (btn) {
    if (plate) {
      btn.style.display = 'inline-block';
      btn.textContent = `📖 Lihat Rekam Medis (${plate})`;
    } else {
      btn.style.display = 'none';
    }
  }
}

function closeVehicleHistory() {
  document.getElementById('modalVehicleHistory').classList.add('hidden');
}

async function openVehicleHistory() {
  const plate = getPlateFromInput();
  if (!plate) return;

  // Tampilkan modal terlebih dahulu dengan state loading
  const modal = document.getElementById('modalVehicleHistory');
  modal.classList.remove('hidden');

  // Set initial labels
  document.getElementById('vhPlateBadge').textContent = plate;
  document.getElementById('vhCustomerName').textContent = 'Memuat...';
  document.getElementById('vhLastVisit').textContent = 'Memuat...';
  
  document.getElementById('vhServicesCount').textContent = '0';
  document.getElementById('vhServicesTableBody').innerHTML = `
    <tr>
      <td colspan="4" style="padding:16px; text-align:center; color:#94a3b8;">
        <span class="loading-spinner">⏳ Memuat riwayat servis...</span>
      </td>
    </tr>
  `;

  document.getElementById('vhSparepartsCount').textContent = '0';
  document.getElementById('vhSparepartsTableBody').innerHTML = `
    <tr>
      <td colspan="4" style="padding:16px; text-align:center; color:#94a3b8;">
        <span class="loading-spinner">⏳ Memuat riwayat sparepart...</span>
      </td>
    </tr>
  `;

  try {
    const res = await fetch(`${API}/transactions/vehicle/${encodeURIComponent(plate)}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const result = await res.json();
    if (res.ok && result.success) {
      const data = result.data;
      if (!data.transactions || data.transactions.length === 0) {
        // Tampilkan state kosong premium
        document.getElementById('vhCustomerName').textContent = 'Kendaraan Baru (Belum Terdaftar)';
        document.getElementById('vhLastVisit').textContent = 'Belum pernah berkunjung';
        document.getElementById('vhServicesTableBody').innerHTML = `
          <tr>
            <td colspan="4" style="padding:24px; text-align:center; color:#94a3b8; font-weight:500;">
              📭 Belum ada riwayat servis untuk kendaraan ini.
            </td>
          </tr>
        `;
        document.getElementById('vhSparepartsTableBody').innerHTML = `
          <tr>
            <td colspan="4" style="padding:24px; text-align:center; color:#94a3b8; font-weight:500;">
              📭 Belum ada penggantian sparepart untuk kendaraan ini.
            </td>
          </tr>
        `;
        return;
      }

      // Set meta info
      document.getElementById('vhCustomerName').textContent = data.customer_name || 'Pelanggan Umum';
      const lastVisitDate = new Date(data.last_visit);
      document.getElementById('vhLastVisit').textContent = lastVisitDate.toLocaleString('id-ID', {
        day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
      }) + ' WIB';

      // Render Services
      const services = data.services || [];
      document.getElementById('vhServicesCount').textContent = services.length;
      if (services.length > 0) {
        document.getElementById('vhServicesTableBody').innerHTML = services.map(s => {
          const dateStr = new Date(s.created_at).toLocaleDateString('id-ID', {
            day: 'numeric', month: 'short', year: 'numeric'
          });
          return `
            <tr style="border-bottom:1px solid #f1f5f9;">
              <td style="padding:10px; color:#475569; font-weight:500;">${dateStr}</td>
              <td style="padding:10px; color:#1e293b; font-weight:600;">${s.service_name}</td>
              <td style="padding:10px; color:#475569;"><span style="background:#f1f5f9; padding:2px 6px; border-radius:4px; font-size:11px;">👨‍🔧 ${s.mechanic_name}</span></td>
              <td style="padding:10px; text-align:right; color:#0f766e; font-weight:700;">${rupiah(s.price)}</td>
            </tr>
          `;
        }).join('');
      } else {
        document.getElementById('vhServicesTableBody').innerHTML = `
          <tr>
            <td colspan="4" style="padding:16px; text-align:center; color:#94a3b8;">Belum ada tindakan servis</td>
          </tr>
        `;
      }

      // Render Spareparts
      const spareparts = data.spareparts || [];
      document.getElementById('vhSparepartsCount').textContent = spareparts.length;
      if (spareparts.length > 0) {
        document.getElementById('vhSparepartsTableBody').innerHTML = spareparts.map(sp => {
          const dateStr = new Date(sp.created_at).toLocaleDateString('id-ID', {
            day: 'numeric', month: 'short', year: 'numeric'
          });
          return `
            <tr style="border-bottom:1px solid #f1f5f9;">
              <td style="padding:10px; color:#475569; font-weight:500;">${dateStr}</td>
              <td style="padding:10px; color:#1e293b; font-weight:600;">${sp.sparepart_name}</td>
              <td style="padding:10px; text-align:center; color:#1e293b; font-weight:700;"><span style="background:#fff7ed; color:#c2410c; padding:2px 8px; border-radius:12px; font-size:11px; font-weight:800;">${sp.quantity}</span></td>
              <td style="padding:10px; text-align:right; color:#0369a1; font-weight:700;">${rupiah(sp.price)}</td>
            </tr>
          `;
        }).join('');
      } else {
        document.getElementById('vhSparepartsTableBody').innerHTML = `
          <tr>
            <td colspan="4" style="padding:16px; text-align:center; color:#94a3b8;">Belum ada penggantian sparepart</td>
          </tr>
        `;
      }

    } else {
      alert('Gagal mengambil data rekam medis!');
      closeVehicleHistory();
    }
  } catch (err) {
    console.error('Error fetching vehicle history:', err);
    alert('Terjadi kesalahan koneksi ke server!');
    closeVehicleHistory();
  }
}

// Add selectCustomerInput listeners
const selectCustomerInput = document.getElementById('selectCustomerInput');
if (selectCustomerInput) {
  selectCustomerInput.addEventListener('input', checkVehicleHistoryButton);
  selectCustomerInput.addEventListener('change', checkVehicleHistoryButton);
}

// Init
loadData();
selectPayment('cash');
renderCart();

// Auto-load keranjang tersimpan kalau dari halaman keranjang
const pendingCartId = localStorage.getItem('loadCartId');
if (pendingCartId) {
  localStorage.removeItem('loadCartId');
  // Tunggu data sparepart/mekanik selesai load dulu
  setTimeout(() => loadSavedCart(parseInt(pendingCartId)), 1000);
}
