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
let activeSavedCartData = null; // track metadata of the loaded saved cart (license_plate, customer_name, mechanic_id, note)
let adjustCartIndex = null;
let currentPage = 1;

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

    // Restore mechanic from saved state if available
    const saved = localStorage.getItem('active_cart_state');
    if (saved) {
      try {
        const state = JSON.parse(saved);
        if (state.mechanicId) {
          const sel = document.getElementById('selectMechanic');
          if (sel) sel.value = state.mechanicId;
        }
      } catch (e) {}
    }
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

  const keywords = filter.toLowerCase().split(/\s+/).filter(Boolean);

  const filteredSp = spareparts.filter(p => {
    if (keywords.length === 0) return true;
    const searchString = `${p.name} ${p.nama_lain || ''} ${p.code || ''} ${p.brand || ''} ${p.type || ''}`.toLowerCase();
    return keywords.every(kw => searchString.includes(kw));
  });

  const itemsPerPage = 30;
  const totalPages = Math.ceil(filteredSp.length / itemsPerPage) || 1;
  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;

  const startIdx = (currentPage - 1) * itemsPerPage;
  const endIdx = startIdx + itemsPerPage;
  const paginatedSp = filteredSp.slice(startIdx, endIdx);

  if (!filteredSp.length) {
    spGrid.innerHTML = '<div class="empty-state">Tidak ada sparepart</div>';
  } else {    const tableRows = paginatedSp.map((p, idx) => {
      const aliasText = p.nama_lain ? ` (${p.nama_lain})` : '';
      const isOutOfStock = p.stock <= 0;
      const rowClass = isOutOfStock ? 'out-of-stock-row' : '';
      
      const motorType = p.type || '-';
      const brandName = p.brand || '-';
      
      const stockBadgeStyle = isOutOfStock 
        ? 'background: #fdecea; color: #e74c3c; border: 1px solid #fca5a5;' 
        : (p.stock <= 5 ? 'background: #fff8e6; color: #f39c12; border: 1px solid #fde68a;' : 'background: #e8f8f0; color: #27ae60; border: 1px solid #a7f3d0;');
        
      const stockText = isOutOfStock ? 'Habis' : `${p.stock} ${p.unit || 'pcs'}`;
      
      const actionBtnHtml = isOutOfStock
        ? `<button class="btn-add-cart out-of-stock-btn" disabled>Habis</button>`
        : `<button class="btn-add-cart" onclick="addToCartById(${p.id}, 'sparepart')">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Tambah
           </button>`;

      const codeHtml = p.code 
        ? `<span class="code-badge" style="background:#f1f5f9; border:1px solid #cbd5e1; padding:2px 6px; border-radius:4px; font-size:11px;">${escHtml(p.code)}</span>`
        : '<span style="color:#cbd5e1;">-</span>';

      const rackHtml = p.rack_location && p.rack_location !== '-'
        ? `<strong style="color: #0f766e; font-weight: 600;">${escHtml(p.rack_location)}</strong>`
        : '<span style="color:#cbd5e1;">-</span>';

      let brandAndTypeHtml = '';
      if (brandName === '-' && motorType === '-') {
        brandAndTypeHtml = '<span style="color:#cbd5e1;">-</span>';
      } else {
        brandAndTypeHtml = `
          <div style="font-weight: 500; color: #1e293b;">${escHtml(brandName !== '-' ? brandName : '')}</div>
          <div style="font-size: 11px; color: #64748b; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 140px;" title="${escHtml(motorType !== '-' ? motorType : '')}">${escHtml(motorType !== '-' ? motorType : '')}</div>
        `;
      }

      return `
        <tr class="${rowClass}">
          <td style="font-family: monospace; font-weight: 700; color: #475569;">
            ${codeHtml}
          </td>
          <td>
            <div style="font-weight: 600; color: #1e293b; font-size: 13px;">${escHtml(p.name)}</div>
            ${aliasText ? `<div style="font-size: 11px; color: #64748b; font-style: italic; margin-top: 2px;">${escHtml(aliasText)}</div>` : ''}
          </td>
          <td>${rackHtml}</td>
          <td>
            ${brandAndTypeHtml}
          </td>
          <td style="font-weight: 700; color: #e87722; text-align: right; white-space: nowrap;">${rupiah(p.price)}</td>
          <td style="text-align: center;">
            <span class="badge" style="${stockBadgeStyle} display: inline-block; font-size: 11px; font-weight: 700; border-radius: 6px; padding: 4px 8px; white-space: nowrap;">
              ${stockText}
            </span>
          </td>
          <td style="text-align: center;" onclick="event.stopPropagation();">
            ${actionBtnHtml}
          </td>
        </tr>
      `;
    }).join('');

    spGrid.innerHTML = `
      <div class="pos-table-wrap">
        <table class="pos-table">
          <thead>
            <tr>
              <th style="width: 90px;">Kode</th>
              <th>Nama Sparepart</th>
              <th style="width: 50px;">Rak</th>
              <th style="width: 130px;">Merk & Tipe Motor</th>
              <th style="text-align: right; width: 105px;">Harga</th>
              <th style="text-align: center; width: 75px;">Stok</th>
              <th style="text-align: center; width: 85px;">Aksi</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
      </div>
      <div class="pos-pagination" style="display: flex; justify-content: space-between; align-items: center; margin-top: 12px; background: #fff; padding: 8px 16px; border-radius: 8px; border: 1px solid #e2e8f0; font-size: 12px; flex-shrink: 0;">
        <span style="color: #64748b; font-weight: 500;">Menampilkan ${startIdx + 1}-${Math.min(endIdx, filteredSp.length)} dari ${filteredSp.length} item</span>
        <div style="display: flex; gap: 6px;">
          <button class="pos-pag-btn" onclick="changePosPage(-1)" ${currentPage === 1 ? 'disabled' : ''} style="padding: 6px 12px; background: #fff; border: 1.5px solid #cbd5e1; border-radius: 6px; font-weight: 600; color: #475569; cursor: pointer;">Sebelumnya</button>
          <span style="align-self: center; font-weight: 700; color: #1e293b; padding: 0 4px;">Halaman ${currentPage} / ${totalPages}</span>
          <button class="pos-pag-btn" onclick="changePosPage(1)" ${currentPage === totalPages ? 'disabled' : ''} style="padding: 6px 12px; background: #fff; border: 1.5px solid #cbd5e1; border-radius: 6px; font-weight: 600; color: #475569; cursor: pointer;">Berikutnya</button>
        </div>
      </div>
    `;
  }

  const filteredSv = services.filter(s => {
    if (keywords.length === 0) return true;
    const searchString = s.name.toLowerCase();
    return keywords.every(kw => searchString.includes(kw));
  });

  svGrid.innerHTML = filteredSv.length ? filteredSv.map(s => `
    <div class="product-card" onclick="addToCartById(${s.id}, 'servis')">
      <div class="product-name">${s.name}</div>
      <div class="product-price">${rupiah(s.price)}</div>
      <div class="product-type">Servis</div>
    </div>
  `).join('') : '<div class="empty-state">Tidak ada servis</div>';
}

function changePosPage(delta) {
  currentPage += delta;
  renderProducts(document.getElementById('barcodeInput')?.value || '');
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
  let searchTimeout;
  barcodeInput.addEventListener('input', () => {
    currentPage = 1;
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      renderProducts(barcodeInput.value);
    }, 250);
  });
}

// Add to cart
function addToCartById(id, type) {
  if (type === 'sparepart') {
    const item = spareparts.find(p => p.id === id);
    if (!item) return false;
    if (item.stock <= 0) {
      alert(`Stok ${item.name} habis!`);
      return false;
    }
    const existing = cart.find(c => c.id === id && c.type === 'sparepart');
    if (existing) {
      if (existing.qty >= item.stock) {
        alert('Stok tidak mencukupi!');
        return false;
      }
      existing.qty++;
    } else {
      cart.push({ id, type: 'sparepart', name: item.name, code: item.code || '-', brand: item.brand || '', price: item.price, qty: 1, maxQty: item.stock, unit: item.unit || 'pcs' });
    }
  } else {
    const item = services.find(s => s.id === id);
    if (!item) return false;
    const existing = cart.find(c => c.id === id && c.type === 'servis');
    if (existing) return false; // servis tidak duplikat
    cart.push({ id, type: 'servis', name: item.name, code: '-', price: item.price, qty: 1, mechanic_id: null, unit: '' });
  }
  renderCart();
  return true;
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
  const posMetaGrid = document.getElementById('posMetaGrid');
  const hasServis = cart.some(c => c.type === 'servis');

  if (mechanicRow) mechanicRow.classList.toggle('hidden', !hasServis);
  if (posMetaGrid) posMetaGrid.classList.toggle('has-mechanic', hasServis);

  const cartCountEl = document.getElementById('cartCount');
  if (cartCountEl) cartCountEl.textContent = `${cart.length} item`;

  if (!cart.length) {
    cartList.innerHTML = '<div class="empty-cart">Belum ada item</div>';
    updateTotals();
    if (typeof saveActiveCartState === 'function') {
      saveActiveCartState();
    }
    return;
  }

  cartList.innerHTML = cart.map((item, idx) => {
    const dbItem = !item.is_manual && item.type === 'sparepart'
      ? spareparts.find(p => p.id === item.id)
      : (item.type === 'servis' ? services.find(s => s.id === item.id) : null);
    const dbPrice = dbItem ? Number(dbItem.price) : Number(item.price);
    const isCustom = !item.is_manual && Number(item.price) !== dbPrice;
    
    let cartItemDetails = '';
    if (item.type === 'sparepart') {
      const detailParts = [];
      if (dbItem) {
        if (dbItem.brand && dbItem.brand.toLowerCase() !== 'luar' && dbItem.brand.toLowerCase() !== 'lainnya') detailParts.push(dbItem.brand);
        if (dbItem.type && dbItem.type.toLowerCase() !== 'luar' && dbItem.type.toLowerCase() !== 'lainnya') detailParts.push(dbItem.type);
      } else {
        if (item.brand && item.brand.toLowerCase() !== 'luar' && item.brand.toLowerCase() !== 'lainnya') detailParts.push(item.brand);
      }
      if (detailParts.length) {
        cartItemDetails = ` · ${detailParts.join(' - ')}`;
      }
    }
    
    let badgeHtml = '';
    if (item.is_manual) {
      if (item.code === 'Lainnya') {
        badgeHtml = `<span class="badge-custom-price" style="background:#f3e8ff; color:#6b21a8; font-size:9px; font-weight:700; padding:1px 5px; border-radius:4px; margin-left:6px; vertical-align:middle; border:1px solid #e9d5ff; display:inline-block; line-height:1.2;">Lainnya</span>`;
      } else {
        badgeHtml = `<span class="badge-custom-price" style="background:#e0f2fe; color:#0369a1; font-size:9px; font-weight:700; padding:1px 5px; border-radius:4px; margin-left:6px; vertical-align:middle; border:1px solid #bae6fd; display:inline-block; line-height:1.2;">Produk Luar</span>`;
      }
    } else if (isCustom) {
      badgeHtml = `<span class="badge-custom-price" style="background:#ffe4e6; color:#b91c1c; font-size:9px; font-weight:700; padding:1px 5px; border-radius:4px; margin-left:6px; vertical-align:middle; border:1px solid #fecdd3; display:inline-block; line-height:1.2;">Manual</span>`;
    }

    return `
      <div class="cart-item">
        <!-- Col 1: Info (Nama & Subtitle Jasa/Part + Harga Satuan) -->
        <div class="cart-col-info">
          <span class="cart-item-name" title="${escHtml(item.name)}">${escHtml(item.name)}</span>
          <span class="cart-item-sub">${item.type === 'servis' ? 'Servis' : 'Part'}${escHtml(cartItemDetails)} · ${rupiah(item.price)} <button type="button" onclick="openAdjustPriceModal(${idx})" title="Edit Harga" style="background:none; border:none; color:#e87722; cursor:pointer; font-size:11px; padding:0 2px; display:inline; vertical-align:middle; line-height:1;">✏️</button>${badgeHtml}</span>
        </div>
        
        <!-- Col 2: Kontrol Qty -->
        <div class="cart-col-qty">
          <button class="qty-btn" onclick="changeQty(${idx}, -1)">−</button>
          <span class="qty-val">${item.qty} ${item.type === 'sparepart' ? (item.unit || 'pcs') : ''}</span>
          <button class="qty-btn" onclick="changeQty(${idx}, 1)">+</button>
        </div>
        
        <!-- Col 3: Total Harga -->
        <div class="cart-col-price">
          ${rupiah(item.price * item.qty)}
        </div>
        
        <!-- Col 4: Hapus Item -->
        <div class="cart-col-del">
          <button class="btn-remove" onclick="removeFromCart(${idx})" title="Hapus Item">✕</button>
        </div>
      </div>
    `;
  }).join('');

  updateTotals();
  if (typeof saveActiveCartState === 'function') {
    saveActiveCartState();
  }
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
  } else {
    document.getElementById('discountRow').style.display = 'none';
  }
  document.getElementById('totalDisplay').textContent = rupiah(total);
  updateChange();
  renderPaymentDetails(); // Sync QRIS/Transfer card amounts instantly
}

// Mechanic select
function renderMechanicSelect() {
  const sel = document.getElementById('selectMechanic');
  if (sel) {
    sel.innerHTML = '<option value="">-- Pilih Mekanik --</option>' +
      mechanics.map(m => `<option value="${m.id}">${m.name}</option>`).join('');
  }
  const helperSel = document.getElementById('selectHelper');
  if (helperSel) {
    helperSel.innerHTML = '<option value="">-- Tanpa Helper --</option>' +
      mechanics.map(m => `<option value="${m.id}">${m.name}</option>`).join('');
  }
}

function toggleHelperCommissionInput() {
  const helperSel = document.getElementById('selectHelper');
  const container = document.getElementById('helperCommContainer');
  const input = document.getElementById('helperCommissionInput');
  if (helperSel && container) {
    const hasHelper = helperSel.value !== '';
    container.classList.toggle('hidden', !hasHelper);
    if (!hasHelper && input) {
      input.value = '';
    }
  }
}

function formatHelperPriceInput(input) {
  const raw = input.value.replace(/\D/g, '');
  input.value = raw ? Number(raw).toLocaleString('id-ID') : '';
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
  const qrisInput = document.getElementById('qrisInput');
  const transferInput = document.getElementById('transferInput');
  
  if (cashInput) cashInput.classList.toggle('hidden', method !== 'cash');
  if (qrisInput) qrisInput.classList.toggle('hidden', method !== 'qris');
  if (transferInput) transferInput.classList.toggle('hidden', method !== 'transfer');
  
  updateChange();
  renderPaymentDetails();
  if (typeof saveActiveCartState === 'function') {
    saveActiveCartState();
  }
}

// Copy to clipboard helper
function copyToClipboard(elementId) {
  const text = document.getElementById(elementId).textContent;
  navigator.clipboard.writeText(text);
  alert('✅ Nomor rekening berhasil disalin!');
}

// Render dynamic QRIS and Bank Transfer Details
function renderPaymentDetails() {
  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const discountPct = parseFloat(document.getElementById('discountInput')?.value || 0);
  const total = subtotal - Math.round(subtotal * discountPct / 100);
  const formattedTotal = rupiah(total);
  
  // Update total displays in inputs
  const qrisTotal = document.getElementById('qrisTotalDisplay');
  const transferTotal = document.getElementById('transferTotalDisplay');
  if (qrisTotal) qrisTotal.textContent = formattedTotal;
  if (transferTotal) transferTotal.textContent = formattedTotal;
  
  const cfg = getReceiptSettings();
  
  // 1. QRIS QR Code Generator
  const qrisQrImg = document.getElementById('qrisQrCode');
  if (qrisQrImg) {
    if (cfg.qrisUrl) {
      qrisQrImg.src = cfg.qrisUrl;
    } else {
      // Generate clean QR code based on total amount
      const qrData = `MOTODOCT_TOTAL_${total}`;
      qrisQrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(qrData)}`;
    }
  }
  
  // 2. Bank Transfer Info
  const elBank = document.getElementById('transferBankName');
  const elAccNum = document.getElementById('transferAccountNum');
  const elOwner = document.getElementById('transferAccountOwner');
  
  if (elBank) elBank.textContent = cfg.bankName || 'BCA';
  if (elAccNum) elAccNum.textContent = cfg.bankAccount || '123-456-7890';
  if (elOwner) elOwner.textContent = cfg.bankOwner || 'BENGKEL MOTODOCT';
}

// Format input uang dengan titik ribuan
function formatCashInput(input) {
  // Ambil hanya angka
  const raw = input.value.replace(/\D/g, '');
  // Format dengan titik ribuan
  input.value = raw ? Number(raw).toLocaleString('id-ID') : '';
  updateChange();
  if (typeof saveActiveCartState === 'function') {
    saveActiveCartState();
  }
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
    .map(c => ({
      sparepart_id: c.is_manual ? null : c.id,
      quantity: c.qty,
      price: c.price,
      is_manual: c.is_manual || false,
      name: c.name,
      buy_price: c.buy_price || 0,
      brand: c.brand || 'Luar'
    }));

  const helperMechId = document.getElementById('selectHelper')?.value || null;
  const rawHelperComm = document.getElementById('helperCommissionInput')?.value.replace(/\./g, '') || '0';
  const helperComm = parseFloat(rawHelperComm) || 0;

  const servicesPayload = cart
    .filter(c => c.type === 'servis')
    .map((c, idx) => ({
      service_id: c.id,
      mechanic_id: parseInt(mechanicId),
      price: c.price,
      helper_mechanic_id: idx === 0 && helperMechId ? parseInt(helperMechId) : null,
      helper_commission: idx === 0 && helperMechId ? helperComm : 0
    }));

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
    if (typeof saveActiveCartState === 'function') {
      saveActiveCartState();
    }

  } catch {
    errEl.textContent = 'Tidak bisa terhubung ke server!';
    errEl.style.display = 'block';
  }
}

function formatAdjustPriceInput(input) {
  const raw = input.value.replace(/\D/g, '');
  input.value = raw ? Number(raw).toLocaleString('id-ID') : '';
}

function openAdjustPriceModal(idx) {
  const item = cart[idx];
  if (!item) return;
  adjustCartIndex = idx;
  document.getElementById('adjustItemName').textContent = item.name;
  document.getElementById('adjustCurrentPrice').textContent = rupiah(item.price);
  document.getElementById('adjustNewPrice').value = Number(item.price || 0).toLocaleString('id-ID');
  document.getElementById('adjustPassword').value = '';
  document.getElementById('adjustPriceError').style.display = 'none';

  const btnSave = document.getElementById('btnSaveAdjustPrice');
  if (btnSave) {
    btnSave.disabled = false;
    btnSave.textContent = 'Simpan Harga';
  }

  document.getElementById('modalAdjustPrice').classList.remove('hidden');
  setTimeout(() => document.getElementById('adjustPassword').focus(), 100);
}

function closeAdjustPriceModal() {
  document.getElementById('modalAdjustPrice').classList.add('hidden');
  adjustCartIndex = null;
}

async function applyManualPrice() {
  if (adjustCartIndex === null) return;
  const rawPrice = document.getElementById('adjustNewPrice').value.replace(/\./g, '').replace(',', '.');
  const newPrice = parseFloat(rawPrice);
  const password = document.getElementById('adjustPassword').value;
  const errEl = document.getElementById('adjustPriceError');

  if (isNaN(newPrice) || newPrice < 0) {
    errEl.textContent = 'Harga baru tidak valid!';
    errEl.style.display = 'block';
    return;
  }
  if (!password) {
    errEl.textContent = 'Password verifikasi wajib diisi!';
    errEl.style.display = 'block';
    return;
  }

  const btnSave = document.getElementById('btnSaveAdjustPrice');
  if (btnSave) {
    btnSave.disabled = true;
    btnSave.textContent = 'Memverifikasi...';
  }

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
      if (btnSave) {
        btnSave.disabled = false;
        btnSave.textContent = 'Simpan Harga';
      }
      return;
    }

    // Update price in cart
    cart[adjustCartIndex].price = newPrice;
    closeAdjustPriceModal();
    renderCart();
  } catch (err) {
    errEl.textContent = 'Tidak bisa terhubung ke server!';
    errEl.style.display = 'block';
    if (btnSave) {
      btnSave.disabled = false;
      btnSave.textContent = 'Simpan Harga';
    }
  }
}

function clearCart() {
  cart = [];
  activeSavedCartId = null;
  activeSavedCartData = null;
  if (document.getElementById('cashReceived')) document.getElementById('cashReceived').value = '';
  if (document.getElementById('discountInput')) document.getElementById('discountInput').value = '';
  if (document.getElementById('discountRow')) document.getElementById('discountRow').style.display = 'none';
  if (document.getElementById('selectCustomerInput')) document.getElementById('selectCustomerInput').value = '';
  if (document.getElementById('selectHelper')) document.getElementById('selectHelper').value = '';
  if (document.getElementById('helperCommissionInput')) document.getElementById('helperCommissionInput').value = '';
  if (document.getElementById('helperCommContainer')) document.getElementById('helperCommContainer').classList.add('hidden');
  renderCart();
  selectPayment('cash');
}

// ===== RECEIPT & PAYMENT SETTINGS =====
const DEFAULT_RECEIPT_SETTINGS = {
  shopName: 'MOTODOCT',
  shopSlogan: 'Bengkel Motor Terpercaya',
  shopWA: '',
  shopIG: '',
  shopFooter: 'Terima kasih atas kunjungan Anda!',
  bankName: 'BCA',
  bankAccount: '123-456-7890',
  bankOwner: 'BENGKEL MOTODOCT',
  qrisUrl: ''
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
  
  // Load bank settings
  document.getElementById('cfgBankName').value = cfg.bankName || 'BCA';
  document.getElementById('cfgBankAccount').value = cfg.bankAccount || '123-456-7890';
  document.getElementById('cfgBankOwner').value = cfg.bankOwner || 'BENGKEL MOTODOCT';
  document.getElementById('cfgQrisUrl').value = cfg.qrisUrl || '';
  
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
    shopFooter: document.getElementById('cfgShopFooter').value.trim() || 'Terima kasih atas kunjungan Anda!',
    
    // Save bank settings
    bankName: document.getElementById('cfgBankName').value.trim().toUpperCase() || 'BCA',
    bankAccount: document.getElementById('cfgBankAccount').value.trim() || '123-456-7890',
    bankOwner: document.getElementById('cfgBankOwner').value.trim().toUpperCase() || 'BENGKEL MOTODOCT',
    qrisUrl: document.getElementById('cfgQrisUrl').value.trim()
  };
  localStorage.setItem('receipt_settings', JSON.stringify(cfg));
  closeReceiptSettings();
  renderPaymentDetails(); // Refresh payment cards instantly
  alert('✅ Pengaturan struk & pembayaran berhasil disimpan!');
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

  const custVal = document.getElementById('selectCustomerInput')?.value.trim() || '';
  let custName = 'Umum';
  let custPlate = '-';
  
  if (custVal) {
    const matched = custVal.match(/^(.*?)\s*\((.*?)\)$/);
    if (matched) {
      custName = matched[1].trim();
      custPlate = matched[2].trim();
    } else {
      if (/^[a-zA-Z]{1,2}\s*\d+/.test(custVal)) {
        custPlate = custVal.toUpperCase();
      } else {
        custName = custVal;
      }
    }
  }

  const mechId = document.getElementById('selectMechanic')?.value;
  let mechName = '';
  if (mechId) {
    const foundM = mechanics.find(m => m.id == mechId);
    if (foundM) mechName = foundM.name;
  }

  const isLong = cart.length > 5;
  const minRows = isLong ? 0 : 5;
  const containerHeightCss = isLong 
    ? `height: auto;` 
    : `height: 380px;`;
  const printHeightCss = isLong 
    ? `height: auto !important; min-height: auto !important; display: block !important;` 
    : `height: 12.0cm !important; min-height: 12.0cm !important; display: flex !important;`;

  let rowsHtml = '';
  cart.forEach((i, idx) => {
    const typeLabel = i.type === 'servis' ? ' (Servis)' : '';
    const itemCode = i.code || '-';
    rowsHtml += `
    <tr style="font-family:'Courier New', Courier, monospace; height: 22px;">
      <td style="padding: 1px 0; text-align: center; vertical-align: top; border-bottom: 1px dashed #000;">${idx + 1}</td>
      <td style="padding: 1px 4px; text-align: left; vertical-align: top; border-bottom: 1px dashed #000; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 120px;" title="${escHtml(itemCode)}">${escHtml(itemCode)}</td>
      <td style="padding: 1px 4px; text-align: left; vertical-align: top; border-bottom: 1px dashed #000; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 250px;" title="${escHtml(i.name)}${typeLabel}">${escHtml(i.name)}${typeLabel}</td>
      <td style="padding: 1px 4px; text-align: left; vertical-align: top; border-bottom: 1px dashed #000;">${escHtml(i.brand || '-')}</td>
      <td style="padding: 1px 4px; text-align: center; vertical-align: top; border-bottom: 1px dashed #000;">${i.qty} ${i.type === 'sparepart' ? (i.unit || 'pcs') : ''}</td>
      <td style="padding: 1px 4px; text-align: right; vertical-align: top; border-bottom: 1px dashed #000; white-space: nowrap;">${rupiah(i.price)}</td>
      <td style="padding: 1px 0; text-align: right; vertical-align: top; border-bottom: 1px dashed #000; white-space: nowrap;">${rupiah(i.price * i.qty)}</td>
    </tr>
    `;
  });
  for (let idx = cart.length; idx < minRows; idx++) {
    rowsHtml += `
    <tr style="font-family:'Courier New', Courier, monospace; height: 22px;">
      <td style="padding: 1px 0; text-align: center; border-bottom: 1px dashed #000;">&nbsp;</td>
      <td style="border-bottom: 1px dashed #000;">&nbsp;</td>
      <td style="border-bottom: 1px dashed #000;">&nbsp;</td>
      <td style="border-bottom: 1px dashed #000;">&nbsp;</td>
      <td style="border-bottom: 1px dashed #000;">&nbsp;</td>
      <td style="border-bottom: 1px dashed #000;">&nbsp;</td>
      <td style="border-bottom: 1px dashed #000;">&nbsp;</td>
    </tr>
    `;
  }

  const discountPct = subtotal > 0 ? Math.round((discountAmt / subtotal) * 100) : 0;

  let contactHtml = '';
  if (cfg.shopWA) contactHtml += `WA: ${escHtml(cfg.shopWA)} `;
  if (cfg.shopIG) contactHtml += `IG: ${escHtml(cfg.shopIG)}`;
  if (contactHtml) contactHtml = `<div style="font-size: 11px; margin-bottom: 2px;">${contactHtml}</div>`;

  document.getElementById('strukContent').innerHTML = `
    <style>
      .receipt-container {
        font-family: 'Courier New', Courier, monospace;
        font-weight: bold;
        color: #000;
        font-size: 13px;
        line-height: 1.3;
        box-sizing: border-box;
        width: 770px;
        max-width: 100%;
        ${containerHeightCss}
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        background: #fff;
        padding: 8px 12px;
        margin: 5px auto;
        border: 1px solid #ccc;
        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      }
      @page {
        size: auto;
        margin: 0.6cm 1.2cm 0 1.2cm;
      }
      @media print {
        body {
          width: 24.1cm !important;
        }
        .receipt-container {
          width: 20.5cm !important;
          ${printHeightCss}
          margin: 0 !important;
          border: none !important;
          box-shadow: none !important;
          page-break-after: always !important;
          break-after: page !important;
          padding: 2mm 0 !important;
          box-sizing: border-box !important;
          display: flex !important;
          flex-direction: column !important;
          justify-content: space-between !important;
        }
        tr {
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }
        .bottom-section-container {
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }
      }
    </style>
    
    <div class="receipt-container">
      <div>
        <!-- Header (Logo on Left, Metadata on Right) -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 4px;">
          <tr>
            <!-- Left side: Shop Logo Box & Slogan -->
            <td style="width: 50%; vertical-align: top;">
              <div style="border: 2px solid #000; padding: 2px 8px; display: inline-block; font-weight: bold; font-size: 19px; letter-spacing: 1px; text-transform: uppercase;">
                ${escHtml(cfg.shopName)}
              </div>
              <div style="font-size: 11px; margin-top: 2px; line-height: 1.1;">
                ${escHtml(cfg.shopSlogan)}<br>
                ${contactHtml}
              </div>
            </td>
            <!-- Right side: Metadata Grid -->
            <td style="width: 50%; vertical-align: top;">
              <table style="font-size: 12px; font-family: 'Courier New', Courier, monospace; border-collapse: collapse; margin-left: auto; text-align: left;">
                <tr>
                  <td style="padding: 1px 0; width: 95px; font-weight: bold;">NO. FAKTUR</td>
                  <td style="padding: 1px 4px; font-weight: bold;">:</td>
                  <td style="padding: 1px 0; font-weight: bold;">${trxData.invoice_number}</td>
                </tr>
                <tr>
                  <td style="padding: 1px 0;">TANGGAL</td>
                  <td style="padding: 1px 4px;">:</td>
                  <td style="padding: 1px 0;">${now.toLocaleDateString('id-ID')} WIB</td>
                </tr>
                <tr>
                  <td style="padding: 1px 0;">KEPADA YTH</td>
                  <td style="padding: 1px 4px;">:</td>
                  <td style="padding: 1px 0; font-weight: bold; text-transform: uppercase;">${escHtml(custName)} (${escHtml(custPlate)})</td>
                </tr>
                <tr>
                  <td style="padding: 1px 0;">MEKANIK</td>
                  <td style="padding: 1px 4px;">:</td>
                  <td style="padding: 1px 0; text-transform: uppercase;">${escHtml(mechName || '-')}</td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
        
        <!-- Table of items -->
        <table style="width: 100%; font-size: 13px; font-family: 'Courier New', Courier, monospace; border-collapse: collapse; margin-top: 4px;">
          <thead>
            <tr style="border-top: 1px solid #000; border-bottom: 1px solid #000; font-weight: bold;">
              <th style="padding: 3px 0; text-align: center; width: 4%;">No</th>
              <th style="padding: 3px 4px; text-align: left; width: 16%;">No Part Number</th>
              <th style="padding: 3px 4px; text-align: left; width: 36%;">Nama Barang / Layanan</th>
              <th style="padding: 3px 4px; text-align: left; width: 6%;">Merek</th>
              <th style="padding: 3px 4px; text-align: center; width: 12%;">Qty</th>
              <th style="padding: 3px 4px; text-align: right; width: 13%;">Harga</th>
              <th style="padding: 3px 0; text-align: right; width: 13%;">Jlh Harga</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>
      
      <div class="bottom-section-container">
        <!-- Solid line separating table from bottom -->
        <div style="border-top: 1px solid #000; margin-top: 2px; margin-bottom: 6px;"></div>
        
        <!-- Bottom Section -->
        <table style="width: 100%; font-family: 'Courier New', Courier, monospace; font-size: 13px; border-collapse: collapse;">
          <tr>
            <!-- Bottom Left: Signatures & Retur Box -->
            <td style="width: 55%; vertical-align: top; padding-right: 20px;">
              <table style="width: 100%; text-align: center; border-collapse: collapse; font-size: 11px;">
                <tr>
                  <td style="width: 50%; padding-bottom: 20px;">DICEK OLEH,</td>
                  <td style="width: 50%; padding-bottom: 20px;">DITERIMA OLEH,</td>
                </tr>
                <tr>
                  <td>( ______________ )</td>
                  <td>( ______________ )</td>
                </tr>
              </table>
              
              <!-- Retur Box -->
              <div style="border: 1px solid #000; padding: 3px; margin-top: 6px; font-size: 10px; line-height: 1.1; text-align: center; font-style: italic;">
                Barang2 AHM / HGP / ASLI yang sudah dibeli<br>tidak dapat di-RETUR. THANKS
              </div>
            </td>
            
            <!-- Bottom Right: Calculations -->
            <td style="width: 45%; vertical-align: top;">
              <table style="width: 100%; border-collapse: collapse; font-size: 13px; text-align: left;">
                <tr>
                  <td style="padding: 1px 0;">Subtotal</td>
                  <td style="padding: 1px 0; text-align: right;">${rupiah(subtotal)}</td>
                </tr>
                ${discountAmt > 0 ? `
                <tr>
                  <td style="padding: 1px 0;">Diskon (${discountPct}%)</td>
                  <td style="padding: 1px 0; text-align: right;">- ${rupiah(discountAmt)}</td>
                </tr>` : ''}
                <tr style="font-weight: bold; border-top: 1px solid #000; border-bottom: 1px solid #000;">
                  <td style="padding: 3px 0;">TOTAL AKHIR</td>
                  <td style="padding: 3px 0; text-align: right; font-size: 15px;">${rupiah(total)}</td>
                </tr>
                ${paymentMethod === 'cash' ? `
                <tr>
                  <td style="padding: 1px 0;">Bayar (Tunai)</td>
                  <td style="padding: 1px 0; text-align: right;">${rupiah(cash)}</td>
                </tr>
                <tr>
                  <td style="padding: 1px 0;">Kembalian</td>
                  <td style="padding: 1px 0; text-align: right;">${rupiah(change)}</td>
                </tr>` : `
                <tr>
                  <td style="padding: 1px 0;">Metode</td>
                  <td style="padding: 1px 0; text-align: right; text-transform: uppercase;">${paymentMethod}</td>
                </tr>`}
              </table>
            </td>
          </tr>
        </table>
        
        <!-- Footer Slogan -->
        <div style="text-align: center; font-size: 11px; margin-top: 4px; font-style: italic; border-top: 1px dashed #000; padding-top: 2px;">
          ${escHtml(cfg.shopFooter)}
        </div>
      </div>
    </div>
  `;

  document.getElementById('modalStruk').classList.remove('hidden');
}

function closeStruk() {
  document.getElementById('modalStruk').classList.add('hidden');
}

function printStruk() {
  const content = document.getElementById('strukContent').innerHTML;
  const win = window.open('', '_blank', 'width=800,height=600');
  win.document.write(`
    <html>
      <head>
        <title>Invoice Motodoct - Print</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            background: #fff;
            color: #000;
            margin: 0;
            padding: 0;
          }
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

function getCurrentCustomerInfo() {
  const val = document.getElementById('selectCustomerInput')?.value.trim() || '';
  let name = '';
  let plate = '';
  if (val) {
    const matched = customers.find(c => `${c.name} (${c.license_plate || '-'})` === val);
    if (matched) {
      name = matched.name;
      plate = matched.license_plate || '';
    } else {
      const parenMatch = val.match(/^(.*?)\s*\((.*?)\)$/);
      if (parenMatch) {
        name = parenMatch[1].trim();
        plate = parenMatch[2].trim();
        if (plate === '-') plate = '';
      } else {
        if (/^[a-zA-Z]{1,2}\s*\d+/.test(val)) {
          plate = val.toUpperCase();
        } else {
          name = val;
        }
      }
    }
  }
  return { name, plate };
}

function openSaveCartModal() {
  if (!cart.length) { alert('Keranjang kosong!'); return; }
  
  const uiCust = getCurrentCustomerInfo();
  const mainMechanic = document.getElementById('selectMechanic')?.value || '';
  
  const hasSavedData = activeSavedCartId && activeSavedCartData;
  
  // Pre-fill values based on active UI state, falling back to loaded saved cart metadata
  const plateValue = uiCust.plate || (hasSavedData ? (activeSavedCartData.license_plate || '') : '');
  const customerValue = uiCust.name || (hasSavedData ? (activeSavedCartData.customer_name || '') : '');
  const noteValue = hasSavedData ? (activeSavedCartData.note || '') : '';
  const mechanicValue = mainMechanic || (hasSavedData ? (activeSavedCartData.mechanic_id || '') : '');

  document.getElementById('savePlate').value = plateValue;
  document.getElementById('saveCustomer').value = customerValue;
  document.getElementById('saveNote').value = noteValue;

  // Isi dropdown mekanik
  const sel = document.getElementById('saveMechanic');
  sel.innerHTML = '<option value="">-- Pilih Mekanik --</option>' +
    mechanics.map(m => `<option value="${m.id}">${m.name}</option>`).join('');

  sel.value = mechanicValue;

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
  const customer_name = document.getElementById('saveCustomer').value.trim() || null;
  const note = document.getElementById('saveNote').value.trim() || null;

  try {
    const url = activeSavedCartId ? `${API}/saved-carts/${activeSavedCartId}` : `${API}/saved-carts`;
    const method = activeSavedCartId ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        license_plate: plate,
        customer_name: customer_name,
        cart_data: cart,
        mechanic_id: mechanic_id ? parseInt(mechanic_id) : null,
        note: note,
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
  } catch (err) {
    console.error(err);
    alert('Tidak bisa terhubung ke server!');
  }
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
    activeSavedCartData = {
      license_plate: saved.license_plate,
      customer_name: saved.customer_name,
      mechanic_id: saved.mechanic_id,
      note: saved.note
    };

    // Set mekanik kalau ada
    if (saved.mechanic_id) {
      const sel = document.getElementById('selectMechanic');
      if (sel) sel.value = saved.mechanic_id;
    }

    // Auto-match plat nomor ke pelanggan terdaftar atau non-member
    if (saved.license_plate) {
      const cleanedPlate = saved.license_plate.replace(/\s+/g, '').toUpperCase();
      const matchedCust = customers.find(c => (c.license_plate || '').replace(/\s+/g, '').toUpperCase() === cleanedPlate);
      const custInput = document.getElementById('selectCustomerInput');
      if (custInput) {
        if (matchedCust) {
          custInput.value = `${matchedCust.name} (${matchedCust.license_plate || '-'})`;
        } else if (saved.customer_name) {
          custInput.value = `${saved.customer_name} (${saved.license_plate})`;
        } else {
          custInput.value = saved.license_plate;
        }
      }
    } else if (saved.customer_name) {
      const custInput = document.getElementById('selectCustomerInput');
      if (custInput) custInput.value = saved.customer_name;
    }

    renderCart();
    loadSavedCarts();
    alert(`✅ Keranjang ${saved.license_plate} dimuat!`);
    if (typeof checkVehicleHistoryButton === 'function') checkVehicleHistoryButton();
  } catch (err) {
    console.error(err);
    alert('Gagal memuat keranjang!');
  }
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
      btn.textContent = `Rekam Medis (${plate})`;
      btn.title = `Lihat Rekam Medis untuk kendaraan ${plate}`;
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
              <td style="padding:10px; text-align:center; color:#1e293b; font-weight:700;"><span style="background:#fff7ed; color:#c2410c; padding:2px 8px; border-radius:12px; font-size:11px; font-weight:800;">${sp.quantity} ${sp.sparepart_unit || 'pcs'}</span></td>
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
  selectCustomerInput.addEventListener('input', () => {
    checkVehicleHistoryButton();
    if (typeof saveActiveCartState === 'function') saveActiveCartState();
  });
  selectCustomerInput.addEventListener('change', () => {
    checkVehicleHistoryButton();
    if (typeof saveActiveCartState === 'function') saveActiveCartState();
  });
}

const selectMechanicInput = document.getElementById('selectMechanic');
if (selectMechanicInput) {
  selectMechanicInput.addEventListener('change', () => {
    if (typeof saveActiveCartState === 'function') saveActiveCartState();
  });
}

if (typeof loadActiveCartState === 'function') {
  loadActiveCartState();
}
loadData();
if (!localStorage.getItem('active_cart_state')) {
  selectPayment('cash');
}
renderCart();

// Auto-load keranjang tersimpan kalau dari halaman keranjang
const pendingCartId = localStorage.getItem('loadCartId');
if (pendingCartId) {
  localStorage.removeItem('loadCartId');
  // Tunggu data sparepart/mekanik selesai load dulu
  setTimeout(() => loadSavedCart(parseInt(pendingCartId)), 1000);
}

// ===== RECEIPT & PAYMENT SETTINGS END =====

// ===== PRICE CHECK (CEK HARGA) LOGIC =====
function openPriceCheck() {
  const modal = document.getElementById('modalPriceCheck');
  if (modal) {
    modal.classList.remove('hidden');
    const input = document.getElementById('priceCheckInput');
    if (input) {
      input.value = '';
      setTimeout(() => input.focus(), 100);
    }
    clearPriceCheckInput();
  }
}

function closePriceCheck() {
  const modal = document.getElementById('modalPriceCheck');
  if (modal) modal.classList.add('hidden');
}

function clearPriceCheckInput() {
  const input = document.getElementById('priceCheckInput');
  if (input) {
    input.value = '';
    input.focus();
  }
  const resultArea = document.getElementById('priceCheckResult');
  if (resultArea) {
    resultArea.innerHTML = '<div style="text-align: center; padding: 30px 10px; color: #aaa; font-size: 13px;">Ketik nama barang atau scan kode di atas...</div>';
  }
}

function handlePriceCheckSearch() {
  const query = document.getElementById('priceCheckInput').value.trim().toLowerCase();
  const resultArea = document.getElementById('priceCheckResult');
  
  if (!query) {
    resultArea.innerHTML = '<div style="text-align: center; padding: 30px 10px; color: #aaa; font-size: 13px;">Ketik nama barang atau scan kode di atas...</div>';
    return;
  }
  
  // Search in spareparts
  const matchedSp = spareparts.filter(sp => 
    sp.name.toLowerCase().includes(query) || 
    (sp.nama_lain || '').toLowerCase().includes(query) || 
    (sp.code || '').toLowerCase().includes(query) ||
    (sp.brand || '').toLowerCase().includes(query)
  );
  
  // Search in services
  const matchedSv = services.filter(sv => 
    sv.name.toLowerCase().includes(query)
  );
  
  if (matchedSp.length === 0 && matchedSv.length === 0) {
    resultArea.innerHTML = '<div style="text-align: center; padding: 30px 10px; color: #e74c3c; font-size: 13px; font-weight: 600;">Data tidak ditemukan!</div>';
    return;
  }
  
  let html = '';
  
  // Render spareparts
  matchedSp.forEach(sp => {
    const buyPriceHtml = (user.role === 'admin' || user.role === 'owner') 
      ? `<span style="font-size:11px; color:#64748b; font-weight:500;">(Modal: ${rupiah(sp.buy_price)})</span>`
      : '';
      
    const aliasText = sp.nama_lain ? ` (${sp.nama_lain})` : '';
    html += `
      <div style="display:flex; justify-content:space-between; align-items:center; background:#fff; border:1px solid #e2e8f0; border-radius:8px; padding:10px 12px; box-shadow:0 1px 2px rgba(0,0,0,0.05); margin-bottom:8px;">
        <div style="display:flex; flex-direction:column; gap:2px; flex:1; padding-right:10px; text-align:left;">
          <div style="font-size:13px; font-weight:700; color:#1e293b;">${escHtml(sp.name)}<span style="font-size:11px; color:#64748b; font-style:italic; font-weight:normal;">${escHtml(aliasText)}</span></div>
          <div style="font-size:11px; color:#64748b; font-family:monospace;">Kode: ${escHtml(sp.code || '-')} · Merk: ${escHtml(sp.brand || '-')} · Tipe: ${escHtml(sp.type || '-')}</div>
          <div style="font-size:11px; color:#64748b;">Rak: <strong style="color:#0f766e;">${escHtml(sp.rack_location || '-')}</strong> · Stok: <strong style="${sp.stock <= 5 ? 'color:#ef4444;' : 'color:#10b981;'}">${sp.stock} ${sp.unit || 'pcs'}</strong></div>
        </div>
        <div style="display:flex; flex-direction:column; align-items:flex-end; gap:6px;">
          <div style="font-size:14px; font-weight:800; color:#e87722;">${rupiah(sp.price)}</div>
          ${buyPriceHtml}
          <button onclick="addToCartFromPriceCheck(this, ${sp.id}, 'sparepart')" 
            style="padding:4px 8px; background:#fff8e6; color:#b45309; border:1px solid #fde68a; border-radius:6px; font-size:11px; font-weight:700; cursor:pointer; transition:all 0.2s;">
            + Keranjang
          </button>
        </div>
      </div>
    `;
  });
  
  // Render services
  matchedSv.forEach(sv => {
    html += `
      <div style="display:flex; justify-content:space-between; align-items:center; background:#fff; border:1px solid #e2e8f0; border-radius:8px; padding:10px 12px; box-shadow:0 1px 2px rgba(0,0,0,0.05); margin-bottom:8px;">
        <div style="display:flex; flex-direction:column; gap:2px; flex:1; padding-right:10px; text-align:left;">
          <div style="font-size:13px; font-weight:700; color:#1e293b;">${escHtml(sv.name)}</div>
          <div style="font-size:11px; color:#3b82f6; font-weight:600; text-transform:uppercase;">Jasa Servis</div>
        </div>
        <div style="display:flex; flex-direction:column; align-items:flex-end; gap:6px;">
          <div style="font-size:14px; font-weight:800; color:#3b82f6;">${rupiah(sv.price)}</div>
          <button onclick="addToCartFromPriceCheck(this, ${sv.id}, 'servis')" 
            style="padding:4px 8px; background:#eff6ff; color:#1d4ed8; border:1px solid #bfdbfe; border-radius:6px; font-size:11px; font-weight:700; cursor:pointer; transition:all 0.2s;">
            + Keranjang
          </button>
        </div>
      </div>
    `;
  });
  
  resultArea.innerHTML = html;
}

function addToCartFromPriceCheck(btn, id, type) {
  const success = addToCartById(id, type);
  if (!success) return;
  const originalText = btn.innerHTML;
  btn.innerHTML = '✅ Sukses';
  btn.style.background = '#27ae60';
  btn.style.color = '#fff';
  btn.disabled = true;
  setTimeout(() => {
    btn.innerHTML = originalText;
    btn.style.background = '';
    btn.style.color = '';
    btn.disabled = false;
  }, 1000);
}

// Global hotkey F2 untuk Cek Harga
window.addEventListener('keydown', e => {
  if (e.key === 'F2') {
    e.preventDefault();
    const modal = document.getElementById('modalPriceCheck');
    if (modal) {
      if (modal.classList.contains('hidden')) {
        openPriceCheck();
      } else {
        closePriceCheck();
      }
    }
  }
});

// ===== MANUAL PRODUCT FROM OUTSIDE LOGIC =====
function openManualItemModal() {
  const form = document.getElementById('formManualItem');
  if (form) form.reset();
  const qtyEl = document.getElementById('manualItemQty');
  if (qtyEl) qtyEl.value = '1';
  const modal = document.getElementById('modalManualItem');
  if (modal) modal.classList.remove('hidden');
  const nameEl = document.getElementById('manualItemName');
  if (nameEl) setTimeout(() => nameEl.focus(), 100);
}

function closeManualItemModal() {
  const modal = document.getElementById('modalManualItem');
  if (modal) modal.classList.add('hidden');
}

function formatManualPriceInput(input) {
  const raw = input.value.replace(/\D/g, '');
  input.value = raw ? Number(raw).toLocaleString('id-ID') : '';
}

function addManualItemToCart() {
  const name = document.getElementById('manualItemName').value.trim();
  const brand = document.getElementById('manualItemBrand').value.trim();
  
  const rawBuyPrice = document.getElementById('manualItemBuyPrice').value.replace(/\./g, '').replace(',', '.');
  const buyPrice = parseFloat(rawBuyPrice) || 0;
  
  const rawPrice = document.getElementById('manualItemPrice').value.replace(/\./g, '').replace(',', '.');
  const price = parseFloat(rawPrice) || 0;
  
  const qty = parseInt(document.getElementById('manualItemQty').value) || 1;

  if (!name) {
    alert('Nama barang wajib diisi!');
    return;
  }
  if (price < 0 || buyPrice < 0) {
    alert('Harga tidak valid!');
    return;
  }

  // Generate a temporary unique ID for cart tracking
  const tempId = 'manual_' + Date.now();

  cart.push({
    id: tempId,
    is_manual: true,
    type: 'sparepart',
    name: name,
    code: 'Luar',
    brand: brand || 'Luar',
    price: price,
    buy_price: buyPrice,
    qty: qty,
    maxQty: 99999,
    unit: 'pcs'
  });

  closeManualItemModal();
  renderCart();
}

// ===== OTHER PRODUCT (LAINNYA) LOGIC =====
function openOtherItemModal() {
  const form = document.getElementById('formOtherItem');
  if (form) form.reset();
  const qtyEl = document.getElementById('otherItemQty');
  if (qtyEl) qtyEl.value = '1';
  const modal = document.getElementById('modalOtherItem');
  if (modal) modal.classList.remove('hidden');
  const nameEl = document.getElementById('otherItemName');
  if (nameEl) setTimeout(() => nameEl.focus(), 100);
}

function closeOtherItemModal() {
  const modal = document.getElementById('modalOtherItem');
  if (modal) modal.classList.add('hidden');
}

function addOtherItemToCart() {
  const name = document.getElementById('otherItemName').value.trim();
  
  const rawPrice = document.getElementById('otherItemPrice').value.replace(/\./g, '').replace(',', '.');
  const price = parseFloat(rawPrice) || 0;
  
  const qty = parseInt(document.getElementById('otherItemQty').value) || 1;

  if (!name) {
    alert('Nama barang wajib diisi!');
    return;
  }
  if (price < 0) {
    alert('Harga tidak valid!');
    return;
  }

  // Generate a temporary unique ID for cart tracking
  const tempId = 'other_' + Date.now();

  cart.push({
    id: tempId,
    is_manual: true,
    type: 'sparepart',
    name: name,
    code: 'Lainnya',
    brand: 'Lainnya',
    price: price,
    buy_price: 0,
    qty: qty,
    maxQty: 99999,
    unit: 'pcs'
  });

  closeOtherItemModal();
  renderCart();
}

// ===== PERSISTENT CART STATE LOGIC =====
function saveActiveCartState() {
  const state = {
    cart: cart,
    activeSavedCartId: activeSavedCartId,
    activeSavedCartData: activeSavedCartData,
    paymentMethod: paymentMethod,
    customerInput: document.getElementById('selectCustomerInput')?.value || '',
    mechanicId: document.getElementById('selectMechanic')?.value || '',
    discountInput: document.getElementById('discountInput')?.value || '',
    cashReceived: document.getElementById('cashReceived')?.value || ''
  };
  localStorage.setItem('active_cart_state', JSON.stringify(state));
}

function loadActiveCartState() {
  // If there is a pending cart loading request from the saved carts page, ignore the saved active cart state
  if (localStorage.getItem('loadCartId')) {
    return;
  }
  try {
    const saved = localStorage.getItem('active_cart_state');
    if (!saved) return;
    const state = JSON.parse(saved);
    if (state.cart) cart = state.cart;
    if (state.activeSavedCartId) activeSavedCartId = state.activeSavedCartId;
    if (state.activeSavedCartData) activeSavedCartData = state.activeSavedCartData;
    if (state.paymentMethod) paymentMethod = state.paymentMethod;

    // Apply values to DOM once DOM is ready or immediately if already loaded
    const applyToDom = () => {
      // Set payment method
      if (state.paymentMethod) {
        selectPayment(state.paymentMethod);
      }
      // Set customer input
      const custInput = document.getElementById('selectCustomerInput');
      if (custInput && state.customerInput) {
        custInput.value = state.customerInput;
      }
      // Set discount
      const discInput = document.getElementById('discountInput');
      if (discInput && state.discountInput) {
        discInput.value = state.discountInput;
      }
      // Set cash received
      const cashInput = document.getElementById('cashReceived');
      if (cashInput && state.cashReceived) {
        cashInput.value = state.cashReceived;
      }
      renderCart();
      if (typeof checkVehicleHistoryButton === 'function') checkVehicleHistoryButton();
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', applyToDom);
    } else {
      applyToDom();
    }
  } catch (err) {
    console.error('Error loading active cart state:', err);
  }
}

