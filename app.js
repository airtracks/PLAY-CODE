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

// CartoDB Dark Matter — 외부 API 키 불필요, 403 차단 없음
const tileLayer = L.tileLayer(
  'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png',
  {
    attribution: '© CartoDB © OpenStreetMap contributors',
    subdomains: 'abcd',
    maxZoom: 19,
  }
).addTo(map);

// 타일 로드 실패 시 레이블 없는 심플 다크로 폴백
tileLayer.on('tileerror', () => {
  map.removeLayer(tileLayer);
  L.tileLayer(
    'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    { attribution: '© CartoDB', subdomains: 'abcd', maxZoom: 19 }
  ).addTo(map);
});

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

/* ════════════════════════════════════════════════════════════════════════
   게임 세션 — 상대방 IP / 위치
   ════════════════════════════════════════════════════════════════════════ */

/* ─── 플레이어 풀 (지역별 닉네임 + IP 대역 + 좌표) ─────────────────────── */
const PLAYER_POOL = [
  { nick: 'xXSn1perKingXx',  region: '한국',    city: '서울',      lat: 37.56,  lng: 126.97, ipPfx: '175.223' },
  { nick: 'BattleKR_Daejin', region: '한국',    city: '부산',      lat: 35.18,  lng: 129.07, ipPfx: '110.70'  },
  { nick: 'NinjaJP_Reika',   region: '일본',    city: '도쿄',      lat: 35.68,  lng: 139.69, ipPfx: '60.100'  },
  { nick: 'OsakaGamer07',    region: '일본',    city: '오사카',    lat: 34.69,  lng: 135.50, ipPfx: '49.212'  },
  { nick: 'ShanghaiPro99',   region: '중국',    city: '상하이',    lat: 31.23,  lng: 121.47, ipPfx: '116.226' },
  { nick: 'BeijingSniper_X', region: '중국',    city: '베이징',    lat: 39.91,  lng: 116.39, ipPfx: '180.97'  },
  { nick: 'NYHedgehog99',    region: '미국',    city: '뉴욕',      lat: 40.71,  lng: -74.00, ipPfx: '72.21'   },
  { nick: 'CaliforniaDrop',  region: '미국',    city: 'LA',        lat: 34.05,  lng: -118.24,ipPfx: '67.180'  },
  { nick: 'ChicagoFragger',  region: '미국',    city: '시카고',    lat: 41.88,  lng: -87.63, ipPfx: '50.233'  },
  { nick: 'BerlinBlaster88', region: '독일',    city: '베를린',    lat: 52.52,  lng: 13.40,  ipPfx: '77.186'  },
  { nick: 'ParisProGamer',   region: '프랑스',  city: '파리',      lat: 48.86,  lng: 2.35,   ipPfx: '90.112'  },
  { nick: 'LondonClutchPRO', region: '영국',    city: '런던',      lat: 51.51,  lng: -0.13,  ipPfx: '86.148'  },
  { nick: 'SydneyShot_AU',   region: '호주',    city: '시드니',    lat: -33.87, lng: 151.21, ipPfx: '203.58'  },
  { nick: 'SingaporeElite1', region: '싱가포르',city: '싱가포르',  lat: 1.35,   lng: 103.82, ipPfx: '103.86'  },
  { nick: 'MumbaiRaider_IN', region: '인도',    city: '뭄바이',    lat: 19.08,  lng: 72.88,  ipPfx: '49.36'   },
  { nick: 'RioSniper_BR',    region: '브라질',  city: '상파울루',  lat: -23.55, lng: -46.63, ipPfx: '177.37'  },
  { nick: 'TorontoFrag_CA',  region: '캐나다',  city: '토론토',    lat: 43.65,  lng: -79.38, ipPfx: '174.5'   },
  { nick: 'MoscowBear_RU',   region: '러시아',  city: '모스크바',  lat: 55.75,  lng: 37.62,  ipPfx: '95.165'  },
  { nick: 'DubaiProwler_AE', region: 'UAE',     city: '두바이',    lat: 25.20,  lng: 55.27,  ipPfx: '185.80'  },
  { nick: 'StockholmSwede',  region: '스웨덴',  city: '스톡홀름',  lat: 59.33,  lng: 18.07,  ipPfx: '91.226'  },
];

/* ─── 세션 상태 ──────────────────────────────────────────────────────── */
const session = {
  players: [],
  active: false,
  nextId: 1,
  poolOrder: [],      // 섞인 순서로 뽑기
  autoTimer: null,
};

/* ─── IP 생성 ────────────────────────────────────────────────────────── */
function genIp(prefix) {
  const r = () => Math.floor(Math.random() * 253) + 1;
  return `${prefix}.${r()}.${r()}`;
}

/* ─── 플레이어 마커 아이콘 (다이아몬드) ──────────────────────────────── */
function makePlayerIcon(ping, blocked) {
  const color = blocked ? '#6b7280'
              : ping < 80  ? '#a78bfa'
              : ping < 150 ? '#c084fc'
              :              '#7c3aed';
  return L.divIcon({
    className: '',
    html: `<div style="
      width:13px;height:13px;
      background:${color};
      transform:rotate(45deg);
      border:2px solid rgba(255,255,255,0.25);
      box-shadow:0 0 8px ${color}99;
      cursor:pointer;
    "></div>`,
    iconSize: [13, 13],
    iconAnchor: [6, 6],
    popupAnchor: [0, -10],
  });
}

/* ─── 연결선 ─────────────────────────────────────────────────────────── */
function makeConnectionLine(player) {
  const color = player.ping < 80  ? '#a78bfa'
              : player.ping < 150 ? '#f97316'
              :                     '#ef4444';
  return L.polyline([state.homeLatLng, [player.lat, player.lng]], {
    color,
    weight: 1.5,
    opacity: 0.55,
    dashArray: '7 5',
    className: 'player-line',
  }).addTo(map);
}

/* ─── 플레이어 팝업 ──────────────────────────────────────────────────── */
function buildPlayerPopup(p) {
  const pingClass = p.ping < 80 ? 'good' : p.ping < 150 ? 'ok' : 'bad';
  const pingColor = pingClass === 'good' ? '#22c55e' : pingClass === 'ok' ? '#f97316' : '#ef4444';
  const dist = Math.round(haversineKm(state.homeLatLng[0], state.homeLatLng[1], p.lat, p.lng));
  return `
    <div style="min-width:155px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:7px;">
        <span style="font-weight:700;font-size:12px;color:#c4b5fd;">${p.nick}</span>
        <span style="font-size:9px;background:rgba(124,58,237,0.2);color:#a78bfa;padding:2px 6px;border-radius:8px;">${p.region}</span>
      </div>
      <div style="font-family:monospace;font-size:11px;color:#64748b;margin-bottom:6px;">IP: ${p.ip}</div>
      <div style="display:flex;justify-content:space-between;font-size:11px;color:#64748b;margin-bottom:3px;">
        <span>도시</span><span>${p.city}</span>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:11px;color:#64748b;margin-bottom:3px;">
        <span>거리</span><span>${dist.toLocaleString()}km</span>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:11px;color:#64748b;margin-bottom:8px;">
        <span>핑</span><span style="color:${pingColor};font-weight:700;">${p.ping}ms</span>
      </div>
      <div style="display:flex;gap:4px;">
        <button onclick="blockPlayer(${p.id})" style="flex:1;padding:4px;font-size:9px;background:#1a1e29;border:1px solid rgba(239,68,68,0.3);color:#ef4444;border-radius:5px;cursor:pointer;font-weight:700;">
          ${p.blocked ? '차단 해제' : '차단'}
        </button>
        <button onclick="kickPlayer(${p.id})" style="flex:1;padding:4px;font-size:9px;background:#1a1e29;border:1px solid #232737;color:#64748b;border-radius:5px;cursor:pointer;font-weight:700;">
          제거
        </button>
      </div>
    </div>`;
}

/* ─── 플레이어 추가 ──────────────────────────────────────────────────── */
function addPlayer(template) {
  const ping = estimatePing(template.lat, template.lng);
  const player = {
    id: session.nextId++,
    nick: template.nick,
    region: template.region,
    city: template.city,
    lat: template.lat,
    lng: template.lng,
    ip: genIp(template.ipPfx),
    ping,
    blocked: false,
    marker: null,
    line: null,
  };

  player.line = makeConnectionLine(player);
  player.marker = L.marker([player.lat, player.lng], {
    icon: makePlayerIcon(player.ping, false),
    zIndexOffset: 800,
  }).addTo(map);
  player.marker.on('click', () => {
    player.marker.bindPopup(buildPlayerPopup(player)).openPopup();
  });

  session.players.push(player);
  renderPlayerList();
  updateSessionCount();
  return player;
}

/* ─── 플레이어 제거 ──────────────────────────────────────────────────── */
function removePlayerById(id) {
  const idx = session.players.findIndex(p => p.id === id);
  if (idx === -1) return;
  const p = session.players[idx];
  if (p.marker) map.removeLayer(p.marker);
  if (p.line)   map.removeLayer(p.line);
  session.players.splice(idx, 1);
  renderPlayerList();
  updateSessionCount();
  map.closePopup();
}

/* ─── 전역 콜백 ──────────────────────────────────────────────────────── */
window.blockPlayer = function (id) {
  const p = session.players.find(p => p.id === id);
  if (!p) return;
  p.blocked = !p.blocked;
  p.marker.setIcon(makePlayerIcon(p.ping, p.blocked));
  // 연결선 색 업데이트
  if (p.line) map.removeLayer(p.line);
  if (!p.blocked) {
    p.line = makeConnectionLine(p);
  } else {
    p.line = L.polyline([state.homeLatLng, [p.lat, p.lng]], {
      color: '#6b7280', weight: 1, opacity: 0.3, dashArray: '4 6',
    }).addTo(map);
  }
  renderPlayerList();
  map.closePopup();
};

window.kickPlayer = function (id) {
  removePlayerById(id);
};

window.focusPlayer = function (id) {
  const p = session.players.find(p => p.id === id);
  if (!p) return;
  map.flyTo([p.lat, p.lng], 6, { duration: 0.8 });
  setTimeout(() => {
    p.marker.bindPopup(buildPlayerPopup(p)).openPopup();
  }, 900);
};

/* ─── 플레이어 목록 렌더링 ───────────────────────────────────────────── */
function renderPlayerList() {
  const list = document.getElementById('playerList');
  if (session.players.length === 0) {
    list.innerHTML = `
      <div class="empty-state" style="min-height:90px;">
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
          <circle cx="16" cy="10" r="5" stroke="#555" stroke-width="1.5"/>
          <path d="M4 28c0-6.63 5.37-12 12-12s12 5.37 12 12" stroke="#555" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        <p>${session.active ? '상대방 감지 중...' : '세션 시뮬 버튼으로<br/>대전 상대를 감지하세요'}</p>
      </div>`;
    return;
  }

  list.innerHTML = session.players.map(p => {
    const pingClass = p.ping < 80 ? 'good' : p.ping < 150 ? 'ok' : 'bad';
    const dist = Math.round(haversineKm(state.homeLatLng[0], state.homeLatLng[1], p.lat, p.lng));
    return `
      <div class="player-card${p.blocked ? ' blocked-player' : ''}" onclick="focusPlayer(${p.id})">
        <div class="player-card-top">
          <span class="player-nick">${p.nick}</span>
          <span class="player-region-badge">${p.region}</span>
        </div>
        <div class="player-ip">⌗ ${p.ip}</div>
        <div class="player-meta">
          <span>${p.city} · ${dist.toLocaleString()}km</span>
          <span class="ping-value ping-${pingClass}">${p.ping}ms</span>
        </div>
        <div class="player-actions">
          <button class="player-action-btn ${p.blocked ? 'unblock-btn' : 'block-btn'}"
            onclick="event.stopPropagation();blockPlayer(${p.id})">
            ${p.blocked ? '차단 해제' : '차단'}
          </button>
          <button class="player-action-btn kick-btn"
            onclick="event.stopPropagation();kickPlayer(${p.id})">
            제거
          </button>
        </div>
      </div>`;
  }).join('');
}

/* ─── 세션 카운트 표시 ───────────────────────────────────────────────── */
function updateSessionCount() {
  document.getElementById('sessionCount').textContent =
    `${session.players.length}명 접속`;
}

/* ─── 세션 시뮬레이션 ────────────────────────────────────────────────── */
function shufflePool() {
  session.poolOrder = [...Array(PLAYER_POOL.length).keys()]
    .sort(() => Math.random() - 0.5);
}

function startSession() {
  if (session.active) return;
  session.active = true;
  shufflePool();

  document.getElementById('btnStartSession').disabled = true;
  document.getElementById('btnStopSession').disabled = false;

  // 초기 2~4명 즉시 접속
  const initialCount = 2 + Math.floor(Math.random() * 3);
  for (let i = 0; i < initialCount && session.poolOrder.length > 0; i++) {
    const idx = session.poolOrder.shift();
    addPlayer(PLAYER_POOL[idx]);
  }

  // 이후 8~15초마다 입/퇴장
  session.autoTimer = setInterval(() => {
    const action = Math.random();
    if (action < 0.45 && session.poolOrder.length > 0 && session.players.length < 8) {
      // 새 플레이어 참가
      const idx = session.poolOrder.shift();
      addPlayer(PLAYER_POOL[idx]);
    } else if (action < 0.7 && session.players.length > 1) {
      // 랜덤 플레이어 퇴장
      const p = session.players[Math.floor(Math.random() * session.players.length)];
      removePlayerById(p.id);
    }
    // 핑 드리프트
    session.players.forEach(p => {
      const drift = Math.floor((Math.random() - 0.5) * 12);
      p.ping = Math.max(1, Math.min(999, p.ping + drift));
      p.marker.setIcon(makePlayerIcon(p.ping, p.blocked));
    });
    renderPlayerList();
  }, 9000 + Math.random() * 6000);
}

function stopSession() {
  session.active = false;
  clearInterval(session.autoTimer);
  session.autoTimer = null;
  [...session.players].forEach(p => removePlayerById(p.id));
  session.nextId = 1;
  shufflePool();

  document.getElementById('btnStartSession').disabled = false;
  document.getElementById('btnStopSession').disabled = true;
}

/* ─── Init ───────────────────────────────────────────────────────────── */
function init() {
  updateLocationText();
  updateRadius(state.radiusKm);

  // Add first 6 servers from pool automatically
  for (let i = 0; i < 6; i++) addServerFromPool();

  // Refresh pings every 5 seconds for live feel
  setInterval(simulatePingUpdate, 5000);

  // 세션 버튼
  document.getElementById('btnStartSession').addEventListener('click', startSession);
  document.getElementById('btnStopSession').addEventListener('click', stopSession);

  // 홈 드래그 시 플레이어 연결선 재계산
  homeMarker.on('drag', () => {
    const ll = homeMarker.getLatLng();
    session.players.forEach(p => {
      if (p.line) {
        p.line.setLatLngs([ll, [p.lat, p.lng]]);
      }
    });
  });

  updateSessionCount();
}

init();
