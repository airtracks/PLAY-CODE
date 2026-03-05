/* ──────────────────────────────────────────────────────────────────────
   GeoFilter Widget — DumaOS Style
   Netgear Nighthawk compatible GeoFilter standalone widget
   ────────────────────────────────────────────────────────────────────── */

'use strict';

/* ─── Electron 감지 ──────────────────────────────────────────────────── */
const isElectron = typeof window !== 'undefined' && window.electronAPI?.isElectron === true;

/* ─── State ──────────────────────────────────────────────────────────── */
const state = {
  filterEnabled: true,
  strictMode: false,
  homeLatLng: [37.5665, 126.9780],
  radiusKm: 1000,
  maxPing: 80,
  servers: [],
  activeTab: 'all',
  nextId: 1,
  currentGame: 'all',
  searchQuery: '',
  pingHistory: [],
};

/* ─── IP 추적 상태 ───────────────────────────────────────────────────── */
const ipTrackers = [];   // { ip, marker, data }
let currentIPResult = null;

/* ─── Game Profiles ──────────────────────────────────────────────────── */
const GAME_PROFILES = {
  all:      { label: '전체',          recommended: { radius: 1000, maxPing: 80 },  serverRegions: null },
  cod:      { label: 'Call of Duty',  recommended: { radius: 800,  maxPing: 60 },
    serverRegions: ['Seoul KR-1','Seoul KR-2','Tokyo JP-1','Tokyo JP-2','Singapore SG-1','Frankfurt EU-1','N.Virginia US-1','Oregon US-2'] },
  fortnite: { label: 'Fortnite',      recommended: { radius: 1500, maxPing: 80 },
    serverRegions: ['Seoul KR-1','Tokyo JP-1','Singapore SG-1','Hong Kong HK-1','Sydney AU-1','Frankfurt EU-1','N.Virginia US-1'] },
  apex:     { label: 'Apex Legends',  recommended: { radius: 1200, maxPing: 70 },
    serverRegions: ['Seoul KR-1','Seoul KR-2','Tokyo JP-1','Singapore SG-1','Frankfurt EU-1','Amsterdam EU-2','N.Virginia US-1','Oregon US-2'] },
  fifa:     { label: 'EA FC',         recommended: { radius: 1000, maxPing: 60 },
    serverRegions: ['Seoul KR-1','Tokyo JP-1','Singapore SG-1','Frankfurt EU-1','Amsterdam EU-2','London EU-3','N.Virginia US-1'] },
  valorant: { label: 'Valorant',      recommended: { radius: 700,  maxPing: 50 },
    serverRegions: ['Seoul KR-1','Seoul KR-2','Tokyo JP-1','Tokyo JP-2','Singapore SG-1','Singapore SG-2','Hong Kong HK-1'] },
};

/* ─── Map init ───────────────────────────────────────────────────────── */
const map = L.map('map', {
  center: state.homeLatLng,
  zoom: 4,
  zoomControl: true,
  attributionControl: true,
});

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap contributors',
  maxZoom: 18,
}).addTo(map);

/* ─── Custom markers ─────────────────────────────────────────────────── */
function makeHomeIcon() {
  return L.divIcon({
    className: '',
    html: `
      <div style="position:relative;width:22px;height:22px;">
        <div class="home-marker-ring"></div>
        <div style="width:22px;height:22px;background:#00d4ff;border-radius:50%;border:3px solid #fff;
          box-shadow:0 0 12px rgba(0,212,255,0.8);display:flex;align-items:center;justify-content:center;position:relative;z-index:2;">
          <svg width="10" height="10" viewBox="0 0 14 14" fill="white"><path d="M7 1L1 6h2v7h3V9h2v4h3V6h2L7 1z"/></svg>
        </div>
      </div>`,
    iconSize: [22, 22], iconAnchor: [11, 11], popupAnchor: [0, -14],
  });
}

function makeServerIcon(color, ping) {
  const size = ping < 60 ? 14 : ping < 120 ? 12 : 10;
  return L.divIcon({
    className: '',
    html: `<div style="width:${size}px;height:${size}px;background:${color};border-radius:50%;
      border:2px solid rgba(255,255,255,0.25);box-shadow:0 0 8px ${color}88;cursor:pointer;"></div>`,
    iconSize: [size, size], iconAnchor: [size / 2, size / 2], popupAnchor: [0, -(size / 2 + 4)],
  });
}

/* ─── IP 추적 마커 (황색 다이아몬드) ────────────────────────────────── */
function makeIPMarkerIcon() {
  return L.divIcon({
    className: '',
    html: `
      <div style="position:relative;width:18px;height:18px;">
        <div style="
          width:12px;height:12px;
          background:#f59e0b;
          transform:rotate(45deg);
          position:absolute;top:3px;left:3px;
          border:2px solid rgba(255,255,255,0.4);
          box-shadow:0 0 10px rgba(245,158,11,0.9), 0 0 20px rgba(245,158,11,0.4);
        "></div>
      </div>`,
    iconSize: [18, 18], iconAnchor: [9, 9], popupAnchor: [0, -12],
  });
}

/* ─── Home marker & radius circle ───────────────────────────────────── */
let homeMarker = L.marker(state.homeLatLng, {
  icon: makeHomeIcon(), draggable: true, zIndexOffset: 1000,
}).addTo(map).bindPopup('<b>내 위치</b><br/>드래그하여 이동');

let radiusCircle = L.circle(state.homeLatLng, {
  radius: state.radiusKm * 1000,
  color: '#00d4ff', fillColor: '#00d4ff', fillOpacity: 0.05,
  weight: 1.5, dashArray: '6 4',
}).addTo(map);

homeMarker.on('dragend', () => {
  const latlng = homeMarker.getLatLng();
  state.homeLatLng = [latlng.lat, latlng.lng];
  radiusCircle.setLatLng(latlng);
  updateLocationText();
  updateAllServerMarkers();
  renderServerList();
  updateStats();
});

/* ─── Geo distance (Haversine) ───────────────────────────────────────── */
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/* ─── Server filter logic ────────────────────────────────────────────── */
function getServerStatus(server) {
  if (server.whitelisted) return 'whitelisted';
  if (!state.filterEnabled) return 'allowed';
  const dist = haversineKm(state.homeLatLng[0], state.homeLatLng[1], server.lat, server.lng);
  const inRadius = dist <= state.radiusKm;
  const pingOk = !state.strictMode || server.ping <= state.maxPing;
  return inRadius && pingOk ? 'allowed' : 'blocked';
}

function serverColor(status) {
  return { allowed: '#22c55e', blocked: '#ef4444', whitelisted: '#f97316' }[status];
}

function estimatePing(lat, lng) {
  const dist = haversineKm(state.homeLatLng[0], state.homeLatLng[1], lat, lng);
  return Math.min(Math.round(dist / 40 + Math.random() * 20 + 5), 999);
}

/* ─── Sample server pool ─────────────────────────────────────────────── */
const SERVER_POOL = [
  { name: 'Seoul KR-1',      lat: 37.56,  lng: 126.97 },
  { name: 'Seoul KR-2',      lat: 37.49,  lng: 127.02 },
  { name: 'Tokyo JP-1',      lat: 35.68,  lng: 139.69 },
  { name: 'Tokyo JP-2',      lat: 35.71,  lng: 139.72 },
  { name: 'Singapore SG-1',  lat: 1.35,   lng: 103.82 },
  { name: 'Singapore SG-2',  lat: 1.29,   lng: 103.85 },
  { name: 'Hong Kong HK-1',  lat: 22.39,  lng: 114.10 },
  { name: 'Sydney AU-1',     lat: -33.87, lng: 151.21 },
  { name: 'Frankfurt EU-1',  lat: 50.11,  lng: 8.68   },
  { name: 'Amsterdam EU-2',  lat: 52.37,  lng: 4.90   },
  { name: 'London EU-3',     lat: 51.51,  lng: -0.13  },
  { name: 'Paris EU-4',      lat: 48.86,  lng: 2.35   },
  { name: 'N.Virginia US-1', lat: 38.95,  lng: -77.45 },
  { name: 'Oregon US-2',     lat: 45.52,  lng: -122.67},
  { name: 'São Paulo BR-1',  lat: -23.55, lng: -46.63 },
  { name: 'Mumbai IN-1',     lat: 19.08,  lng: 72.88  },
  { name: 'Bahrain ME-1',    lat: 26.05,  lng: 50.55  },
  { name: 'Cape Town AF-1',  lat: -33.93, lng: 18.42  },
];

let poolIndex = 0;

function addServerFromPool() {
  if (poolIndex >= SERVER_POOL.length) return false;
  const t = SERVER_POOL[poolIndex++];
  addServer({ name: t.name, lat: t.lat, lng: t.lng, ping: estimatePing(t.lat, t.lng) });
  return true;
}

/* ─── Server management ──────────────────────────────────────────────── */
function addServer({ name, lat, lng, ping }) {
  const id = state.nextId++;
  const server = { id, name, lat, lng, ping, whitelisted: false, marker: null };
  server.marker = createServerMarker(server);
  state.servers.push(server);
  renderServerList();
  updateStats();
  return server;
}

function createServerMarker(server) {
  const status = getServerStatus(server);
  const marker = L.marker([server.lat, server.lng], {
    icon: makeServerIcon(serverColor(status), server.ping),
    zIndexOffset: 500,
  }).addTo(map);
  marker.on('click', () => {
    marker.bindPopup(buildServerPopupHtml(server, getServerStatus(server))).openPopup();
  });
  return marker;
}

function buildServerPopupHtml(server, status) {
  const pingClass = server.ping < 60 ? 'good' : server.ping < 120 ? 'ok' : 'bad';
  const pingColor = pingClass === 'good' ? '#22c55e' : pingClass === 'ok' ? '#f97316' : '#ef4444';
  const dist = Math.round(haversineKm(state.homeLatLng[0], state.homeLatLng[1], server.lat, server.lng));
  return `
    <div style="min-width:140px;">
      <div style="font-weight:700;font-size:13px;margin-bottom:6px;">${server.name}</div>
      <div style="display:flex;justify-content:space-between;font-size:11px;color:#64748b;margin-bottom:4px;">
        <span>핑</span><span style="color:${pingColor};font-weight:600;">${server.ping}ms</span>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:11px;color:#64748b;margin-bottom:4px;">
        <span>거리</span><span>${dist.toLocaleString()}km</span>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:11px;color:#64748b;margin-bottom:8px;">
        <span>상태</span>
        <span style="color:${serverColor(status)};font-weight:600;font-size:10px;">${
          status === 'allowed' ? '허용' : status === 'blocked' ? '차단' : '화이트리스트'
        }</span>
      </div>
      <div style="display:flex;gap:4px;">
        <button onclick="toggleWhitelist(${server.id})" style="flex:1;padding:4px;font-size:9px;background:#1a1e29;border:1px solid rgba(249,115,22,0.3);color:#f97316;border-radius:5px;cursor:pointer;font-weight:700;">
          ${server.whitelisted ? '화이트리스트 해제' : '화이트리스트'}
        </button>
        <button onclick="removeServer(${server.id})" style="flex:1;padding:4px;font-size:9px;background:#1a1e29;border:1px solid #232737;color:#64748b;border-radius:5px;cursor:pointer;font-weight:700;">삭제</button>
      </div>
    </div>`;
}

function updateMarker(server) {
  const status = getServerStatus(server);
  if (server.marker) server.marker.setIcon(makeServerIcon(serverColor(status), server.ping));
}

function updateAllServerMarkers() {
  state.servers.forEach(s => { s.ping = estimatePing(s.lat, s.lng); updateMarker(s); });
}

/* ─── IP Geolocation ─────────────────────────────────────────────────── */
function countryFlag(code) {
  if (!code || code.length !== 2) return '🌐';
  return code.toUpperCase().split('').map(c =>
    String.fromCodePoint(c.charCodeAt(0) + 127397)
  ).join('');
}

function isValidIPv4(ip) {
  const parts = ip.trim().split('.');
  return parts.length === 4 && parts.every(p => p !== '' && !isNaN(p) && +p >= 0 && +p <= 255);
}

async function lookupIP(ip) {
  const res = await fetch(
    `https://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,message,country,countryCode,regionName,city,lat,lon,isp,as,query`
  );
  if (!res.ok) throw new Error(`네트워크 오류 (${res.status})`);
  const data = await res.json();
  if (data.status !== 'success') throw new Error(data.message || '조회 실패');
  return data;
}

async function getMyPublicIP() {
  const res = await fetch('https://api.ipify.org?format=json');
  if (!res.ok) throw new Error('공인 IP 조회 실패');
  const data = await res.json();
  return data.ip;
}

/* ─── IP Tracker: 마커 및 데이터 관리 ───────────────────────────────── */
function buildIPPopupHtml(data) {
  const { ip, flag, country, city, regionName, isp, lat, lng } = data;
  const dist = Math.round(haversineKm(state.homeLatLng[0], state.homeLatLng[1], lat, lng));
  const ping = estimatePing(lat, lng);
  return `
    <div style="min-width:165px;">
      <div style="display:flex;align-items:center;gap:7px;margin-bottom:8px;">
        <span style="font-size:20px;line-height:1;">${flag}</span>
        <div>
          <div style="font-weight:700;font-size:12px;color:#f59e0b;">${city || regionName || '—'}</div>
          <div style="font-size:10px;color:#64748b;">${country}</div>
        </div>
      </div>
      <div style="font-family:monospace;font-size:10px;background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.2);border-radius:4px;padding:3px 7px;margin-bottom:8px;color:#f59e0b;">${ip}</div>
      <div style="font-size:10px;color:#64748b;margin-bottom:2px;">ISP</div>
      <div style="font-size:10px;margin-bottom:7px;word-break:break-all;color:#e2e8f0;">${isp || '—'}</div>
      <div style="display:flex;justify-content:space-between;font-size:10px;color:#64748b;margin-bottom:8px;">
        <span>거리 <strong style="color:#e2e8f0;">${dist.toLocaleString()}km</strong></span>
        <span>예상 핑 <strong style="color:#e2e8f0;">~${ping}ms</strong></span>
      </div>
      <button onclick="removeIPTracker('${ip}')" style="width:100%;padding:4px;font-size:10px;background:#1a1e29;border:1px solid #232737;color:#64748b;border-radius:5px;cursor:pointer;font-weight:700;">
        추적 삭제
      </button>
    </div>`;
}

function addIPMarker(ip, apiData) {
  const { lat, lon, country, countryCode, city, regionName, isp } = apiData;
  const flag = countryFlag(countryCode);

  // 같은 IP 기존 마커 제거
  const existIdx = ipTrackers.findIndex(t => t.ip === ip);
  if (existIdx !== -1) {
    if (ipTrackers[existIdx].marker) map.removeLayer(ipTrackers[existIdx].marker);
    ipTrackers.splice(existIdx, 1);
  }

  const data = { ip, country, countryCode, city, regionName, isp, lat, lng: lon, flag };

  const marker = L.marker([lat, lon], {
    icon: makeIPMarkerIcon(),
    zIndexOffset: 2000,
  }).addTo(map);

  marker.on('click', () => marker.bindPopup(buildIPPopupHtml(data)).openPopup());

  ipTrackers.push({ ip, marker, data });
  currentIPResult = data;

  renderIPResult(data);
  renderIPHistory();
  return marker;
}

function renderIPResult(data) {
  const el = document.getElementById('ipResult');
  if (!data) { el.classList.add('hidden'); return; }

  const { ip, flag, city, regionName, country, isp, lat, lng } = data;
  const dist = Math.round(haversineKm(state.homeLatLng[0], state.homeLatLng[1], lat, lng));
  const ping = estimatePing(lat, lng);

  el.innerHTML = `
    <div class="ip-result-header">
      <span class="ip-flag">${flag}</span>
      <div class="ip-loc-info">
        <div class="ip-loc-city">${city || regionName || '—'}</div>
        <div class="ip-loc-country">${country || '—'}</div>
      </div>
    </div>
    <div class="ip-addr-chip">${ip}</div>
    <div class="ip-detail-row"><span>ISP</span><span title="${isp || '—'}">${isp || '—'}</span></div>
    <div class="ip-detail-row"><span>거리</span><span>${dist.toLocaleString()} km</span></div>
    <div class="ip-detail-row"><span>예상 핑</span><span>~${ping} ms</span></div>
    <div class="ip-result-actions">
      <button class="ip-fly-btn" onclick="flyToIPTracker('${ip}')">🗺 지도</button>
      <button class="ip-clear-btn" onclick="removeIPTracker('${ip}')">삭제</button>
    </div>`;
  el.classList.remove('hidden');
}

function renderIPHistory() {
  const el = document.getElementById('ipHistory');
  if (ipTrackers.length === 0) { el.innerHTML = ''; return; }

  el.innerHTML = ipTrackers.map(({ ip, data }) => `
    <div class="ip-history-item" onclick="flyToIPTracker('${ip}')">
      <span class="ip-h-flag">${data.flag}</span>
      <div class="ip-h-info">
        <div class="ip-h-addr">${ip}</div>
        <div class="ip-h-loc">${data.city || data.regionName || ''}, ${data.country}</div>
      </div>
      <button class="ip-h-del" onclick="event.stopPropagation();removeIPTracker('${ip}')">✕</button>
    </div>`).join('');
}

/* ─── IP Tracker 글로벌 액션 ─────────────────────────────────────────── */
window.removeIPTracker = function(ip) {
  const idx = ipTrackers.findIndex(t => t.ip === ip);
  if (idx === -1) return;
  if (ipTrackers[idx].marker) map.removeLayer(ipTrackers[idx].marker);
  ipTrackers.splice(idx, 1);
  map.closePopup();
  currentIPResult = ipTrackers[ipTrackers.length - 1]?.data || null;
  renderIPResult(currentIPResult);
  renderIPHistory();
  showToast(`🗑 ${ip} 추적 삭제됨`, 'info');
};

window.flyToIPTracker = function(ip) {
  const tracker = ipTrackers.find(t => t.ip === ip);
  if (!tracker) return;
  map.flyTo([tracker.data.lat, tracker.data.lng], 8, { duration: 0.8 });
  setTimeout(() => tracker.marker.bindPopup(buildIPPopupHtml(tracker.data)).openPopup(), 900);
};

/* ─── IP 조회 핸들러 ─────────────────────────────────────────────────── */
async function handleLookupIP() {
  const raw = document.getElementById('ipInput').value.trim();
  if (!raw) return;

  if (!isValidIPv4(raw)) {
    showToast('⚠️ 올바른 IPv4 주소를 입력하세요 (예: 1.2.3.4)', 'warning');
    return;
  }

  const btn = document.getElementById('btnLookupIP');
  btn.disabled = true;
  btn.textContent = '...';
  showToast(`🔍 ${raw} 조회 중...`, 'info');

  try {
    const data = await lookupIP(raw);
    const marker = addIPMarker(raw, data);
    map.flyTo([data.lat, data.lon], 8, { duration: 0.8 });
    setTimeout(() => {
      marker.bindPopup(buildIPPopupHtml({
        ip: raw, flag: countryFlag(data.countryCode),
        country: data.country, countryCode: data.countryCode,
        city: data.city, regionName: data.regionName,
        isp: data.isp, lat: data.lat, lng: data.lon,
      })).openPopup();
    }, 900);
    showToast(`✅ ${raw} — ${data.city || data.regionName}, ${data.country}`, 'success');
  } catch (err) {
    showToast(`❌ 조회 실패: ${err.message}`, 'warning');
  } finally {
    btn.disabled = false;
    btn.textContent = '조회';
  }
}

/* ─── Server list globals ────────────────────────────────────────────── */
window.toggleWhitelist = function(id) {
  const server = state.servers.find(s => s.id === id);
  if (!server) return;
  server.whitelisted = !server.whitelisted;
  updateMarker(server);
  renderServerList();
  updateStats();
  map.closePopup();
  showToast(server.whitelisted ? `✅ ${server.name} 화이트리스트 추가됨` : `❌ ${server.name} 해제됨`,
    server.whitelisted ? 'success' : 'info');
};

window.removeServer = function(id) {
  const idx = state.servers.findIndex(s => s.id === id);
  if (idx === -1) return;
  const server = state.servers[idx];
  if (server.marker) map.removeLayer(server.marker);
  state.servers.splice(idx, 1);
  renderServerList();
  updateStats();
  map.closePopup();
  showToast(`🗑 ${server.name} 삭제됨`, 'info');
};

window.focusServer = function(id) {
  const server = state.servers.find(s => s.id === id);
  if (!server) return;
  map.flyTo([server.lat, server.lng], 6, { duration: 0.8 });
  setTimeout(() => {
    server.marker.bindPopup(buildServerPopupHtml(server, getServerStatus(server))).openPopup();
  }, 900);
};

/* ─── Toast ──────────────────────────────────────────────────────────── */
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('toast-visible'));
  setTimeout(() => {
    toast.classList.remove('toast-visible');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

/* ─── Connection quality ─────────────────────────────────────────────── */
function updateQualityBadge(avgPing) {
  const badge = document.getElementById('qualityBadge');
  const label = document.getElementById('qualityLabel');
  if (avgPing === null) { label.textContent = '—'; badge.className = 'quality-badge'; return; }
  const q = avgPing < 40  ? { t: '최상', c: 'quality-excellent' }
          : avgPing < 70  ? { t: '좋음', c: 'quality-good' }
          : avgPing < 120 ? { t: '보통', c: 'quality-ok' }
          :                 { t: '불량', c: 'quality-bad' };
  label.textContent = q.t;
  badge.className = `quality-badge ${q.c}`;
}

/* ─── Ping graph ─────────────────────────────────────────────────────── */
const GRAPH_MAX_POINTS = 30;

function recordPingHistory(avg) {
  if (avg === null) return;
  state.pingHistory.push(avg);
  if (state.pingHistory.length > GRAPH_MAX_POINTS) state.pingHistory.shift();
  drawPingGraph();
}

function drawPingGraph() {
  const canvas = document.getElementById('pingGraph');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  if (state.pingHistory.length < 2) return;

  const maxVal = Math.max(...state.pingHistory, 20);
  const range = maxVal || 1;

  ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 1;
  [0.25, 0.5, 0.75].forEach(f => {
    ctx.beginPath(); ctx.moveTo(0, H - f * H); ctx.lineTo(W, H - f * H); ctx.stroke();
  });

  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, 'rgba(0,212,255,0.35)');
  grad.addColorStop(1, 'rgba(0,212,255,0)');

  const pts = state.pingHistory.map((v, i) => ({
    x: (i / (GRAPH_MAX_POINTS - 1)) * W,
    y: H - (v / range) * (H - 4) - 2,
  }));

  ctx.beginPath(); ctx.moveTo(pts[0].x, H);
  pts.forEach(p => ctx.lineTo(p.x, p.y));
  ctx.lineTo(pts[pts.length - 1].x, H);
  ctx.closePath(); ctx.fillStyle = grad; ctx.fill();

  ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
  pts.slice(1).forEach(p => ctx.lineTo(p.x, p.y));
  ctx.strokeStyle = '#00d4ff'; ctx.lineWidth = 1.5; ctx.lineJoin = 'round'; ctx.stroke();

  const last = pts[pts.length - 1];
  ctx.beginPath(); ctx.arc(last.x, last.y, 3, 0, Math.PI * 2);
  ctx.fillStyle = '#00d4ff'; ctx.fill();
}

/* ─── Server list render ─────────────────────────────────────────────── */
function renderServerList() {
  const list = document.getElementById('serverList');
  const tab = state.activeTab;
  const query = state.searchQuery.toLowerCase();

  let servers = state.servers.map(s => ({ ...s, status: getServerStatus(s) }));
  if (tab === 'allowed')   servers = servers.filter(s => s.status === 'allowed');
  else if (tab === 'blocked')   servers = servers.filter(s => s.status === 'blocked');
  else if (tab === 'whitelist') servers = servers.filter(s => s.whitelisted);
  if (query) servers = servers.filter(s => s.name.toLowerCase().includes(query));

  if (servers.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
          <circle cx="20" cy="20" r="18" stroke="#444" stroke-width="2"/>
          <path d="M13 20h14M20 13v14" stroke="#444" stroke-width="2" stroke-linecap="round"/>
        </svg>
        <p>${query ? '검색 결과가 없습니다' : tab === 'all' ? '서버를 추가하려면<br/>+ 버튼을 클릭하세요' : '해당하는 서버가 없습니다'}</p>
      </div>`;
    return;
  }

  list.innerHTML = servers.map(s => {
    const pingClass = s.ping < 60 ? 'good' : s.ping < 120 ? 'ok' : 'bad';
    const dist = Math.round(haversineKm(state.homeLatLng[0], state.homeLatLng[1], s.lat, s.lng));
    return `
      <div class="server-card ${s.status}" onclick="focusServer(${s.id})">
        <div class="server-card-header">
          <span class="server-name">${s.name}</span>
          <span class="server-status-badge badge-${s.status}">${
            s.status === 'allowed' ? '허용' : s.status === 'blocked' ? '차단' : '화이트리스트'
          }</span>
        </div>
        <div class="server-meta">
          <span>${dist.toLocaleString()}km</span>
          <span class="ping-value ping-${pingClass}">${s.ping}ms</span>
        </div>
        <div class="server-actions">
          <button class="action-btn whitelist" onclick="event.stopPropagation();toggleWhitelist(${s.id})">
            ${s.whitelisted ? '해제' : '화이트리스트'}
          </button>
          <button class="action-btn remove" onclick="event.stopPropagation();removeServer(${s.id})">삭제</button>
        </div>
      </div>`;
  }).join('');
}

/* ─── Stats ──────────────────────────────────────────────────────────── */
function updateStats() {
  const total = state.servers.length;
  const statuses = state.servers.map(s => getServerStatus(s));
  const allowed = statuses.filter(s => s === 'allowed' || s === 'whitelisted').length;
  const blocked = statuses.filter(s => s === 'blocked').length;
  const pings = state.servers.map(s => s.ping);
  const avg = pings.length ? Math.round(pings.reduce((a, b) => a + b, 0) / pings.length) : null;

  document.getElementById('totalServers').textContent = total;
  document.getElementById('allowedServers').textContent = allowed;
  document.getElementById('blockedServers').textContent = blocked;
  document.getElementById('avgPing').textContent = avg !== null ? `${avg}ms` : '—';
  updateQualityBadge(avg);
}

/* ─── Location ───────────────────────────────────────────────────────── */
function updateLocationText() {
  const [lat, lng] = state.homeLatLng;
  document.getElementById('locationText').textContent = `${lat.toFixed(3)}, ${lng.toFixed(3)}`;
}

function geolocate() {
  if (!navigator.geolocation) { updateLocationText(); return; }
  showToast('📍 위치를 감지하는 중...', 'info');
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      state.homeLatLng = [pos.coords.latitude, pos.coords.longitude];
      homeMarker.setLatLng(state.homeLatLng);
      radiusCircle.setLatLng(state.homeLatLng);
      map.flyTo(state.homeLatLng, 5);
      updateLocationText();
      updateAllServerMarkers();
      renderServerList();
      updateStats();
      showToast('✅ 위치가 업데이트되었습니다', 'success');
    },
    () => { updateLocationText(); showToast('⚠️ 위치를 감지할 수 없습니다', 'warning'); }
  );
}

/* ─── Radius ─────────────────────────────────────────────────────────── */
function updateRadius(km) {
  state.radiusKm = km;
  radiusCircle.setRadius(km * 1000);
  document.getElementById('radiusValue').textContent = km.toLocaleString();
  document.getElementById('radiusSlider').value = km;
  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.classList.toggle('active', Number(btn.dataset.km) === km);
  });
  updateAllServerMarkers();
  renderServerList();
  updateStats();
}

/* ─── Game profile ───────────────────────────────────────────────────── */
function applyGameProfile(gameKey) {
  state.currentGame = gameKey;
  const profile = GAME_PROFILES[gameKey];
  if (!profile) return;

  document.getElementById('maxPing').value = profile.recommended.maxPing;
  state.maxPing = profile.recommended.maxPing;
  updateRadius(profile.recommended.radius);

  state.servers.forEach(s => { if (s.marker) map.removeLayer(s.marker); });
  state.servers = [];
  poolIndex = 0;
  state.nextId = 1;

  const regions = profile.serverRegions || SERVER_POOL.map(s => s.name);
  SERVER_POOL.forEach(t => {
    if (regions.includes(t.name)) {
      addServer({ name: t.name, lat: t.lat, lng: t.lng, ping: estimatePing(t.lat, t.lng) });
    }
  });
  poolIndex = SERVER_POOL.length;

  renderServerList();
  updateStats();
  showToast(`🎮 ${profile.label} 프로파일 — 서버 ${state.servers.length}개 로드됨`, 'success');

  setTimeout(() => {
    if (state.servers.length > 0) {
      const bounds = L.latLngBounds([state.homeLatLng]);
      state.servers.forEach(s => bounds.extend([s.lat, s.lng]));
      map.flyToBounds(bounds, { padding: [40, 40] });
    }
  }, 300);
}

/* ─── Ping simulation ────────────────────────────────────────────────── */
function simulatePingUpdate() {
  state.servers.forEach(server => {
    const drift = Math.floor((Math.random() - 0.5) * 10);
    server.ping = Math.max(1, Math.min(999, server.ping + drift));
    updateMarker(server);
  });
  renderServerList();
  updateStats();
  const pings = state.servers.map(s => s.ping);
  const avg = pings.length ? Math.round(pings.reduce((a, b) => a + b, 0) / pings.length) : null;
  recordPingHistory(avg);
}

/* ─── Window controls (Electron) ────────────────────────────────────── */
if (isElectron) {
  document.getElementById('winControls').style.display = 'flex';

  let isPinned = false;

  document.getElementById('btnMinimize').addEventListener('click', () => window.electronAPI.minimize());

  document.getElementById('btnClose').addEventListener('click', () => window.electronAPI.close());

  document.getElementById('btnPin').addEventListener('click', () => {
    isPinned = !isPinned;
    window.electronAPI.pin(isPinned);
    document.getElementById('btnPin').classList.toggle('active', isPinned);
    showToast(isPinned ? '📌 항상 위에 고정됨' : '📌 고정 해제됨', 'info');
  });
}

/* ─── Event wiring ───────────────────────────────────────────────────── */
document.getElementById('filterToggle').addEventListener('change', (e) => {
  state.filterEnabled = e.target.checked;
  document.getElementById('statusDot').classList.toggle('inactive', !state.filterEnabled);
  document.getElementById('statusText').textContent = state.filterEnabled ? '활성화' : '비활성화';
  updateAllServerMarkers();
  renderServerList();
  updateStats();
  showToast(state.filterEnabled ? '🛡 지오필터 활성화됨' : '⛔ 지오필터 비활성화됨',
    state.filterEnabled ? 'success' : 'warning');
});

document.getElementById('radiusSlider').addEventListener('input', (e) => updateRadius(Number(e.target.value)));

document.getElementById('maxPing').addEventListener('input', (e) => {
  state.maxPing = Number(e.target.value) || 80;
  if (state.strictMode) { updateAllServerMarkers(); renderServerList(); updateStats(); }
});

document.getElementById('strictMode').addEventListener('change', (e) => {
  state.strictMode = e.target.checked;
  updateAllServerMarkers(); renderServerList(); updateStats();
  showToast(state.strictMode ? '🔒 엄격 모드 활성화됨' : '🔓 엄격 모드 해제됨', 'info');
});

document.getElementById('refreshLocation').addEventListener('click', geolocate);

document.getElementById('btnAddServer').addEventListener('click', () => {
  if (!addServerFromPool()) showToast('더 추가할 수 있는 샘플 서버가 없습니다.', 'warning');
});

document.getElementById('btnLoadAll').addEventListener('click', () => {
  let count = 0;
  while (poolIndex < SERVER_POOL.length) { addServerFromPool(); count++; }
  if (count > 0) {
    showToast(`📡 서버 ${count}개 추가 로드됨`, 'success');
    setTimeout(() => {
      const bounds = L.latLngBounds([state.homeLatLng]);
      state.servers.forEach(s => bounds.extend([s.lat, s.lng]));
      map.flyToBounds(bounds, { padding: [40, 40] });
    }, 200);
  } else {
    showToast('이미 모든 서버가 로드되었습니다.', 'info');
  }
});

document.getElementById('btnClearAll').addEventListener('click', () => {
  const count = state.servers.length;
  state.servers.forEach(s => { if (s.marker) map.removeLayer(s.marker); });
  state.servers = []; poolIndex = 0; state.nextId = 1;
  renderServerList(); updateStats();
  if (count > 0) showToast(`🗑 서버 ${count}개 모두 삭제됨`, 'info');
});

document.getElementById('btnFitBounds').addEventListener('click', () => {
  if (state.servers.length === 0) { map.flyTo(state.homeLatLng, 4); return; }
  const bounds = L.latLngBounds([state.homeLatLng]);
  state.servers.forEach(s => bounds.extend([s.lat, s.lng]));
  map.flyToBounds(bounds, { padding: [40, 40] });
});

document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    state.activeTab = tab.dataset.tab;
    renderServerList();
  });
});

document.querySelectorAll('.preset-btn').forEach(btn => {
  btn.addEventListener('click', () => updateRadius(Number(btn.dataset.km)));
});

document.getElementById('gameSelect').addEventListener('change', (e) => applyGameProfile(e.target.value));

document.getElementById('serverSearch').addEventListener('input', (e) => {
  state.searchQuery = e.target.value;
  renderServerList();
});

/* ─── IP Tracker events ──────────────────────────────────────────────── */
document.getElementById('btnLookupIP').addEventListener('click', handleLookupIP);

document.getElementById('ipInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') handleLookupIP();
});

document.getElementById('btnMyIP').addEventListener('click', async () => {
  const btn = document.getElementById('btnMyIP');
  btn.textContent = '⌛ 확인 중...';
  btn.disabled = true;
  try {
    const myIP = await getMyPublicIP();
    document.getElementById('ipInput').value = myIP;
    await handleLookupIP();
  } catch (err) {
    showToast('❌ 공인 IP를 가져올 수 없습니다', 'warning');
  } finally {
    btn.textContent = '📡 내 공인 IP 확인';
    btn.disabled = false;
  }
});

/* ─── Double-click map to add custom server ──────────────────────────── */
map.on('dblclick', (e) => {
  const { lat, lng } = e.latlng;
  const ping = estimatePing(lat, lng);
  addServer({ name: `Custom ${lat.toFixed(2)}, ${lng.toFixed(2)}`, lat, lng, ping });
  showToast(`📍 커스텀 서버 추가됨 (${ping}ms)`, 'info');
});

/* ─── Resize handler ─────────────────────────────────────────────────── */
window.addEventListener('resize', () => {
  map.invalidateSize();
  const canvas = document.getElementById('pingGraph');
  if (canvas) {
    canvas.width = canvas.parentElement.clientWidth - 16;
    drawPingGraph();
  }
});

/* ─── Init ───────────────────────────────────────────────────────────── */
function init() {
  updateLocationText();
  updateRadius(state.radiusKm);
  for (let i = 0; i < 6; i++) addServerFromPool();
  setInterval(simulatePingUpdate, 5000);

  // 초기 캔버스 크기 설정
  const canvas = document.getElementById('pingGraph');
  if (canvas) canvas.width = canvas.parentElement.clientWidth - 16;
}

init();
