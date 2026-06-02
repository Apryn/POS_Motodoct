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

function getLocalDate(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Default: bulan ini
const now = new Date();
const firstDay = getLocalDate(new Date(now.getFullYear(), now.getMonth(), 1));
const today = getLocalDate();

const dateFromEl = document.getElementById('dateFrom');
const dateToEl = document.getElementById('dateTo');
if (dateFromEl) dateFromEl.value = firstDay;
if (dateToEl) dateToEl.value = today;

let chartPendapatan = null;
let chartBiaya = null;
let chartPerbandingan = null;
let chartDonut = null;
let chartTrxHarian = null;
let currentTransactions = [];
let currentDetailTrx = null;

async function loadLaporan() {
  const from = dateFromEl?.value || firstDay;
  const to = dateToEl?.value || today;

  try {
    const [resSummary, resTrx] = await Promise.all([
      fetch(`${API}/reports/summary?from=${from}&to=${to}`, { headers: { Authorization: `Bearer ${token}` } }),
      fetch(`${API}/reports/transactions?from=${from}&to=${to}`, { headers: { Authorization: `Bearer ${token}` } })
    ]);
    const [summaryData, trxData] = await Promise.all([resSummary.json(), resTrx.json()]);

    if (summaryData.success) {
      const d = summaryData.data;
      document.getElementById('statTrx').textContent = d.total_transaksi || 0;
      document.getElementById('statPendapatan').textContent = rupiahShort(d.total_pendapatan);
      document.getElementById('statPengeluaran').textContent = rupiahShort(d.total_pengeluaran);
      document.getElementById('statLaba').textContent = rupiahShort(d.laba_kotor);

      renderCharts(d);
    }

    if (trxData.success) {
      currentTransactions = trxData.data;
      renderTransactionTable(currentTransactions);
    }
  } catch (err) {
    console.error('Laporan error:', err);
  }
}

function renderCharts(d) {
  const harian = d.harian || [];
  const pengeluaranHarian = d.pengeluaran_harian || [];
  const pembayaran = d.pembayaran || [];

  // Build date-indexed maps
  const pendMap = {};
  harian.forEach(h => { pendMap[h.tanggal] = parseFloat(h.pendapatan || 0); });

  const biayaMap = {};
  pengeluaranHarian.forEach(h => { biayaMap[h.tanggal] = parseFloat(h.pengeluaran || 0); });

  // Collect all dates
  const allDates = [...new Set([...Object.keys(pendMap), ...Object.keys(biayaMap)])].sort();
  const labels = allDates.map(d => new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }));
  const pendArr = allDates.map(d => pendMap[d] || 0);
  const biayaArr = allDates.map(d => biayaMap[d] || 0);
  const trxArr = harian.map(h => h.jumlah_transaksi || 0);
  const trxLabels = harian.map(h => new Date(h.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }));

  // Chart Pendapatan
  const ctxP = document.getElementById('chartPendapatan')?.getContext('2d');
  if (ctxP) {
    if (chartPendapatan) chartPendapatan.destroy();
    chartPendapatan = new Chart(ctxP, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Pendapatan',
          data: pendArr,
          borderColor: '#27ae60',
          backgroundColor: 'rgba(39,174,96,0.1)',
          tension: 0.4,
          fill: true,
          pointRadius: 4,
          pointBackgroundColor: '#27ae60'
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ' ' + rupiah(c.raw) } } },
        scales: { y: { beginAtZero: true, ticks: { callback: v => 'Rp ' + Number(v).toLocaleString('id-ID') } } }
      }
    });
  }

  // Chart Biaya
  const ctxB = document.getElementById('chartBiaya')?.getContext('2d');
  if (ctxB) {
    if (chartBiaya) chartBiaya.destroy();
    chartBiaya = new Chart(ctxB, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Biaya Operasional',
          data: biayaArr,
          borderColor: '#e74c3c',
          backgroundColor: 'rgba(231,76,60,0.1)',
          tension: 0.4,
          fill: true,
          pointRadius: 4,
          pointBackgroundColor: '#e74c3c'
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ' ' + rupiah(c.raw) } } },
        scales: { y: { beginAtZero: true, ticks: { callback: v => 'Rp ' + Number(v).toLocaleString('id-ID') } } }
      }
    });
  }

  // Chart Perbandingan
  const ctxPb = document.getElementById('chartPerbandingan')?.getContext('2d');
  if (ctxPb) {
    if (chartPerbandingan) chartPerbandingan.destroy();
    chartPerbandingan = new Chart(ctxPb, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'Pendapatan', data: pendArr, backgroundColor: 'rgba(39,174,96,0.7)', borderRadius: 4 },
          { label: 'Pengeluaran', data: biayaArr, backgroundColor: 'rgba(231,76,60,0.7)', borderRadius: 4 }
        ]
      },
      options: {
        responsive: true,
        plugins: { tooltip: { callbacks: { label: c => ' ' + rupiah(c.raw) } } },
        scales: { y: { beginAtZero: true, ticks: { callback: v => 'Rp ' + Number(v).toLocaleString('id-ID') } } }
      }
    });
  }

  // Donut chart metode pembayaran
  const ctxD = document.getElementById('chartDonut')?.getContext('2d');
  if (ctxD) {
    if (chartDonut) chartDonut.destroy();
    const donutColors = ['#3498db', '#27ae60', '#e87722', '#9b59b6', '#e74c3c'];
    const donutLabels = pembayaran.map(p => p.payment_method?.toUpperCase() || 'LAINNYA');
    const donutData = pembayaran.map(p => parseFloat(p.total || 0));
    const totalDonut = donutData.reduce((s, v) => s + v, 0);

    chartDonut = new Chart(ctxD, {
      type: 'doughnut',
      data: {
        labels: donutLabels,
        datasets: [{ data: donutData, backgroundColor: donutColors.slice(0, donutData.length), borderWidth: 2 }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ' ' + rupiah(c.raw) } } },
        cutout: '65%'
      }
    });

    // Legend
    const legendEl = document.getElementById('donutLegend');
    if (legendEl) {
      legendEl.innerHTML = donutLabels.map((label, i) => {
        const pct = totalDonut > 0 ? ((donutData[i] / totalDonut) * 100).toFixed(1) : 0;
        return `
          <div class="legend-item">
            <span class="legend-dot" style="background:${donutColors[i]}"></span>
            <span>${label}</span>
            <span class="legend-pct">${pct}%</span>
          </div>
        `;
      }).join('');
    }
  }

  // Bar chart transaksi harian
  const ctxT = document.getElementById('chartTrxHarian')?.getContext('2d');
  if (ctxT) {
    if (chartTrxHarian) chartTrxHarian.destroy();
    chartTrxHarian = new Chart(ctxT, {
      type: 'bar',
      data: {
        labels: trxLabels,
        datasets: [{
          label: 'Jumlah Transaksi',
          data: trxArr,
          backgroundColor: 'rgba(232,119,34,0.7)',
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
      }
    });
  }
}

function renderTransactionTable(data) {
  const tbody = document.getElementById('trxTableBody');
  if (!data.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="empty-state">Tidak ada transaksi</td></tr>';
    return;
  }

  const methodStyle = {
    cash:     { bg: '#e8f8f0', color: '#27ae60' },
    qris:     { bg: '#fff8e6', color: '#f39c12' },
    transfer: { bg: '#eef2ff', color: '#4a6cf7' }
  };

  tbody.innerHTML = data.map((t, i) => {
    const m = methodStyle[t.payment_method] || { bg: '#f0f0f0', color: '#888' };
    return `<tr>
      <td>${i + 1}</td>
      <td><span class="code-badge">${t.invoice_number || '-'}</span></td>
      <td>${t.created_at ? new Date(t.created_at).toLocaleDateString('id-ID') : '-'}</td>
      <td>${t.customer_name || 'Umum'}</td>
      <td><span style="padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700;background:${m.bg};color:${m.color}">${(t.payment_method||'-').toUpperCase()}</span></td>
      <td><strong>${rupiah(t.total_amount)}</strong></td>
      <td>${t.username || '-'}</td>
      <td><button onclick="lihatDetail(${t.id})" style="padding:4px 10px;background:#eef2ff;color:#4a6cf7;border:none;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;">Detail</button></td>
    </tr>`;
  }).join('');
}

// Tab switching
function switchTab(tab) {
  ['Pendapatan', 'Biaya', 'Perbandingan'].forEach(t => {
    const box = document.getElementById(`tab${t}`);
    const btn = document.querySelector(`.lap-tab[data-tab="${t}"]`);
    if (box) box.classList.toggle('hidden', t !== tab);
    if (btn) btn.classList.toggle('active', t === tab);
  });
}

// Apply filter
function applyFilter() {
  loadLaporan();
}

// Export CSV
function exportCSV() {
  if (!currentTransactions.length) { alert('Tidak ada data!'); return; }
  const headers = ['No', 'Invoice', 'Tanggal', 'Pelanggan', 'Metode', 'Total', 'Kasir'];
  const rows = currentTransactions.map((t, i) => [
    i + 1,
    t.invoice_number || '',
    t.created_at ? new Date(t.created_at).toLocaleDateString('id-ID') : '',
    t.customer_name || 'Umum',
    (t.payment_method || '').toUpperCase(),
    t.total_amount || 0,
    t.username || ''
  ]);
  const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `laporan_${dateFromEl?.value || firstDay}_${dateToEl?.value || today}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

async function lihatDetail(id) {
  try {
    const res = await fetch(`${API}/transactions/${id}`, { headers: { Authorization: `Bearer ${token}` } });
    const { data } = await res.json();
    if (!data) return;

    currentDetailTrx = data;
    if (document.getElementById('btnPrintDetailStruk')) {
      document.getElementById('btnPrintDetailStruk').style.display = 'inline-block';
    }

    const tgl = new Date(data.created_at).toLocaleString('id-ID');
    let html = `
      <div style="margin-bottom:12px;">
        <div style="font-size:13px;color:#888;">Invoice</div>
        <div style="font-size:15px;font-weight:700;">${data.invoice_number}</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px;font-size:13px;">
        <div><span style="color:#888;">Tanggal:</span> ${tgl}</div>
        <div><span style="color:#888;">Kasir:</span> ${data.username}</div>
        <div><span style="color:#888;">Pelanggan:</span> ${data.customer_name || 'Umum'}</div>
        <div><span style="color:#888;">Metode:</span> ${(data.payment_method||'').toUpperCase()}</div>
      </div>`;

    if (data.spareparts?.length) {
      html += `<div style="font-size:12px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">Sparepart</div>
        <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:12px;">
          <thead><tr style="background:#f8f9fa;">
            <th style="padding:6px 10px;text-align:left;">Nama</th>
            <th style="padding:6px 10px;text-align:center;">Qty</th>
            <th style="padding:6px 10px;text-align:right;">Subtotal</th>
          </tr></thead>
          <tbody>${data.spareparts.map(s => `
            <tr style="border-bottom:1px solid #f0f0f0;">
              <td style="padding:6px 10px;">${s.sparepart_name}</td>
              <td style="padding:6px 10px;text-align:center;">${s.quantity}</td>
              <td style="padding:6px 10px;text-align:right;">${rupiah(s.subtotal)}</td>
            </tr>`).join('')}
          </tbody>
        </table>`;
    }

    if (data.services?.length) {
      html += `<div style="font-size:12px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">Servis</div>
        <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:12px;">
          <thead><tr style="background:#f8f9fa;">
            <th style="padding:6px 10px;text-align:left;">Jenis Servis</th>
            <th style="padding:6px 10px;text-align:left;">Mekanik</th>
            <th style="padding:6px 10px;text-align:right;">Harga</th>
          </tr></thead>
          <tbody>${data.services.map(s => `
            <tr style="border-bottom:1px solid #f0f0f0;">
              <td style="padding:6px 10px;">${s.service_name}</td>
              <td style="padding:6px 10px;">${s.mechanic_name}</td>
              <td style="padding:6px 10px;text-align:right;">${rupiah(s.price)}</td>
            </tr>`).join('')}
          </tbody>
        </table>`;
    }

    html += `<div style="display:flex;justify-content:space-between;font-size:15px;font-weight:800;padding:10px 0;border-top:2px solid #f0f0f0;">
      <span>TOTAL</span><span style="color:#e87722;">${rupiah(data.total_amount)}</span>
    </div>`;

    document.getElementById('detailContent').innerHTML = html;
    document.getElementById('modalDetail').classList.remove('hidden');
  } catch (err) {
    alert('Gagal memuat detail transaksi');
  }
}

function closeDetail() {
  document.getElementById('modalDetail').classList.add('hidden');
  currentDetailTrx = null;
  if (document.getElementById('btnPrintDetailStruk')) {
    document.getElementById('btnPrintDetailStruk').style.display = 'none';
  }
}

function printDetailStruk() {
  if (!currentDetailTrx) return;
  const data = currentDetailTrx;
  const now = new Date(data.created_at);

  const escHtml = (str) => String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  const allItems = [];
  if (data.spareparts?.length) {
    data.spareparts.forEach(s => {
      allItems.push({
        code: s.sparepart_code || '-',
        name: s.sparepart_name,
        qty: s.quantity,
        price: s.price,
        isService: false
      });
    });
  }
  if (data.services?.length) {
    data.services.forEach(s => {
      allItems.push({
        code: '-',
        name: s.service_name + ' (Servis)',
        qty: 1,
        price: s.price,
        isService: true
      });
    });
  }

  const subtotal = allItems.reduce((s, i) => s + i.price * i.qty, 0);
  const total = parseFloat(data.total_amount) || subtotal;
  const discountAmt = Math.max(0, subtotal - total);
  const discountPct = subtotal > 0 ? Math.round((discountAmt / subtotal) * 100) : 0;

  let mechName = '-';
  if (data.services?.length) {
    const mechs = [...new Set(data.services.map(s => s.mechanic_name).filter(Boolean))];
    if (mechs.length) mechName = mechs.join(', ');
  }

  const isLong = allItems.length > 5;
  const minRows = isLong ? 0 : 5;
  const containerHeightCss = isLong 
    ? `height: auto;` 
    : `height: 380px;`;
  const printHeightCss = isLong 
    ? `height: auto !important; min-height: auto !important; display: block !important;` 
    : `height: 12.0cm !important; min-height: 12.0cm !important; display: flex !important;`;
  let rowsHtml = '';
  allItems.forEach((i, idx) => {
    rowsHtml += `
    <tr style="font-family:'Courier New', Courier, monospace; height: 22px;">
      <td style="padding: 1px 0; text-align: center; vertical-align: top; border-bottom: 1px dashed #000;">${idx + 1}</td>
      <td style="padding: 1px 4px; text-align: left; vertical-align: top; border-bottom: 1px dashed #000; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 120px;" title="${escHtml(i.code)}">${escHtml(i.code)}</td>
      <td style="padding: 1px 4px; text-align: left; vertical-align: top; border-bottom: 1px dashed #000; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 250px;" title="${escHtml(i.name)}">${escHtml(i.name)}</td>
      <td style="padding: 1px 4px; text-align: left; vertical-align: top; border-bottom: 1px dashed #000;">N/A</td>
      <td style="padding: 1px 4px; text-align: center; vertical-align: top; border-bottom: 1px dashed #000;">${i.qty}</td>
      <td style="padding: 1px 4px; text-align: right; vertical-align: top; border-bottom: 1px dashed #000; white-space: nowrap;">${rupiah(i.price)}</td>
      <td style="padding: 1px 0; text-align: right; vertical-align: top; border-bottom: 1px dashed #000; white-space: nowrap;">${rupiah(i.price * i.qty)}</td>
    </tr>
    `;
  });
  for (let idx = allItems.length; idx < minRows; idx++) {
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

  // Load shop settings from localStorage
  const savedSettings = localStorage.getItem('receipt_settings');
  let shopName = 'MOTODOCT';
  let shopSlogan = 'Bengkel Motor Terpercaya';
  let shopFooter = 'Terima kasih atas kunjungan Anda!';
  let shopWA = '';
  let shopIG = '';
  if (savedSettings) {
    try {
      const cfg = JSON.parse(savedSettings);
      if (cfg.shopName) shopName = cfg.shopName;
      if (cfg.shopSlogan) shopSlogan = cfg.shopSlogan;
      if (cfg.shopFooter) shopFooter = cfg.shopFooter;
      if (cfg.shopWA) shopWA = cfg.shopWA;
      if (cfg.shopIG) shopIG = cfg.shopIG;
    } catch (e) {}
  }

  let contactHtml = '';
  if (shopWA) contactHtml += `WA: ${escHtml(shopWA)} `;
  if (shopIG) contactHtml += `IG: ${escHtml(shopIG)}`;
  if (contactHtml) contactHtml = `<div style="font-size: 11px; margin-bottom: 2px;">${contactHtml}</div>`;

  const win = window.open('', '_blank', 'width=800,height=600');
  win.document.write(`
    <html>
      <head>
        <title>Invoice Motodoct - Detail Print</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            background: #fff;
            color: #000;
            margin: 0;
            padding: 0;
          }
          .receipt-container {
            font-family: 'Courier New', Courier, monospace;
            color: #000;
            font-size: 13px;
            line-height: 1.3;
            box-sizing: border-box;
            width: 770px;
            ${containerHeightCss}
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            background: #fff;
            padding: 2mm 0;
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
      </head>
      <body onload="window.print(); setTimeout(() => window.close(), 500);">
        <div class="receipt-container">
          <div>
            <!-- Header (Logo on Left, Metadata on Right) -->
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 4px;">
              <tr>
                <!-- Left side: Shop Logo Box & Slogan -->
                <td style="width: 50%; vertical-align: top;">
                  <div style="border: 2px solid #000; padding: 2px 8px; display: inline-block; font-weight: bold; font-size: 19px; letter-spacing: 1px; text-transform: uppercase;">
                    ${escHtml(shopName)}
                  </div>
                  <div style="font-size: 11px; margin-top: 2px; line-height: 1.1;">
                    ${escHtml(shopSlogan)}<br>
                    ${contactHtml}
                  </div>
                </td>
                <!-- Right side: Metadata Grid -->
                <td style="width: 50%; vertical-align: top;">
                  <table style="font-size: 12px; font-family: 'Courier New', Courier, monospace; border-collapse: collapse; margin-left: auto; text-align: left;">
                    <tr>
                      <td style="padding: 1px 0; width: 95px; font-weight: bold;">NO. FAKTUR</td>
                      <td style="padding: 1px 4px; font-weight: bold;">:</td>
                      <td style="padding: 1px 0; font-weight: bold;">${data.invoice_number}</td>
                    </tr>
                    <tr>
                      <td style="padding: 1px 0;">TANGGAL</td>
                      <td style="padding: 1px 4px;">:</td>
                      <td style="padding: 1px 0;">${now.toLocaleDateString('id-ID')} WIB</td>
                    </tr>
                    <tr>
                      <td style="padding: 1px 0;">KEPADA YTH</td>
                      <td style="padding: 1px 4px;">:</td>
                      <td style="padding: 1px 0; font-weight: bold; text-transform: uppercase;">${escHtml(data.customer_name || 'Umum')} (${escHtml(data.license_plate || '-')})</td>
                    </tr>
                    <tr>
                      <td style="padding: 1px 0;">MEKANIK</td>
                      <td style="padding: 1px 4px;">:</td>
                      <td style="padding: 1px 0; text-transform: uppercase;">${escHtml(mechName)}</td>
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
                  <th style="padding: 3px 4px; text-align: left; width: 20%;">No Part Number</th>
                  <th style="padding: 3px 4px; text-align: left; width: 36%;">Nama Barang / Layanan</th>
                  <th style="padding: 3px 4px; text-align: left; width: 8%;">Merek</th>
                  <th style="padding: 3px 4px; text-align: center; width: 6%;">Qty</th>
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
                    <tr>
                      <td style="padding: 1px 0;">Metode</td>
                      <td style="padding: 1px 0; text-align: right; text-transform: uppercase;">${data.payment_method || 'CASH'}</td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
            
            <!-- Footer Slogan -->
            <div style="text-align: center; font-size: 11px; margin-top: 4px; font-style: italic; border-top: 1px dashed #000; padding-top: 2px;">
              ${escHtml(shopFooter)}
            </div>
          </div>
        </div>
      </body>
    </html>
  `);
  win.document.close();
}

function printLaporan() {
  window.print();
}

// Init
loadLaporan();
switchTab('Pendapatan');
