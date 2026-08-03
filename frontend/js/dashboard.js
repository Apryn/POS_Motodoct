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
const now = new Date();
document.getElementById('welcomeText').textContent = user.username || 'Admin';
document.getElementById('userAvatar').textContent = (user.username || 'A')[0].toUpperCase();
document.getElementById('periodeText').textContent = now.toLocaleDateString('id-ID', {
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
});
document.getElementById('bulanLabel').textContent = now.toLocaleDateString('id-ID', {
  month: 'long', year: 'numeric'
});

// ===== HELPERS =====
function getLocalDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}

function rupiah(n) {
  return 'Rp\u00A0' + Number(n || 0).toLocaleString('id-ID');
}

function rupiahShort(n) {
  n = Number(n || 0);
  if (n >= 1_000_000_000) return 'Rp\u00A0' + (n/1_000_000_000).toFixed(1) + '\u00A0M';
  if (n >= 1_000_000)     return 'Rp\u00A0' + (n/1_000_000).toFixed(1) + '\u00A0Jt';
  if (n >= 1_000)         return 'Rp\u00A0' + (n/1_000).toFixed(0) + '\u00A0Rb';
  return 'Rp\u00A0' + n.toLocaleString('id-ID');
}

function logout() { localStorage.clear(); window.location.href = 'login.html'; }

// ===== SIDEBAR MOBILE =====
function openSidebar() {
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('sidebarOverlay').classList.add('open');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('open');
}

// ===== CHART =====
let chartDashboard = null;
let currentDays = 7;

async function loadChart(days = 7) {
  currentDays = days;
  const labels = [], pendArr = [], biayaArr = [];
  const todayObj = new Date();
  const fromObj = new Date();
  fromObj.setDate(todayObj.getDate() - (days - 1));
  const fromDate = getLocalDate(fromObj);
  const toDate = getLocalDate(todayObj);

  let harianMap = {}, pengeluaranMap = {};

  try {
    const res = await fetch(`${API}/reports/summary?from=${fromDate}&to=${toDate}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const json = await res.json();
    if (json.success && json.data) {
      (json.data.harian || []).forEach(item => {
        const t = getLocalDate(new Date(item.tanggal));
        harianMap[t] = parseFloat(item.pendapatan || 0);
      });
      (json.data.pengeluaran_harian || []).forEach(item => {
        const t = getLocalDate(new Date(item.tanggal));
        pengeluaranMap[t] = parseFloat(item.pengeluaran || 0);
      });
    }
  } catch (err) {
    console.error('Chart load error:', err);
  }

  let hasData = false;
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(todayObj);
    d.setDate(todayObj.getDate() - i);
    const dateStr = getLocalDate(d);
    labels.push(d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }));

    const pend = harianMap[dateStr] || 0;
    const biaya = pengeluaranMap[dateStr] || 0;
    pendArr.push(pend);
    biayaArr.push(biaya);
    if (pend > 0 || biaya > 0) hasData = true;
  }

  const canvas = document.getElementById('chartDashboard');
  const emptyBox = document.getElementById('chartEmpty');

  if (!hasData) {
    canvas.style.display = 'none';
    emptyBox.style.display = 'block';
    return;
  }

  canvas.style.display = 'block';
  emptyBox.style.display = 'none';

  if (chartDashboard) chartDashboard.destroy();

  chartDashboard = new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Pendapatan',
          data: pendArr,
          borderColor: '#10b981',
          backgroundColor: 'rgba(16,185,129,0.08)',
          borderWidth: 2.5,
          tension: 0.4,
          fill: true,
          pointBackgroundColor: '#10b981',
          pointRadius: 4,
          pointHoverRadius: 6,
        },
        {
          label: 'Pengeluaran',
          data: biayaArr,
          borderColor: '#ef4444',
          backgroundColor: 'rgba(239,68,68,0.06)',
          borderWidth: 2,
          tension: 0.4,
          fill: true,
          pointBackgroundColor: '#ef4444',
          pointRadius: 4,
          pointHoverRadius: 6,
        }
      ]
    },
    options: {
      responsive: true,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          position: 'top',
          labels: { font: { size: 12 }, usePointStyle: true, pointStyleWidth: 8 }
        },
        tooltip: {
          backgroundColor: '#1e2a3a',
          titleFont: { size: 12 },
          bodyFont: { size: 13 },
          padding: 12,
          callbacks: {
            label: ctx => `  ${ctx.dataset.label}: ${rupiah(ctx.raw)}`
          }
        }
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 11 } } },
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(0,0,0,0.04)' },
          ticks: {
            font: { size: 11 },
            callback: v => {
              if (v >= 1_000_000) return 'Rp ' + (v/1_000_000).toFixed(0) + ' Jt';
              if (v >= 1_000) return 'Rp ' + (v/1_000).toFixed(0) + ' Rb';
              return 'Rp ' + v;
            }
          }
        }
      }
    }
  });
}

function switchChart(days, btn) {
  document.querySelectorAll('.chart-toggle-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  loadChart(days);
}

// ===== LOAD DASHBOARD =====
async function loadDashboard() {
  const today = getLocalDate();
  const firstDay = getLocalDate(new Date(now.getFullYear(), now.getMonth(), 1));
  const headers = { Authorization: `Bearer ${token}` };

  try {
    // Ambil KPI hari ini + stok inventaris pakai endpoint RINGAN
    const todayRes = await fetch(`${API}/reports/dashboard-stats?from=${today}&to=${today}`, { headers })
      .then(r => r.json()).catch(() => ({ success: false }));

    // ===== KPI HARI INI =====
    if (todayRes.success) {
      const d = todayRes.data;
      const laba = d.laba_kotor;

      document.getElementById('statTrx').textContent = d.total_transaksi || 0;
      document.getElementById('statPendapatan').textContent = rupiahShort(d.total_pendapatan);
      document.getElementById('statPengeluaran').textContent = rupiahShort(d.total_pengeluaran);
      document.getElementById('statLaba').textContent = rupiahShort(laba);

      const labaCard = document.getElementById('labaCard');
      const labaIcon = document.getElementById('labaIcon');
      const labaSub = document.getElementById('labaSub');

      if (laba > 0) {
        labaCard.style.setProperty('--card-color', 'var(--green)');
        labaCard.style.setProperty('--card-bg', 'rgba(16,185,129,0.1)');
        document.getElementById('statLaba').style.color = 'var(--green)';
        labaIcon.textContent = '📈';
        labaSub.textContent = '▲ profit positif';
        labaSub.className = 'stat-card-sub positive';
      } else if (laba < 0) {
        labaCard.style.setProperty('--card-color', 'var(--red)');
        labaCard.style.setProperty('--card-bg', 'rgba(239,68,68,0.1)');
        document.getElementById('statLaba').style.color = 'var(--red)';
        labaIcon.textContent = '📉';
        labaSub.textContent = '▼ rugi';
        labaSub.className = 'stat-card-sub negative';
      } else {
        labaCard.style.setProperty('--card-color', 'var(--orange)');
        document.getElementById('statLaba').style.color = 'var(--orange)';
        labaIcon.textContent = '➖';
        labaSub.textContent = 'impas';
      }

      // Inventaris Gudang
      if (d.sparepart_stats) {
        document.getElementById('totalSparepart').textContent = d.sparepart_stats.total_item || 0;
        document.getElementById('totalMenipis').textContent = d.sparepart_stats.stok_menipis || 0;
        document.getElementById('totalHabis').textContent = d.sparepart_stats.stok_habis || 0;
      }

      const badge = document.getElementById('notifBadge');
      const badgeTotal = (d.sparepart_stats?.stok_menipis || 0) + (d.sparepart_stats?.stok_habis || 0);
      if (badge && badgeTotal > 0) {
        badge.textContent = badgeTotal;
        badge.style.display = 'inline';
      }
    }

    // Ambil Ringkasan Bulan & Chart secara PARALEL (tidak bloking KPI)
    const [bulanRes] = await Promise.all([
      fetch(`${API}/reports/dashboard-stats?from=${firstDay}&to=${today}`, { headers })
        .then(r => r.json()).catch(() => ({ success: false })),
      loadChart(7),
    ]);

    // ===== RINGKASAN BULAN =====
    if (bulanRes.success) {
      const b = bulanRes.data;
      const labaB = b.laba_kotor;
      document.getElementById('bulanTrx').textContent = b.total_transaksi || 0;
      document.getElementById('bulanPendapatan').textContent = rupiahShort(b.total_pendapatan);
      document.getElementById('bulanPengeluaran').textContent = rupiahShort(b.total_pengeluaran);
      const labaEl = document.getElementById('bulanLaba');
      labaEl.textContent = rupiahShort(labaB);
      labaEl.style.color = labaB >= 0 ? 'var(--purple)' : 'var(--red)';
      document.getElementById('totalTrxBulan').textContent = b.total_transaksi || 0;
    }

  } catch (err) {
    console.error('Dashboard error:', err);
  }
}

loadDashboard();
