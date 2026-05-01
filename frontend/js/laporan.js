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
    tbody.innerHTML = '<tr><td colspan="7" class="empty-state">Tidak ada transaksi</td></tr>';
    return;
  }
  tbody.innerHTML = data.map((t, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${t.invoice_number || '-'}</td>
      <td>${t.created_at ? new Date(t.created_at).toLocaleDateString('id-ID') : '-'}</td>
      <td>${t.customer_name || 'Umum'}</td>
      <td>${(t.payment_method || '-').toUpperCase()}</td>
      <td>${rupiah(t.total_amount)}</td>
      <td>${t.username || '-'}</td>
    </tr>
  `).join('');
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

function printLaporan() {
  window.print();
}

// Init
loadLaporan();
switchTab('Pendapatan');
