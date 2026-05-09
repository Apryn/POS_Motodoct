const API = 'http://localhost:3000/api';
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
}

function printLaporan() {
  window.print();
}

// Init
loadLaporan();
switchTab('Pendapatan');
