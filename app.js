/* ──────────────────────────────────────────────────────────────────────
   GeoFilter Widget — DumaOS Style
   ────────────────────────────────────────────────────────────────────── */
'use strict';

/* ─── State ──────────────────────────────────────────────────────────── */
const state = {
  filterEnabled: true,
  strictMode:    false,
  homeLatLng:    [37.5665, 126.9780],
  radiusKm:      1000,
  maxPing:       80,
  servers:       [],
  savedIPs:      [],       // { id, ip, name, lat, lng, country, city, ping, blocked, marker, line }
  activeTab:     'all',
  nextServerId:  1,
  nextIpId:      1,
  renameTarget:  null,     // 현재 이름 변경 중인 IP id
};

/* ─── Map ────────────────────────────────────────────────────────────── */
const map = L.map('map', { center: state.homeLatLng, zoom: 4 });

const tileLayer = L.tileLayer(
  'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png',
  { attribution: '© CartoDB © OpenStreetMap', subdomains: 'abcd', maxZoom: 19 }
).addTo(map);

tileLayer.on('tileerror', () => {
  map.removeLayer(tileLayer);
  L.tileLayer(
    'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    { attribution: '© CartoDB', subdomains: 'abcd', maxZoom: 19 }
  ).addTo(map);
});

/* ─── IP 유효성 검사 ──────────────────────────────────────────────────── */
function isValidIp(ip) {
  return /^(\d{1,3}\.){3}\d{1,3}$/.test(ip) &&
    ip.split('.').every(n => Number(n) >= 0 && Number(n) <= 255);
}

/* ─── IP 지오코딩 (ip-api.com 무료 API) ────────────────────────────── */
async function geolocateIp(ip) {
  try {
    const res = await fetch(
      `http://ip-api.com/json/${ip}?fields=status,country,regionName,city,lat,lon,isp,query`,
      { signal: AbortSignal.timeout(6000) }
    );
    const data = await res.json();
    if (data.status === 'success') {
      return {
        lat:     data.lat,
        lng:     data.lon,
        country: data.country,
        city:    data.city || data.regionName || '알 수 없음',
        isp:     data.isp || '',
      };
    }
  } catch (_) {}
  return null;
}

/* ─── Haversine 거리 ─────────────────────────────────────────────────── */
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

/* ─── 핑 추정 (거리 기반) ────────────────────────────────────────────── */
function estimatePing(lat, lng) {
  const dist = haversineKm(state.homeLatLng[0], state.homeLatLng[1], lat, lng);
  return Math.min(Math.round(dist / 40 + Math.random() * 15 + 5), 999);
}

/* ════════════════════════════════════════════════════════════════════════
   홈 마커 & 반경 원
   ════════════════════════════════════════════════════════════════════════ */
function makeHomeIcon() {
  return L.divIcon({
    className: '',
    html: `<div style="position:relative;width:22px;height:22px;">
      <div class="home-marker-ring"></div>
      <div style="width:22px;height:22px;background:#00d4ff;border-radius:50%;
        border:3px solid #fff;box-shadow:0 0 12px rgba(0,212,255,.8);
        display:flex;align-items:center;justify-content:center;position:relative;z-index:2;">
        <svg width="10" height="10" viewBox="0 0 14 14" fill="white">
          <path d="M7 1L1 6h2v7h3V9h2v4h3V6h2L7 1z"/>
        </svg>
      </div>
    </div>`,
    iconSize: [22, 22], iconAnchor: [11, 11], popupAnchor: [0, -14],
  });
}

const homeMarker = L.marker(state.homeLatLng, {
  icon: makeHomeIcon(), draggable: true, zIndexOffset: 1000,
}).addTo(map).bindPopup('<b>내 위치</b><br/>드래그하여 이동');

const radiusCircle = L.circle(state.homeLatLng, {
  radius: state.radiusKm * 1000,
  color: '#00d4ff', fillColor: '#00d4ff',
  fillOpacity: 0.05, weight: 1.5, dashArray: '6 4',
}).addTo(map);

homeMarker.on('drag', () => {
  const ll = homeMarker.getLatLng();
  radiusCircle.setLatLng(ll);
  // IP 연결선 실시간 갱신
  state.savedIPs.forEach(entry => {
    if (entry.line) entry.line.setLatLngs([ll, [entry.lat, entry.lng]]);
  });
});

homeMarker.on('dragend', () => {
  const ll = homeMarker.getLatLng();
  state.homeLatLng = [ll.lat, ll.lng];
  updateLocationText();
  updateAllServerMarkers();
  // IP 핑 재추정 후 렌더
  state.savedIPs.forEach(e => {
    e.ping = estimatePing(e.lat, e.lng);
    updateIpMarker(e);
  });
  renderIpList();
  renderServerList();
  updateStats();
});

/* ════════════════════════════════════════════════════════════════════════
   상대방 IP 마커 & 연결선
   ════════════════════════════════════════════════════════════════════════ */
function makePlayerIcon(ping, blocked) {
  const color = blocked    ? '#6b7280'
              : ping < 80  ? '#a78bfa'
              : ping < 150 ? '#c084fc'
              :              '#7c3aed';
  return L.divIcon({
    className: '',
    html: `<div style="
      width:13px;height:13px;background:${color};
      transform:rotate(45deg);
      border:2px solid rgba(255,255,255,.25);
      box-shadow:0 0 8px ${color}99;cursor:pointer;
    "></div>`,
    iconSize: [13, 13], iconAnchor: [6, 6], popupAnchor: [0, -10],
  });
}

function makeConnectionLine(entry) {
  const color = entry.blocked ? '#6b7280'
              : entry.ping < 80  ? '#a78bfa'
              : entry.ping < 150 ? '#f97316'
              :                    '#ef4444';
  return L.polyline([state.homeLatLng, [entry.lat, entry.lng]], {
    color, weight: 1.5, opacity: entry.blocked ? 0.25 : 0.55,
    dashArray: '7 5', className: 'player-line',
  }).addTo(map);
}

function updateIpMarker(entry) {
  if (entry.marker) entry.marker.setIcon(makePlayerIcon(entry.ping, entry.blocked));
  if (entry.line) {
    map.removeLayer(entry.line);
    entry.line = makeConnectionLine(entry);
  }
}

function buildIpPopup(entry) {
  const pc = entry.ping < 80 ? '#22c55e' : entry.ping < 150 ? '#f97316' : '#ef4444';
  const dist = Math.round(haversineKm(state.homeLatLng[0], state.homeLatLng[1], entry.lat, entry.lng));
  return `
    <div style="min-width:160px;">
      <div style="font-weight:700;font-size:13px;color:#c4b5fd;margin-bottom:6px;">${entry.name}</div>
      <div style="font-family:monospace;font-size:11px;color:#64748b;margin-bottom:6px;">${entry.ip}</div>
      <div style="display:flex;justify-content:space-between;font-size:11px;color:#64748b;margin-bottom:3px;">
        <span>위치</span><span>${entry.city}, ${entry.country}</span>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:11px;color:#64748b;margin-bottom:3px;">
        <span>거리</span><span>${dist.toLocaleString()}km</span>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:11px;color:#64748b;margin-bottom:8px;">
        <span>핑</span><span style="color:${pc};font-weight:700;">${entry.ping}ms</span>
      </div>
      <div style="display:flex;gap:5px;">
        <button onclick="blockIp(${entry.id})"
          style="flex:1;padding:4px;font-size:9px;background:#1a1e29;
          border:1px solid rgba(239,68,68,.3);color:#ef4444;
          border-radius:5px;cursor:pointer;font-weight:700;">
          ${entry.blocked ? '차단 해제' : '차단'}
        </button>
        <button onclick="deleteIp(${entry.id})"
          style="flex:1;padding:4px;font-size:9px;background:#1a1e29;
          border:1px solid #232737;color:#64748b;
          border-radius:5px;cursor:pointer;font-weight:700;">
          삭제
        </button>
      </div>
    </div>`;
}

/* ─── IP 등록 ─────────────────────────────────────────────────────────── */
async function registerIp(rawIp, customName) {
  const ip = rawIp.trim();
  const msgEl = document.getElementById('ipFormMsg');
  const btn   = document.getElementById('btnAddIp');

  if (!isValidIp(ip)) {
    setMsg('유효한 IPv4 주소를 입력하세요', 'err');
    document.getElementById('ipInput').classList.add('error');
    return;
  }
  if (state.savedIPs.find(e => e.ip === ip)) {
    setMsg('이미 등록된 IP입니다', 'err');
    return;
  }

  setMsg('위치 조회 중...', 'loading');
  btn.disabled = true;

  const geo = await geolocateIp(ip);
  btn.disabled = false;

  if (!geo) {
    setMsg('위치를 찾을 수 없습니다 (사설 IP거나 조회 실패)', 'err');
    return;
  }

  const ping = estimatePing(geo.lat, geo.lng);
  const name = customName.trim() || ip;

  const entry = {
    id:      state.nextIpId++,
    ip,
    name,
    lat:     geo.lat,
    lng:     geo.lng,
    country: geo.country,
    city:    geo.city,
    isp:     geo.isp,
    ping,
    blocked: false,
    marker:  null,
    line:    null,
  };

  // 지도 마커 & 연결선 생성
  entry.line = makeConnectionLine(entry);
  entry.marker = L.marker([entry.lat, entry.lng], {
    icon: makePlayerIcon(ping, false),
    zIndexOffset: 800,
  }).addTo(map);
  entry.marker.on('click', () => {
    entry.marker.bindPopup(buildIpPopup(entry)).openPopup();
  });

  state.savedIPs.push(entry);

  // 지도 해당 위치로 이동
  map.flyTo([entry.lat, entry.lng], 6, { duration: 1 });

  // 폼 초기화
  document.getElementById('ipInput').value    = '';
  document.getElementById('ipNameInput').value = '';
  document.getElementById('ipInput').classList.remove('error');
  setMsg(`✓ ${entry.city}, ${entry.country} 등록됨`, 'ok');
  setTimeout(() => setMsg('', ''), 3000);

  renderIpList();
  updateStats();
}

function setMsg(text, type) {
  const el = document.getElementById('ipFormMsg');
  el.textContent  = text;
  el.className    = `ip-form-msg ${type}`;
}

/* ─── IP 전역 액션 ───────────────────────────────────────────────────── */
window.blockIp = function (id) {
  const entry = state.savedIPs.find(e => e.id === id);
  if (!entry) return;
  entry.blocked = !entry.blocked;
  updateIpMarker(entry);
  renderIpList();
  map.closePopup();
};

window.deleteIp = function (id) {
  const idx = state.savedIPs.findIndex(e => e.id === id);
  if (idx === -1) return;
  const entry = state.savedIPs[idx];
  if (entry.marker) map.removeLayer(entry.marker);
  if (entry.line)   map.removeLayer(entry.line);
  state.savedIPs.splice(idx, 1);
  renderIpList();
  updateStats();
  map.closePopup();
};

window.focusIp = function (id) {
  const entry = state.savedIPs.find(e => e.id === id);
  if (!entry) return;
  map.flyTo([entry.lat, entry.lng], 6, { duration: 0.9 });
  setTimeout(() => {
    entry.marker.bindPopup(buildIpPopup(entry)).openPopup();
  }, 950);
};

window.openRename = function (id) {
  state.renameTarget = id;
  const entry = state.savedIPs.find(e => e.id === id);
  if (!entry) return;
  document.getElementById('renameInput').value = entry.name;
  document.getElementById('renameModal').style.display = 'flex';
  document.getElementById('renameInput').select();
};

/* ─── IP 목록 렌더링 ─────────────────────────────────────────────────── */
function renderIpList() {
  const list  = document.getElementById('ipList');
  const count = document.getElementById('ipListCount');
  count.textContent = `${state.savedIPs.length}개`;
  document.getElementById('savedIpCount').textContent = state.savedIPs.length;

  if (state.savedIPs.length === 0) {
    list.innerHTML = `
      <div class="empty-state ip-empty">
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
          <rect x="4" y="8" width="24" height="16" rx="3" stroke="#444" stroke-width="1.5"/>
          <path d="M10 14h12M10 18h8" stroke="#444" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        <p>IP를 입력하여<br/>상대방을 등록하세요</p>
      </div>`;
    return;
  }

  list.innerHTML = state.savedIPs.map(e => {
    const pc  = e.ping < 80 ? 'good' : e.ping < 150 ? 'ok' : 'bad';
    const dist = Math.round(haversineKm(state.homeLatLng[0], state.homeLatLng[1], e.lat, e.lng));
    return `
      <div class="ip-card${e.blocked ? ' ip-blocked' : ''}" onclick="focusIp(${e.id})">
        <div class="ip-card-top">
          <span class="ip-card-name" title="${e.name}">${e.name}</span>
          <span class="ip-country-badge">${e.country}</span>
        </div>
        <div class="ip-addr">⌗ ${e.ip}</div>
        <div class="ip-meta">
          <span>${e.city} · ${dist.toLocaleString()}km</span>
          <span class="ping-${pc}">${e.ping}ms</span>
        </div>
        <div class="ip-card-actions">
          <button class="ip-act-btn rename-btn"
            onclick="event.stopPropagation();openRename(${e.id})">이름변경</button>
          <button class="ip-act-btn ${e.blocked ? 'unblock-btn' : 'block-btn'}"
            onclick="event.stopPropagation();blockIp(${e.id})">
            ${e.blocked ? '차단해제' : '차단'}
          </button>
          <button class="ip-act-btn del-btn"
            onclick="event.stopPropagation();deleteIp(${e.id})">삭제</button>
        </div>
      </div>`;
  }).join('');
}

/* ════════════════════════════════════════════════════════════════════════
   게임 서버 (기존 기능)
   ════════════════════════════════════════════════════════════════════════ */
function makeServerIcon(color, ping) {
  const size = ping < 60 ? 14 : ping < 120 ? 12 : 10;
  return L.divIcon({
    className: '',
    html: `<div style="
      width:${size}px;height:${size}px;background:${color};
      border-radius:50%;border:2px solid rgba(255,255,255,.2);
      box-shadow:0 0 8px ${color}88;cursor:pointer;
    "></div>`,
    iconSize: [size, size], iconAnchor: [size/2, size/2], popupAnchor: [0, -(size/2+4)],
  });
}

function getServerStatus(server) {
  if (!state.filterEnabled) return 'allowed';
  const dist = haversineKm(state.homeLatLng[0], state.homeLatLng[1], server.lat, server.lng);
  const inRadius = dist <= state.radiusKm;
  const pingOk   = !state.strictMode || server.ping <= state.maxPing;
  return inRadius && pingOk ? 'allowed' : 'blocked';
}
function serverColor(status) {
  return status === 'allowed' ? '#22c55e' : '#ef4444';
}

function buildServerPopup(server, status) {
  const pc   = server.ping < 60 ? '#22c55e' : server.ping < 120 ? '#f97316' : '#ef4444';
  const dist = Math.round(haversineKm(state.homeLatLng[0], state.homeLatLng[1], server.lat, server.lng));
  return `
    <div style="min-width:140px;">
      <div style="font-weight:700;font-size:13px;margin-bottom:6px;">${server.name}</div>
      <div style="display:flex;justify-content:space-between;font-size:11px;color:#64748b;margin-bottom:3px;">
        <span>핑</span><span style="color:${pc};font-weight:600;">${server.ping}ms</span>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:11px;color:#64748b;margin-bottom:3px;">
        <span>거리</span><span>${dist.toLocaleString()}km</span>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:11px;color:#64748b;margin-bottom:8px;">
        <span>상태</span>
        <span style="color:${serverColor(status)};font-weight:600;font-size:10px;text-transform:uppercase;">
          ${status === 'allowed' ? '허용' : '차단'}
        </span>
      </div>
      <button onclick="removeServer(${server.id})"
        style="width:100%;padding:4px;font-size:9px;background:#1a1e29;
        border:1px solid #232737;color:#64748b;border-radius:5px;cursor:pointer;font-weight:700;">
        삭제
      </button>
    </div>`;
}

function addServer({ name, lat, lng, ping }) {
  const id     = state.nextServerId++;
  const server = { id, name, lat, lng, ping, marker: null };
  const status = getServerStatus(server);
  const marker = L.marker([lat, lng], {
    icon: makeServerIcon(serverColor(status), ping), zIndexOffset: 500,
  }).addTo(map);
  marker.on('click', () => {
    marker.bindPopup(buildServerPopup(server, getServerStatus(server))).openPopup();
  });
  server.marker = marker;
  state.servers.push(server);
  renderServerList();
  updateStats();
  return server;
}

function updateServerMarker(server) {
  const status = getServerStatus(server);
  if (server.marker) server.marker.setIcon(makeServerIcon(serverColor(status), server.ping));
}

function updateAllServerMarkers() {
  state.servers.forEach(s => {
    s.ping = estimatePing(s.lat, s.lng);
    updateServerMarker(s);
  });
}

window.removeServer = function (id) {
  const idx = state.servers.findIndex(s => s.id === id);
  if (idx === -1) return;
  if (state.servers[idx].marker) map.removeLayer(state.servers[idx].marker);
  state.servers.splice(idx, 1);
  renderServerList();
  updateStats();
  map.closePopup();
};

window.focusServer = function (id) {
  const s = state.servers.find(s => s.id === id);
  if (!s) return;
  map.flyTo([s.lat, s.lng], 6, { duration: 0.8 });
  setTimeout(() => s.marker.bindPopup(buildServerPopup(s, getServerStatus(s))).openPopup(), 900);
};

const SERVER_POOL = [
  { name: 'Seoul KR-1',      lat: 37.56,  lng: 126.97 },
  { name: 'Seoul KR-2',      lat: 37.49,  lng: 127.02 },
  { name: 'Tokyo JP-1',      lat: 35.68,  lng: 139.69 },
  { name: 'Tokyo JP-2',      lat: 35.71,  lng: 139.72 },
  { name: 'Singapore SG-1',  lat: 1.35,   lng: 103.82 },
  { name: 'Hong Kong HK-1',  lat: 22.39,  lng: 114.10 },
  { name: 'Sydney AU-1',     lat: -33.87, lng: 151.21 },
  { name: 'Frankfurt EU-1',  lat: 50.11,  lng: 8.68   },
  { name: 'Amsterdam EU-2',  lat: 52.37,  lng: 4.90   },
  { name: 'London EU-3',     lat: 51.51,  lng: -0.13  },
  { name: 'N.Virginia US-1', lat: 38.95,  lng: -77.45 },
  { name: 'Oregon US-2',     lat: 45.52,  lng: -122.67},
  { name: 'São Paulo BR-1',  lat: -23.55, lng: -46.63 },
  { name: 'Mumbai IN-1',     lat: 19.08,  lng: 72.88  },
];
let poolIndex = 0;

function addServerFromPool() {
  if (poolIndex >= SERVER_POOL.length) return;
  const t = SERVER_POOL[poolIndex++];
  addServer({ name: t.name, lat: t.lat, lng: t.lng, ping: estimatePing(t.lat, t.lng) });
}

function renderServerList() {
  const list = document.getElementById('serverList');
  const tab  = state.activeTab;

  let servers = state.servers.map(s => ({ ...s, status: getServerStatus(s) }));
  if (tab === 'allowed') servers = servers.filter(s => s.status === 'allowed');
  if (tab === 'blocked')  servers = servers.filter(s => s.status === 'blocked');

  if (servers.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
          <circle cx="18" cy="18" r="16" stroke="#444" stroke-width="1.5"/>
          <path d="M11 18h14M18 11v14" stroke="#444" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        <p>${tab === 'all' ? '+ 버튼으로 서버 추가' : '해당 서버 없음'}</p>
      </div>`;
    return;
  }

  list.innerHTML = servers.map(s => {
    const pc   = s.ping < 60 ? 'good' : s.ping < 120 ? 'ok' : 'bad';
    const dist = Math.round(haversineKm(state.homeLatLng[0], state.homeLatLng[1], s.lat, s.lng));
    return `
      <div class="server-card ${s.status}" onclick="focusServer(${s.id})">
        <div class="server-card-header">
          <span class="server-name">${s.name}</span>
          <span class="server-status-badge badge-${s.status}">${s.status === 'allowed' ? '허용' : '차단'}</span>
        </div>
        <div class="server-meta">
          <span>${dist.toLocaleString()}km</span>
          <span class="ping-${pc}">${s.ping}ms</span>
        </div>
        <div class="server-actions">
          <button class="action-btn remove" onclick="event.stopPropagation();removeServer(${s.id})">삭제</button>
        </div>
      </div>`;
  }).join('');
}

/* ─── 통계 ───────────────────────────────────────────────────────────── */
function updateStats() {
  const total   = state.servers.length;
  const allowed = state.servers.filter(s => getServerStatus(s) === 'allowed').length;
  const blocked = total - allowed;
  document.getElementById('totalServers').textContent   = total;
  document.getElementById('allowedServers').textContent = allowed;
  document.getElementById('blockedServers').textContent = blocked;
  document.getElementById('savedIpCount').textContent   = state.savedIPs.length;
}

/* ─── 위치 텍스트 ─────────────────────────────────────────────────────── */
function updateLocationText() {
  const [lat, lng] = state.homeLatLng;
  document.getElementById('locationText').textContent = `${lat.toFixed(3)}, ${lng.toFixed(3)}`;
}

function geolocate() {
  if (!navigator.geolocation) { updateLocationText(); return; }
  navigator.geolocation.getCurrentPosition(pos => {
    state.homeLatLng = [pos.coords.latitude, pos.coords.longitude];
    homeMarker.setLatLng(state.homeLatLng);
    radiusCircle.setLatLng(state.homeLatLng);
    map.flyTo(state.homeLatLng, 5);
    updateLocationText();
    updateAllServerMarkers();
    renderServerList();
    updateStats();
  }, () => updateLocationText());
}

/* ─── 반경 업데이트 ──────────────────────────────────────────────────── */
function updateRadius(km) {
  state.radiusKm = km;
  radiusCircle.setRadius(km * 1000);
  document.getElementById('radiusValue').textContent = km.toLocaleString();
  updateAllServerMarkers();
  renderServerList();
  updateStats();
}

/* ─── 핑 드리프트 (5초) ─────────────────────────────────────────────── */
function driftPings() {
  state.servers.forEach(s => {
    s.ping = Math.max(1, Math.min(999, s.ping + Math.round((Math.random() - 0.5) * 10)));
    updateServerMarker(s);
  });
  state.savedIPs.forEach(e => {
    e.ping = Math.max(1, Math.min(999, e.ping + Math.round((Math.random() - 0.5) * 8)));
    if (e.marker) e.marker.setIcon(makePlayerIcon(e.ping, e.blocked));
  });
  renderServerList();
  renderIpList();
}

/* ════════════════════════════════════════════════════════════════════════
   이벤트 바인딩
   ════════════════════════════════════════════════════════════════════════ */

// 필터 토글
document.getElementById('filterToggle').addEventListener('change', e => {
  state.filterEnabled = e.target.checked;
  document.getElementById('statusDot').classList.toggle('inactive', !state.filterEnabled);
  document.getElementById('statusText').textContent = state.filterEnabled ? '활성화' : '비활성화';
  updateAllServerMarkers();
  renderServerList();
  updateStats();
});

// 반경 슬라이더
document.getElementById('radiusSlider').addEventListener('input', e => {
  updateRadius(Number(e.target.value));
});

// 최대 핑
document.getElementById('maxPing').addEventListener('input', e => {
  state.maxPing = Number(e.target.value) || 80;
  if (state.strictMode) { updateAllServerMarkers(); renderServerList(); updateStats(); }
});

// 엄격 모드
document.getElementById('strictMode').addEventListener('change', e => {
  state.strictMode = e.target.checked;
  updateAllServerMarkers();
  renderServerList();
  updateStats();
});

// 위치 새로고침
document.getElementById('refreshLocation').addEventListener('click', geolocate);

// 서버 추가 버튼
document.getElementById('btnAddServer').addEventListener('click', () => {
  if (poolIndex >= SERVER_POOL.length) return;
  addServerFromPool();
});

// 서버 전체 삭제
document.getElementById('btnClearAll').addEventListener('click', () => {
  state.servers.forEach(s => { if (s.marker) map.removeLayer(s.marker); });
  state.servers = [];
  poolIndex = 0;
  state.nextServerId = 1;
  renderServerList();
  updateStats();
});

// 맞춤 보기
document.getElementById('btnFitBounds').addEventListener('click', () => {
  const all = [...state.servers, ...state.savedIPs];
  if (all.length === 0) { map.flyTo(state.homeLatLng, 4); return; }
  const bounds = L.latLngBounds([state.homeLatLng]);
  all.forEach(s => bounds.extend([s.lat, s.lng]));
  map.flyToBounds(bounds, { padding: [40, 40] });
});

// 서버 탭
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    state.activeTab = tab.dataset.tab;
    renderServerList();
  });
});

// 지도 더블클릭 → 커스텀 서버 추가
map.on('dblclick', e => {
  const { lat, lng } = e.latlng;
  addServer({ name: `Custom ${lat.toFixed(2)}, ${lng.toFixed(2)}`, lat, lng, ping: estimatePing(lat, lng) });
});

// ── IP 폼 입력 ──
document.getElementById('ipInput').addEventListener('input', () => {
  document.getElementById('ipInput').classList.remove('error');
});

document.getElementById('ipInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('ipNameInput').focus();
});

document.getElementById('ipNameInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    registerIp(
      document.getElementById('ipInput').value,
      document.getElementById('ipNameInput').value
    );
  }
});

document.getElementById('btnAddIp').addEventListener('click', () => {
  registerIp(
    document.getElementById('ipInput').value,
    document.getElementById('ipNameInput').value
  );
});

// ── 이름 변경 모달 ──
document.getElementById('btnRenameCancel').addEventListener('click', () => {
  document.getElementById('renameModal').style.display = 'none';
  state.renameTarget = null;
});

document.getElementById('btnRenameConfirm').addEventListener('click', () => {
  const newName = document.getElementById('renameInput').value.trim();
  if (!newName) return;
  const entry = state.savedIPs.find(e => e.id === state.renameTarget);
  if (entry) { entry.name = newName; renderIpList(); }
  document.getElementById('renameModal').style.display = 'none';
  state.renameTarget = null;
});

document.getElementById('renameInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('btnRenameConfirm').click();
  if (e.key === 'Escape') document.getElementById('btnRenameCancel').click();
});

document.getElementById('renameModal').addEventListener('click', e => {
  if (e.target === document.getElementById('renameModal'))
    document.getElementById('btnRenameCancel').click();
});

/* ─── Init ───────────────────────────────────────────────────────────── */
function init() {
  updateLocationText();
  updateRadius(state.radiusKm);
  for (let i = 0; i < 6; i++) addServerFromPool();
  setInterval(driftPings, 5000);
}

init();
