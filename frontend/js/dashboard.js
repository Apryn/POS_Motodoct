const API = 'http://localhost:3000/api';
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
  const today = new Date();
  const promises = [];

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dateStr = getLocalDate(d);
    labels.push(d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }));
    promises.push(
      fetch(`${API}/reports/summary?from=${dateStr}&to=${dateStr}`, {
        headers: { Authorization: `Bearer ${token}` }
      }).then(r => r.json()).catch(() => ({ success: false }))
    );
  }

  const results = await Promise.all(promises);
  let hasData = false;

  results.forEach(r => {
    const pend = r.success ? (r.data.total_pendapatan || 0) : 0;
    const biaya = r.success ? (r.data.total_pengeluaran || 0) : 0;
    pendArr.push(pend);
    biayaArr.push(biaya);
    if (pend > 0 || biaya > 0) hasData = true;
  });

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
    const [todayRes, bulanRes, spRes] = await Promise.all([
      fetch(`${API}/reports/summary?from=${today}&to=${today}`, { headers }).then(r => r.json()),
      fetch(`${API}/reports/summary?from=${firstDay}&to=${today}`, { headers }).then(r => r.json()),
      fetch(`${API}/spareparts`, { headers }).then(r => r.json()),
    ]);

    // ===== KPI HARI INI =====
    if (todayRes.success) {
      const d = todayRes.data;
      const laba = d.laba_kotor;

      document.getElementById('statTrx').textContent = d.total_transaksi || 0;
      document.getElementById('statPendapatan').textContent = rupiahShort(d.total_pendapatan);
      document.getElementById('statPengeluaran').textContent = rupiahShort(d.total_pengeluaran);
      document.getElementById('statLaba').textContent = rupiahShort(laba);

      // Laba card warna dinamis
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
    }

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

    // ===== INVENTARIS =====
    if (spRes.success) {
      const parts = spRes.data;
      document.getElementById('totalSparepart').textContent = parts.length;
      document.getElementById('totalMenipis').textContent = parts.filter(p => p.stock > 0 && p.stock <= 5).length;
      document.getElementById('totalHabis').textContent = parts.filter(p => p.stock === 0).length;
    }

    // ===== CHART =====
    await loadChart(7);

  } catch (err) {
    console.error('Dashboard error:', err);
  }
}

loadDashboard();
