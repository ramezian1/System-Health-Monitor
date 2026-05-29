'use strict';

// ── Helpers ─────────────────────────────────────────────────────────────────

function fmtBytes(bytes, decimals = 1) {
  if (bytes === 0) return '0 B';
  const k = 1024, dm = decimals, sizes = ['B','KB','MB','GB','TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function fmtBps(bps) { return fmtBytes(bps) + '/s'; }

function usageColor(pct) {
  if (pct >= 85) return getComputedStyle(document.documentElement).getPropertyValue('--red').trim();
  if (pct >= 60) return getComputedStyle(document.documentElement).getPropertyValue('--yellow').trim();
  return getComputedStyle(document.documentElement).getPropertyValue('--green').trim();
}

function statCardClass(pct, threshold) {
  if (pct >= threshold) return 'crit';
  if (pct >= threshold * 0.85) return 'warn';
  return '';
}

function tsLabel(ts) {
  const d = new Date(ts * 1000);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// ── Chart defaults ───────────────────────────────────────────────────────────

Chart.defaults.color = getComputedStyle(document.documentElement).getPropertyValue('--text-muted').trim();
Chart.defaults.borderColor = getComputedStyle(document.documentElement).getPropertyValue('--border').trim();
Chart.defaults.font.family = 'Inter, system-ui, sans-serif';
Chart.defaults.font.size = 11;

function lineDataset(label, color, fill = false) {
  return {
    label, data: [],
    borderColor: color, backgroundColor: color + '22',
    borderWidth: 2, pointRadius: 0, fill,
    tension: 0.35,
  };
}

// ── Rolling buffer ───────────────────────────────────────────────────────────

class RingBuffer {
  constructor(size) { this.size = size; this.buf = []; }
  push(v) { this.buf.push(v); if (this.buf.length > this.size) this.buf.shift(); }
  get data() { return this.buf; }
}

const RING = 60;
const cpuRing   = new RingBuffer(RING);
const netSend   = new RingBuffer(RING);
const netRecv   = new RingBuffer(RING);
const labelsRing = new RingBuffer(RING);

// ── Chart instances ──────────────────────────────────────────────────────────

const GREEN  = '#22c55e';
const YELLOW = '#eab308';
const RED    = '#ef4444';
const BLUE   = '#4f8ef7';
const PURPLE = '#a855f7';

// CPU line chart
const cpuChart = new Chart(document.getElementById('chart-cpu'), {
  type: 'line',
  data: { labels: labelsRing.data, datasets: [lineDataset('CPU %', BLUE, true)] },
  options: {
    animation: false,
    responsive: true,
    maintainAspectRatio: true,
    scales: {
      x: { ticks: { maxRotation: 0, maxTicksLimit: 6 } },
      y: { min: 0, max: 100, ticks: { callback: v => v + '%' } },
    },
    plugins: { legend: { display: false } },
  },
});

// RAM doughnut
const ramChart = new Chart(document.getElementById('chart-ram'), {
  type: 'doughnut',
  data: {
    labels: ['Used', 'Available'],
    datasets: [{
      data: [0, 100],
      backgroundColor: [BLUE, '#2e3350'],
      borderWidth: 0,
      hoverOffset: 4,
    }],
  },
  options: {
    animation: false,
    responsive: true,
    maintainAspectRatio: true,
    cutout: '72%',
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: ctx => ' ' + ctx.label + ': ' + ctx.formattedValue + '%' } },
    },
  },
});

// Disk bar chart
const diskChart = new Chart(document.getElementById('chart-disk'), {
  type: 'bar',
  data: { labels: [], datasets: [{ label: 'Used %', data: [], backgroundColor: [], borderRadius: 4 }] },
  options: {
    animation: false,
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: true,
    scales: {
      x: { min: 0, max: 100, ticks: { callback: v => v + '%' } },
      y: { ticks: { font: { size: 10 } } },
    },
    plugins: { legend: { display: false } },
  },
});

// Network line chart
const netChart = new Chart(document.getElementById('chart-net'), {
  type: 'line',
  data: {
    labels: labelsRing.data,
    datasets: [
      lineDataset('Download', GREEN, true),
      lineDataset('Upload', BLUE),
    ],
  },
  options: {
    animation: false,
    responsive: true,
    maintainAspectRatio: true,
    scales: {
      x: { ticks: { maxRotation: 0, maxTicksLimit: 6 } },
      y: { min: 0, ticks: { callback: v => fmtBps(v) } },
    },
    plugins: { legend: { display: true, position: 'top' } },
  },
});

// History chart
let historyChart = null;

function buildHistoryChart(rows) {
  const labels = rows.map(r => tsLabel(r.ts));
  const cpuData  = rows.map(r => r.cpu_pct);
  const ramData  = rows.map(r => r.ram_pct);
  const diskData = rows.map(r => r.disk_pct);

  if (historyChart) {
    historyChart.data.labels = labels;
    historyChart.data.datasets[0].data = cpuData;
    historyChart.data.datasets[1].data = ramData;
    historyChart.data.datasets[2].data = diskData;
    historyChart.update('none');
    return;
  }

  historyChart = new Chart(document.getElementById('chart-history'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        { ...lineDataset('CPU %', BLUE), data: cpuData },
        { ...lineDataset('RAM %', PURPLE), data: ramData },
        { ...lineDataset('Disk %', YELLOW), data: diskData },
      ],
    },
    options: {
      animation: false,
      responsive: true,
      maintainAspectRatio: true,
      scales: {
        x: { ticks: { maxRotation: 0, maxTicksLimit: 10 } },
        y: { min: 0, max: 100, ticks: { callback: v => v + '%' } },
      },
      plugins: { legend: { display: true, position: 'top' } },
    },
  });
}

window.loadHistory = function(hours) {
  document.querySelectorAll('.history-card .tab-btn').forEach((b, i) => {
    b.classList.toggle('active', [1,6,24][i] === hours);
  });
  fetch(`/api/history?hours=${hours}`)
    .then(r => r.json())
    .then(rows => { if (rows.length) buildHistoryChart(rows); });
};

// ── Stat card updater ────────────────────────────────────────────────────────

function setStatCard(cardId, valueEl, subEl, barEl, pct, valueText, subText, threshold) {
  document.getElementById(valueEl).textContent = valueText;
  document.getElementById(subEl).textContent = subText;
  const bar = document.getElementById(barEl);
  bar.style.width = pct + '%';
  bar.style.background = usageColor(pct);
  const card = document.getElementById(cardId);
  card.className = 'stat-card ' + statCardClass(pct, threshold || 100);
}

// ── Process table ────────────────────────────────────────────────────────────

let currentTab = 'cpu';
let lastProcesses = null;

window.switchTab = function(tab) {
  currentTab = tab;
  document.getElementById('tab-cpu-btn').classList.toggle('active', tab === 'cpu');
  document.getElementById('tab-ram-btn').classList.toggle('active', tab === 'ram');
  if (lastProcesses) renderProcesses(lastProcesses);
};

function renderProcesses(processes) {
  lastProcesses = processes;
  const list = currentTab === 'cpu' ? processes.top_cpu : processes.top_ram;
  const tbody = document.getElementById('process-tbody');
  tbody.innerHTML = list.map(p => `
    <tr>
      <td>${p.pid}</td>
      <td>${p.name}</td>
      <td class="${p.cpu_percent > 50 ? 'red' : p.cpu_percent > 20 ? 'yellow' : 'green'}">${p.cpu_percent.toFixed(1)}%</td>
      <td class="${p.memory_percent > 20 ? 'red' : p.memory_percent > 5 ? 'yellow' : 'green'}">${p.memory_percent.toFixed(2)}%</td>
      <td>${p.status}</td>
    </tr>
  `).join('');
}

// ── Alert panel ──────────────────────────────────────────────────────────────

const alertRows = [];

function pushAlert(alert) {
  alertRows.unshift({ ts: Date.now() / 1000, ...alert });
  if (alertRows.length > 50) alertRows.pop();
  renderAlerts();
}

function renderAlerts() {
  const tbody = document.getElementById('alert-tbody');
  tbody.innerHTML = alertRows.map(a => `
    <tr>
      <td>${tsLabel(a.ts)}</td>
      <td class="red">${a.metric.toUpperCase()}</td>
      <td class="red">${a.value.toFixed(1)}%</td>
      <td>${a.threshold}%</td>
    </tr>
  `).join('') || '<tr><td colspan="4" style="color:var(--text-muted);text-align:center">No alerts</td></tr>';
}

renderAlerts();

// Load existing alerts from server on page load
fetch('/api/alerts?limit=20')
  .then(r => r.json())
  .then(rows => { rows.forEach(a => alertRows.push(a)); renderAlerts(); });

// ── Main update function ─────────────────────────────────────────────────────

function applyUpdate(stats, alerts) {
  const now = tsLabel(stats.timestamp);

  // CPU
  const cpu = stats.cpu;
  cpuRing.push(cpu.percent);
  labelsRing.push(now);
  cpuChart.data.labels = [...labelsRing.data];
  cpuChart.data.datasets[0].data = [...cpuRing.data];
  cpuChart.data.datasets[0].borderColor = usageColor(cpu.percent);
  cpuChart.data.datasets[0].backgroundColor = usageColor(cpu.percent) + '22';
  cpuChart.update('none');
  document.getElementById('cpu-cores-label').textContent =
    `${cpu.count_physical}P / ${cpu.count_logical}L` + (cpu.freq_mhz ? ` · ${(cpu.freq_mhz/1000).toFixed(2)} GHz` : '');
  setStatCard('card-cpu', 'stat-cpu', 'stat-cpu-sub', 'bar-cpu',
    cpu.percent, cpu.percent.toFixed(1) + '%',
    `${cpu.count_logical} cores` + (cpu.freq_mhz ? ` · ${(cpu.freq_mhz/1000).toFixed(2)} GHz` : ''),
    THRESHOLDS.cpu);

  // RAM
  const ram = stats.ram;
  ramChart.data.datasets[0].data = [ram.percent, 100 - ram.percent];
  ramChart.data.datasets[0].backgroundColor[0] = usageColor(ram.percent);
  ramChart.update('none');
  document.getElementById('ram-legend').innerHTML =
    `<span style="color:${usageColor(ram.percent)}">Used ${fmtBytes(ram.used)}</span>` +
    `<span>Free ${fmtBytes(ram.available)}</span>`;
  setStatCard('card-ram', 'stat-ram', 'stat-ram-sub', 'bar-ram',
    ram.percent, ram.percent.toFixed(1) + '%',
    `${fmtBytes(ram.used)} / ${fmtBytes(ram.total)}`,
    THRESHOLDS.ram);

  // Disk
  const disk = stats.disk;
  const parts = disk.partitions;
  diskChart.data.labels = parts.map(p => p.mountpoint);
  diskChart.data.datasets[0].data = parts.map(p => p.percent);
  diskChart.data.datasets[0].backgroundColor = parts.map(p => usageColor(p.percent));
  diskChart.update('none');
  const rootPart = parts.find(p => p.mountpoint === '/') || parts[0];
  if (rootPart) {
    setStatCard('card-disk', 'stat-disk', 'stat-disk-sub', 'bar-disk',
      rootPart.percent, rootPart.percent.toFixed(1) + '%',
      `${fmtBytes(rootPart.used)} / ${fmtBytes(rootPart.total)}`,
      THRESHOLDS.disk);
  }

  // Network
  const net = stats.network;
  netSend.push(net.send_bytes_per_sec);
  netRecv.push(net.recv_bytes_per_sec);
  netChart.data.labels = [...labelsRing.data];
  netChart.data.datasets[0].data = [...netRecv.data];
  netChart.data.datasets[1].data = [...netSend.data];
  netChart.update('none');
  const totalBps = net.send_bytes_per_sec + net.recv_bytes_per_sec;
  const netPct = Math.min(totalBps / (10 * 1024 * 1024) * 100, 100); // 10 MB/s ceiling for bar
  setStatCard('card-net', 'stat-net-recv', 'stat-net-sub', 'bar-net',
    netPct, fmtBps(net.recv_bytes_per_sec),
    `↑ ${fmtBps(net.send_bytes_per_sec)}  ·  ${net.active_connections} conn`,
    100);

  // Processes
  renderProcesses(stats.processes);

  // Alerts
  if (alerts && alerts.length > 0) {
    alerts.forEach(a => pushAlert(a));
    const banner = document.getElementById('alert-banner');
    banner.textContent = '⚠ Alert: ' + alerts.map(a => `${a.metric.toUpperCase()} at ${a.value.toFixed(1)}% (threshold ${a.threshold}%)`).join(' | ');
    banner.className = 'alert-banner alert-warning';
    clearTimeout(banner._hideTimer);
    banner._hideTimer = setTimeout(() => { banner.className = 'alert-banner hidden'; }, 8000);
  }
}

// ── Socket.IO ────────────────────────────────────────────────────────────────

const socket = io({ transports: ['websocket', 'polling'] });

socket.on('connect', () => {
  document.getElementById('connection-status').textContent = 'Live';
  document.getElementById('connection-status').className = 'badge badge-online';
});

socket.on('disconnect', () => {
  document.getElementById('connection-status').textContent = 'Offline';
  document.getElementById('connection-status').className = 'badge badge-offline';
});

socket.on('stats_update', ({ stats, alerts }) => {
  applyUpdate(stats, alerts);
});

// ── Theme toggle ─────────────────────────────────────────────────────────────

const themeBtn = document.getElementById('theme-toggle');
const html = document.documentElement;

function applyTheme(t) {
  html.setAttribute('data-theme', t);
  themeBtn.textContent = t === 'dark' ? '🌙' : '☀️';
  localStorage.setItem('theme', t);
}

themeBtn.addEventListener('click', () => {
  applyTheme(html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
});

applyTheme(localStorage.getItem('theme') || 'dark');

// ── Bootstrap ────────────────────────────────────────────────────────────────

// Load first data point immediately via REST so the page isn't blank
fetch('/api/stats')
  .then(r => r.json())
  .then(stats => applyUpdate(stats, []));

loadHistory(1);
