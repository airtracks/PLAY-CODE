/* ──────────────────────────────────────────────────────────────────────
   GeoFilter Widget — DumaOS Style
   Netgear Nighthawk compatible GeoFilter standalone widget
   ────────────────────────────────────────────────────────────────────── */

'use strict';

/* ─── State ──────────────────────────────────────────────────────────── */
const state = {
  filterEnabled: true,
  strictMode: false,
  homeLatLng: [37.5665, 126.9780],   // Default: Seoul, KR
  radiusKm: 1000,
  maxPing: 80,
  servers: [],
  activeTab: 'all',
  nextId: 1,
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
        <div style="
          width:22px;height:22px;
          background:#00d4ff;
          border-radius:50%;
          border:3px solid #fff;
          box-shadow:0 0 12px rgba(0,212,255,0.8);
          display:flex;align-items:center;justify-content:center;
          position:relative;z-index:2;
        ">
          <svg width="10" height="10" viewBox="0 0 14 14" fill="white">
            <path d="M7 1L1 6h2v7h3V9h2v4h3V6h2L7 1z"/>
          </svg>
        </div>
      </div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    popupAnchor: [0, -14],
  });
}

function makeServerIcon(color, ping) {
  const size = ping < 60 ? 14 : ping < 120 ? 12 : 10;
  return L.divIcon({
    className: '',
    html: `<div style="
      width:${size}px;height:${size}px;
      background:${color};
      border-radius:50%;
      border:2px solid rgba(255,255,255,0.25);
      box-shadow:0 0 8px ${color}88;
      cursor:pointer;
    "></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -(size / 2 + 4)],
  });
}

/* ─── Home marker & radius circle ───────────────────────────────────── */
let homeMarker = L.marker(state.homeLatLng, {
  icon: makeHomeIcon(),
  draggable: true,
  zIndexOffset: 1000,
}).addTo(map).bindPopup('<b>내 위치</b><br/>드래그하여 이동');

let radiusCircle = L.circle(state.homeLatLng, {
  radius: state.radiusKm * 1000,
  color: '#00d4ff',
  fillColor: '#00d4ff',
  fillOpacity: 0.05,
  weight: 1.5,
  dashArray: '6 4',
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
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/* ─── Server filter logic ────────────────────────────────────────────── */
function getServerStatus(server) {
  if (server.whitelisted) return 'whitelisted';
  if (!state.filterEnabled) return 'allowed';
  const dist = haversineKm(
    state.homeLatLng[0], state.homeLatLng[1],
    server.lat, server.lng
  );
  const inRadius = dist <= state.radiusKm;
  const pingOk = !state.strictMode || server.ping <= state.maxPing;
  return inRadius && pingOk ? 'allowed' : 'blocked';
}

function serverColor(status) {
  return { allowed: '#22c55e', blocked: '#ef4444', whitelisted: '#f97316' }[status];
}

/* ─── Simulated ping based on distance ───────────────────────────────── */
function estimatePing(lat, lng) {
  const dist = haversineKm(state.homeLatLng[0], state.homeLatLng[1], lat, lng);
  const base = Math.round(dist / 40 + Math.random() * 20 + 5);
  return Math.min(base, 999);
}

/* ─── Sample server data (game server regions) ───────────────────────── */
const SERVER_POOL = [
  { name: 'Seoul KR-1',     lat: 37.56, lng: 126.97 },
  { name: 'Seoul KR-2',     lat: 37.49, lng: 127.02 },
  { name: 'Tokyo JP-1',     lat: 35.68, lng: 139.69 },
  { name: 'Tokyo JP-2',     lat: 35.71, lng: 139.72 },
  { name: 'Singapore SG-1', lat: 1.35,  lng: 103.82 },
  { name: 'Singapore SG-2', lat: 1.29,  lng: 103.85 },
  { name: 'Hong Kong HK-1', lat: 22.39, lng: 114.10 },
  { name: 'Sydney AU-1',    lat: -33.87, lng: 151.21 },
  { name: 'Frankfurt EU-1', lat: 50.11,  lng: 8.68  },
  { name: 'Amsterdam EU-2', lat: 52.37,  lng: 4.90  },
  { name: 'London EU-3',    lat: 51.51,  lng: -0.13 },
  { name: 'Paris EU-4',     lat: 48.86,  lng: 2.35  },
  { name: 'N.Virginia US-1',lat: 38.95,  lng: -77.45 },
  { name: 'Oregon US-2',    lat: 45.52,  lng: -122.67 },
  { name: 'São Paulo BR-1', lat: -23.55, lng: -46.63 },
  { name: 'Mumbai IN-1',    lat: 19.08,  lng: 72.88  },
  { name: 'Bahrain ME-1',   lat: 26.05,  lng: 50.55  },
  { name: 'Cape Town AF-1', lat: -33.93, lng: 18.42  },
];

let poolIndex = 0;

function addServerFromPool() {
  if (poolIndex >= SERVER_POOL.length) return;
  const template = SERVER_POOL[poolIndex++];
  const ping = estimatePing(template.lat, template.lng);
  addServer({
    name: template.name,
    lat: template.lat,
    lng: template.lng,
    ping,
  });
}

/* ─── Add / remove servers ───────────────────────────────────────────── */
function addServer({ name, lat, lng, ping }) {
  const id = state.nextId++;
  const server = { id, name, lat, lng, ping, whitelisted: false, marker: null };
  server.marker = createMarker(server);
  state.servers.push(server);
  renderServerList();
  updateStats();
  return server;
}

function createMarker(server) {
  const status = getServerStatus(server);
  const color = serverColor(status);
  const marker = L.marker([server.lat, server.lng], {
    icon: makeServerIcon(color, server.ping),
    zIndexOffset: 500,
  }).addTo(map);

  marker.on('click', () => {
    const s = getServerStatus(server);
    marker.bindPopup(buildPopupHtml(server, s)).openPopup();
  });

  return marker;
}

function buildPopupHtml(server, status) {
  const pingClass = server.ping < 60 ? 'good' : server.ping < 120 ? 'ok' : 'bad';
  const dist = Math.round(
    haversineKm(state.homeLatLng[0], state.homeLatLng[1], server.lat, server.lng)
  );
  return `
    <div style="min-width:140px;">
      <div style="font-weight:700;font-size:13px;margin-bottom:6px;">${server.name}</div>
      <div style="display:flex;justify-content:space-between;font-size:11px;color:#64748b;margin-bottom:4px;">
        <span>핑</span>
        <span class="ping-value ping-${pingClass}" style="color:${
          pingClass === 'good' ? '#22c55e' : pingClass === 'ok' ? '#f97316' : '#ef4444'
        };font-weight:600;">${server.ping}ms</span>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:11px;color:#64748b;margin-bottom:4px;">
        <span>거리</span>
        <span>${dist.toLocaleString()}km</span>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:11px;color:#64748b;margin-bottom:8px;">
        <span>상태</span>
        <span style="color:${serverColor(status)};font-weight:600;text-transform:uppercase;font-size:10px;">${
          status === 'allowed' ? '허용' : status === 'blocked' ? '차단' : '화이트리스트'
        }</span>
      </div>
      <div style="display:flex;gap:4px;">
        <button onclick="toggleWhitelist(${server.id})" style="flex:1;padding:4px;font-size:9px;background:#1a1e29;border:1px solid rgba(249,115,22,0.3);color:#f97316;border-radius:5px;cursor:pointer;font-weight:700;">
          ${server.whitelisted ? '화이트리스트 해제' : '화이트리스트'}
        </button>
        <button onclick="removeServer(${server.id})" style="flex:1;padding:4px;font-size:9px;background:#1a1e29;border:1px solid #232737;color:#64748b;border-radius:5px;cursor:pointer;font-weight:700;">
          삭제
        </button>
      </div>
    </div>`;
}

function updateMarker(server) {
  const status = getServerStatus(server);
  const color = serverColor(status);
  if (server.marker) {
    server.marker.setIcon(makeServerIcon(color, server.ping));
  }
}

function updateAllServerMarkers() {
  state.servers.forEach(s => {
    s.ping = estimatePing(s.lat, s.lng);
    updateMarker(s);
  });
}

/* ─── Exposed global actions (called from popup buttons) ─────────────── */
window.toggleWhitelist = function (id) {
  const server = state.servers.find(s => s.id === id);
  if (!server) return;
  server.whitelisted = !server.whitelisted;
  updateMarker(server);
  renderServerList();
  updateStats();
  map.closePopup();
};

window.removeServer = function (id) {
  const idx = state.servers.findIndex(s => s.id === id);
  if (idx === -1) return;
  const server = state.servers[idx];
  if (server.marker) map.removeLayer(server.marker);
  state.servers.splice(idx, 1);
  renderServerList();
  updateStats();
  map.closePopup();
};

/* ─── Server list render ─────────────────────────────────────────────── */
function renderServerList() {
  const list = document.getElementById('serverList');
  const tab = state.activeTab;

  let servers = state.servers.map(s => ({ ...s, status: getServerStatus(s) }));

  if (tab === 'allowed') servers = servers.filter(s => s.status === 'allowed');
  else if (tab === 'blocked') servers = servers.filter(s => s.status === 'blocked');
  else if (tab === 'whitelist') servers = servers.filter(s => s.whitelisted);

  if (servers.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
          <circle cx="20" cy="20" r="18" stroke="#444" stroke-width="2"/>
          <path d="M13 20h14M20 13v14" stroke="#444" stroke-width="2" stroke-linecap="round"/>
        </svg>
        <p>${tab === 'all' ? '서버를 추가하려면<br/>+ 버튼을 클릭하세요' : '해당하는 서버가 없습니다'}</p>
      </div>`;
    return;
  }

  list.innerHTML = servers.map(s => {
    const pingClass = s.ping < 60 ? 'good' : s.ping < 120 ? 'ok' : 'bad';
    const dist = Math.round(
      haversineKm(state.homeLatLng[0], state.homeLatLng[1], s.lat, s.lng)
    );
    const badgeClass = `badge-${s.status}`;
    const badgeLabel = s.status === 'allowed' ? '허용' : s.status === 'blocked' ? '차단' : '화이트리스트';

    return `
      <div class="server-card ${s.status}" data-id="${s.id}" onclick="focusServer(${s.id})">
        <div class="server-card-header">
          <span class="server-name">${s.name}</span>
          <span class="server-status-badge ${badgeClass}">${badgeLabel}</span>
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

window.focusServer = function (id) {
  const server = state.servers.find(s => s.id === id);
  if (!server) return;
  map.flyTo([server.lat, server.lng], 6, { duration: 0.8 });
  const status = getServerStatus(server);
  setTimeout(() => {
    server.marker.bindPopup(buildPopupHtml(server, status)).openPopup();
  }, 900);
};

/* ─── Stats update ───────────────────────────────────────────────────── */
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
}

/* ─── Location display ───────────────────────────────────────────────── */
function updateLocationText() {
  const [lat, lng] = state.homeLatLng;
  document.getElementById('locationText').textContent =
    `${lat.toFixed(3)}, ${lng.toFixed(3)}`;
}

function geolocate() {
  if (!navigator.geolocation) {
    updateLocationText();
    return;
  }
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
    },
    () => updateLocationText()
  );
}

/* ─── Radius update ──────────────────────────────────────────────────── */
function updateRadius(km) {
  state.radiusKm = km;
  radiusCircle.setRadius(km * 1000);
  document.getElementById('radiusValue').textContent = km.toLocaleString();
  updateAllServerMarkers();
  renderServerList();
  updateStats();
}

/* ─── Ping simulation refresh ────────────────────────────────────────── */
function simulatePingUpdate() {
  state.servers.forEach(server => {
    const drift = Math.floor((Math.random() - 0.5) * 10);
    server.ping = Math.max(1, Math.min(999, server.ping + drift));
    updateMarker(server);
  });
  renderServerList();
  updateStats();
}

/* ─── Event wiring ───────────────────────────────────────────────────── */
document.getElementById('filterToggle').addEventListener('change', (e) => {
  state.filterEnabled = e.target.checked;
  const dot = document.getElementById('statusDot');
  const text = document.getElementById('statusText');
  if (state.filterEnabled) {
    dot.classList.remove('inactive');
    text.textContent = '활성화';
  } else {
    dot.classList.add('inactive');
    text.textContent = '비활성화';
  }
  updateAllServerMarkers();
  renderServerList();
  updateStats();
});

document.getElementById('radiusSlider').addEventListener('input', (e) => {
  updateRadius(Number(e.target.value));
});

document.getElementById('maxPing').addEventListener('input', (e) => {
  state.maxPing = Number(e.target.value) || 80;
  if (state.strictMode) {
    updateAllServerMarkers();
    renderServerList();
    updateStats();
  }
});

document.getElementById('strictMode').addEventListener('change', (e) => {
  state.strictMode = e.target.checked;
  updateAllServerMarkers();
  renderServerList();
  updateStats();
});

document.getElementById('refreshLocation').addEventListener('click', geolocate);

document.getElementById('btnAddServer').addEventListener('click', () => {
  if (poolIndex >= SERVER_POOL.length) {
    alert('더 추가할 수 있는 샘플 서버가 없습니다.');
    return;
  }
  addServerFromPool();
});

document.getElementById('btnClearAll').addEventListener('click', () => {
  state.servers.forEach(s => { if (s.marker) map.removeLayer(s.marker); });
  state.servers = [];
  poolIndex = 0;
  state.nextId = 1;
  renderServerList();
  updateStats();
});

document.getElementById('btnFitBounds').addEventListener('click', () => {
  if (state.servers.length === 0) {
    map.flyTo(state.homeLatLng, 4);
    return;
  }
  const bounds = L.latLngBounds([state.homeLatLng]);
  state.servers.forEach(s => bounds.extend([s.lat, s.lng]));
  map.flyToBounds(bounds, { padding: [40, 40] });
});

/* Tab switching */
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    state.activeTab = tab.dataset.tab;
    renderServerList();
  });
});

/* ─── Double-click on map to add custom server ───────────────────────── */
map.on('dblclick', (e) => {
  const { lat, lng } = e.latlng;
  const ping = estimatePing(lat, lng);
  const name = `Custom ${lat.toFixed(2)}, ${lng.toFixed(2)}`;
  addServer({ name, lat, lng, ping });
});

/* ─── Init ───────────────────────────────────────────────────────────── */
function init() {
  updateLocationText();
  updateRadius(state.radiusKm);

  // Add first 6 servers from pool automatically
  for (let i = 0; i < 6; i++) addServerFromPool();

  // Refresh pings every 5 seconds for live feel
  setInterval(simulatePingUpdate, 5000);
}

init();
