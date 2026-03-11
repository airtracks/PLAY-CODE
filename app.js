'use strict';

/* ═══════════════════════════════════════════════════════════════
   픽셀 RPG — 슈퍼패미콤 스타일 레트로 어드벤처
   ═══════════════════════════════════════════════════════════════ */

// ─── CONFIG ───────────────────────────────────────────────────
const TILE = 16;
const VIEW_W = 16, VIEW_H = 12;
const CW = VIEW_W * TILE;       // 256
const CH = VIEW_H * TILE + 32;  // 224 (192 game + 32 status bar)
const MAP_W = 32, MAP_H = 22;
const SCALE = 3;

// ─── TILE IDs ────────────────────────────────────────────────
const T = Object.freeze({
  GRASS:0, WATER:1, TREE:2, MOUNTAIN:3, PATH:4,
  SAND:5, FOREST:6, WALL:7, DOOR:8, FLOOR:9, CAVE:10
});
const WALKABLE = new Set([0,4,5,6,8,9,10]);
const DANGER   = new Set([6,10]);

// ─── WORLD MAP 32×22 ─────────────────────────────────────────
const WORLD = [
  [3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3],
  [3,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,3],
  [3,6,2,2,2,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,2,2,2,2,6,6,6,3],
  [3,6,2,2,2,2,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,2,2,2,2,2,2,2,6,6,6,3],
  [3,6,6,2,2,2,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,2,2,2,2,6,6,6,6,6,6,3],
  [3,6,6,6,2,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,2,2,6,6,6,6,6,6,6,3],
  [3,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,3],
  [3,0,0,0,0,0,0,0,0,0,0,0,0,0,4,4,4,4,0,0,0,0,0,0,0,0,0,0,0,0,0,3],
  [3,0,0,0,0,0,0,0,0,0,0,0,0,0,4,4,4,4,0,0,0,0,0,0,0,0,0,0,0,0,0,3],
  [3,0,0,0,0,0,0,0,0,0,0,0,0,0,4,4,4,4,0,0,0,0,0,0,0,0,0,0,0,0,0,3],
  [3,0,0,0,0,0,0,0,0,0,0,0,0,0,4,4,4,4,0,0,0,0,0,0,0,0,0,0,0,0,0,3],
  [3,0,0,0,7,7,7,0,0,0,0,0,0,0,4,4,4,4,0,0,0,7,7,7,0,0,0,0,0,0,0,3],
  [3,0,0,0,7,9,7,0,0,0,0,0,0,0,4,4,4,4,0,0,0,7,9,7,0,0,0,0,0,0,0,3],
  [3,0,0,0,7,8,7,0,0,0,0,0,0,0,4,4,4,4,0,0,0,7,8,7,0,0,0,0,0,0,0,3],
  [3,0,0,0,0,0,0,0,0,0,0,0,0,0,4,4,4,4,0,0,0,0,0,0,0,0,0,0,0,0,0,3],
  [3,0,0,0,0,0,0,0,0,0,0,0,0,0,4,4,4,4,0,0,0,0,0,0,0,0,0,0,0,0,0,3],
  [3,0,0,0,0,0,0,0,0,0,0,0,0,0,4,4,4,4,0,0,0,0,0,0,0,0,0,0,0,0,0,3],
  [3,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,3],
  [3,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,3],
  [3,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,10,0,0,0,0,0,0,0,0,0,3],
  [3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3],
  [3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3],
];

// ─── NPC DATA ────────────────────────────────────────────────
const NPC_LIST = [
  { id:0, x:10, y:10, sprite:'elder', name:'마을 어른',
    lines:['북쪽 숲에는 강한 몬스터가 살고 있다네.','남쪽 동굴엔 더 위험한 존재가...','여관에서 쉬면 체력이 회복된다네.'] },
  { id:1, x:24, y:10, sprite:'girl', name:'마을 소녀',
    lines:['이 마을의 이름은 "빛의 마을"이에요.','저 동굴에는 전설의 보물이 있다고 해요!','조심해서 가세요~'] },
  { id:2, x:5,  y:12, sprite:'innkeeper', name:'여관 주인',
    lines:['어서오세요! 이곳은 빛의 여관입니다.','[여관] 체력과 마법이 회복되었습니다!','편히 쉬어 가세요.'], isInnkeeper:true },
  { id:3, x:22, y:12, sprite:'merchant', name:'상인',
    lines:['어서오세요, 여행자!','[상점] 포션을 1개 드립니다.','다음에 또 오세요!'], isShop:true },
];

// ─── ENEMY DATA ──────────────────────────────────────────────
const ENEMIES = {
  slime:   { name:'슬라임',    hp:12, atk:4,  def:0, exp:6,  gold:3,  sprite:'slime',   zone:'forest' },
  goblin:  { name:'고블린',    hp:22, atk:8,  def:2, exp:15, gold:8,  sprite:'goblin',  zone:'forest' },
  bat:     { name:'동굴 박쥐', hp:16, atk:7,  def:1, exp:10, gold:5,  sprite:'bat',     zone:'cave'   },
  knight:  { name:'어둠 기사', hp:50, atk:14, def:6, exp:60, gold:40, sprite:'knight',  zone:'cave'   },
};

// ─── CANVAS SETUP ────────────────────────────────────────────
const canvas = document.getElementById('c');
const ctx    = canvas.getContext('2d');
canvas.width  = CW;
canvas.height = CH;
canvas.style.width  = CW * SCALE + 'px';
canvas.style.height = CH * SCALE + 'px';
ctx.imageSmoothingEnabled = false;

// ─── AUDIO ───────────────────────────────────────────────────
let audioCtx = null;
function ensureAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}
function beep(freq, dur, type='square', vol=0.15) {
  ensureAudio();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  const osc  = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(vol, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
  osc.start(audioCtx.currentTime);
  osc.stop(audioCtx.currentTime + dur);
}
function sfxStep()    { beep(220, 0.04, 'square', 0.05); }
function sfxConfirm() { beep(660, 0.08, 'square', 0.12); }
function sfxCancel()  { beep(200, 0.1,  'square', 0.1); }
function sfxHit()     { beep(180, 0.12, 'sawtooth', 0.15); }
function sfxMagic()   {
  beep(440, 0.08, 'sine', 0.15);
  setTimeout(() => beep(660, 0.08, 'sine', 0.15), 80);
  setTimeout(() => beep(880, 0.15, 'sine', 0.15), 160);
}
function sfxLevelUp() {
  [262,330,392,523,659,784].forEach((f,i) => setTimeout(() => beep(f,0.12,'square',0.18), i*80));
}
function sfxBattleStart() {
  [150,200,250,300].forEach((f,i) => setTimeout(() => beep(f,0.15,'square',0.2), i*60));
}
function sfxDead() { beep(120, 0.5, 'sawtooth', 0.2); }
function sfxInn()  { [523,659,784,1047].forEach((f,i) => setTimeout(() => beep(f,0.2,'sine',0.18), i*120)); }
function sfxChest(){ beep(880, 0.08,'square',0.2); setTimeout(()=>beep(1100,0.15,'square',0.2),90); }

// ─── INPUT ───────────────────────────────────────────────────
const KEYS = {};
const JUST_PRESSED = {};
window.addEventListener('keydown', e => {
  if (!KEYS[e.code]) JUST_PRESSED[e.code] = true;
  KEYS[e.code] = true;
  e.preventDefault();
});
window.addEventListener('keyup', e => { KEYS[e.code] = false; });
function consumeKey(code) { const v = JUST_PRESSED[code]; delete JUST_PRESSED[code]; return v; }
function anyConfirm()  { return consumeKey('KeyZ')||consumeKey('Enter')||consumeKey('Space')||consumeKey('KeyA'); }
function anyCancel()   { return consumeKey('Escape')||consumeKey('KeyX')||consumeKey('KeyB'); }
function anyUp()       { return consumeKey('ArrowUp')||consumeKey('KeyW'); }
function anyDown()     { return consumeKey('ArrowDown')||consumeKey('KeyS'); }
function anyLeft()     { return consumeKey('ArrowLeft')||consumeKey('KeyA') && !KEYS['ArrowRight']; }
function anyRight()    { return consumeKey('ArrowRight')||consumeKey('KeyD'); }

// Mobile buttons
document.querySelectorAll('.dpad-btn').forEach(btn => {
  const dir = btn.dataset.dir;
  const code = {up:'ArrowUp',down:'ArrowDown',left:'ArrowLeft',right:'ArrowRight'}[dir];
  btn.addEventListener('pointerdown', () => { KEYS[code]=true; JUST_PRESSED[code]=true; ensureAudio(); });
  btn.addEventListener('pointerup',   () => { KEYS[code]=false; });
  btn.addEventListener('pointerleave',() => { KEYS[code]=false; });
});
document.getElementById('btn-a').addEventListener('pointerdown', () => { JUST_PRESSED['Enter']=true; ensureAudio(); });
document.getElementById('btn-b').addEventListener('pointerdown', () => { JUST_PRESSED['Escape']=true; ensureAudio(); });

// ─── DRAW UTILITIES ──────────────────────────────────────────
function drawText(text, x, y, col='#ffffff', size=6) {
  ctx.font = `${size}px "Press Start 2P", monospace`;
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#000';
  ctx.fillText(text, x+1, y+1);
  ctx.fillStyle = col;
  ctx.fillText(text, x, y);
}

function drawWindow(x, y, w, h) {
  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(x+3, y+3, w, h);
  // Fill
  ctx.fillStyle = '#0c0c2a';
  ctx.fillRect(x, y, w, h);
  // Outer border bright
  ctx.strokeStyle = '#a0a0ff';
  ctx.lineWidth = 2;
  ctx.strokeRect(x+1, y+1, w-2, h-2);
  // Inner border dim
  ctx.strokeStyle = '#303070';
  ctx.lineWidth = 1;
  ctx.strokeRect(x+3, y+3, w-6, h-6);
}

function drawBar(x, y, w, h, cur, max, fg, bg='#300') {
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, w, h);
  const pct = Math.max(0, Math.min(1, cur/max));
  ctx.fillStyle = fg;
  ctx.fillRect(x, y, Math.round(w*pct), h);
  ctx.strokeStyle = '#ffffff44';
  ctx.lineWidth = 0.5;
  ctx.strokeRect(x, y, w, h);
}

// ─── TILE DRAWING ────────────────────────────────────────────
let waterAnim = 0;  // 0..1 cycles

function drawTile(type, px, py) {
  const x = px, y = py, S = TILE;
  switch(type) {
    case T.GRASS:
      ctx.fillStyle = '#2e8b2e';
      ctx.fillRect(x,y,S,S);
      ctx.fillStyle = '#268026';
      ctx.fillRect(x+1,y+2,2,2); ctx.fillRect(x+8,y+6,2,2); ctx.fillRect(x+12,y+11,2,2);
      ctx.fillStyle = '#38a838';
      ctx.fillRect(x+4,y+9,2,2); ctx.fillRect(x+10,y+3,2,2);
      break;
    case T.WATER: {
      const w = (Math.sin(waterAnim*Math.PI*2 + px*0.3)*0.5+0.5);
      ctx.fillStyle = '#1848b8';
      ctx.fillRect(x,y,S,S);
      ctx.fillStyle = `rgba(80,150,255,${0.3+w*0.3})`;
      ctx.fillRect(x+1, y+4+Math.round(w*2), 5,2);
      ctx.fillRect(x+9, y+9-Math.round(w*2), 5,2);
      ctx.fillStyle = 'rgba(180,220,255,0.15)';
      ctx.fillRect(x+2, y+2, 3, 1);
      break; }
    case T.TREE:
      // Trunk
      ctx.fillStyle = '#6b3a1a';
      ctx.fillRect(x+6,y+10,4,6);
      // Canopy layers
      ctx.fillStyle = '#155a15';
      ctx.fillRect(x+3,y+5,10,7);
      ctx.fillStyle = '#1a7a1a';
      ctx.fillRect(x+4,y+2,8,6);
      ctx.fillStyle = '#22a022';
      ctx.fillRect(x+6,y+1,4,4);
      // Highlight
      ctx.fillStyle = '#2eca2e';
      ctx.fillRect(x+5,y+2,2,2);
      break;
    case T.MOUNTAIN:
      ctx.fillStyle = '#3a3530';
      ctx.fillRect(x,y,S,S);
      ctx.fillStyle = '#5a5048';
      ctx.fillRect(x+2,y+6,12,10);
      ctx.fillStyle = '#7a6e62';
      ctx.fillRect(x+4,y+3,8,6);
      ctx.fillStyle = '#9a8e80';
      ctx.fillRect(x+6,y+1,4,4);
      // Snow cap
      ctx.fillStyle = '#e8e0d8';
      ctx.fillRect(x+7,y+1,2,2);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x+8,y+0,1,2);
      break;
    case T.PATH:
      ctx.fillStyle = '#b89458';
      ctx.fillRect(x,y,S,S);
      ctx.fillStyle = '#a07840';
      ctx.fillRect(x+0,y+5,S,2); ctx.fillRect(x+0,y+12,S,1);
      ctx.fillStyle = '#c8a870';
      ctx.fillRect(x+3,y+3,2,2); ctx.fillRect(x+10,y+10,2,2);
      break;
    case T.SAND:
      ctx.fillStyle = '#d8c868';
      ctx.fillRect(x,y,S,S);
      ctx.fillStyle = '#c8b850';
      ctx.fillRect(x+2,y+4,3,1); ctx.fillRect(x+10,y+10,3,1); ctx.fillRect(x+6,y+13,3,1);
      ctx.fillStyle = '#e8d888';
      ctx.fillRect(x+7,y+2,2,2); ctx.fillRect(x+1,y+11,2,2);
      break;
    case T.FOREST:
      // Walkable forest floor with dappled light
      ctx.fillStyle = '#1a5c1a';
      ctx.fillRect(x,y,S,S);
      ctx.fillStyle = '#156015';
      ctx.fillRect(x+0,y+0,8,8); ctx.fillRect(x+8,y+8,8,8);
      ctx.fillStyle = '#22782a';
      ctx.fillRect(x+3,y+7,4,2); ctx.fillRect(x+9,y+3,4,2);
      break;
    case T.WALL:
      ctx.fillStyle = '#5a4838';
      ctx.fillRect(x,y,S,S);
      ctx.fillStyle = '#6a5848';
      // Brick pattern
      for (let gy=0; gy<S; gy+=4) {
        for (let gx=(gy%8===0)?0:4; gx<S; gx+=8) {
          ctx.fillRect(x+gx, y+gy, 7, 3);
        }
      }
      ctx.fillStyle = '#3a2818';
      for (let gy=0; gy<S; gy+=4) {
        ctx.fillRect(x, y+gy+3, S, 1);
      }
      break;
    case T.DOOR:
      ctx.fillStyle = '#8b5a1a';
      ctx.fillRect(x,y,S,S);
      ctx.fillStyle = '#d4900a';
      ctx.fillRect(x+3,y+2,10,13);
      ctx.fillStyle = '#f8c020';
      ctx.fillRect(x+4,y+3,8,11);
      ctx.fillStyle = '#a06010';
      ctx.fillRect(x+11,y+7,2,2);
      ctx.fillStyle = '#805008';
      ctx.fillRect(x+7,y+14,2,1);
      break;
    case T.FLOOR:
      ctx.fillStyle = '#c0a870';
      ctx.fillRect(x,y,S,S);
      ctx.fillStyle = '#a89050';
      ctx.fillRect(x+0,y+0,8,8);
      ctx.fillRect(x+8,y+8,8,8);
      ctx.fillStyle = '#d0b888';
      ctx.fillRect(x+8,y+0,8,8);
      ctx.fillRect(x+0,y+8,8,8);
      break;
    case T.CAVE:
      ctx.fillStyle = '#1a1208';
      ctx.fillRect(x,y,S,S);
      ctx.fillStyle = '#302018';
      ctx.fillRect(x+2,y+4,12,10);
      ctx.fillStyle = '#0a0808';
      ctx.fillRect(x+4,y+2,8,12);
      // Cave entrance arch
      ctx.fillStyle = '#503828';
      ctx.fillRect(x+5,y+6,6,8);
      break;
    default:
      ctx.fillStyle = '#ff00ff'; ctx.fillRect(x,y,S,S);
  }
}

// ─── SPRITE DRAWING ──────────────────────────────────────────
function drawPlayer(px, py, dir, frame) {
  const x = px, y = py;
  const legOff = frame===1 ? 1 : -1;

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(x+3,y+14,10,3);

  // Hair
  ctx.fillStyle = '#8b4513';
  ctx.fillRect(x+4,y+1,8,4);
  ctx.fillRect(x+3,y+2,1,3);
  ctx.fillRect(x+12,y+2,1,3);

  // Skin / Head
  ctx.fillStyle = '#f5d5a0';
  ctx.fillRect(x+4,y+3,8,5);

  // Eyes
  ctx.fillStyle = '#202060';
  if (dir===0) { ctx.fillRect(x+6,y+6,2,1); ctx.fillRect(x+10,y+6,2,1); }
  else if (dir===1) { /* facing up, no eyes visible */ }
  else if (dir===2) { ctx.fillRect(x+5,y+6,2,1); }
  else              { ctx.fillRect(x+9,y+6,2,1); }

  // Body / Tunic (red)
  ctx.fillStyle = '#c82020';
  ctx.fillRect(x+4,y+8,8,6);
  // Belt
  ctx.fillStyle = '#603010';
  ctx.fillRect(x+4,y+13,8,1);

  // Arms
  ctx.fillStyle = '#c82020';
  ctx.fillRect(x+2,y+8,2,5);
  ctx.fillRect(x+12,y+8,2,5);
  // Hands
  ctx.fillStyle = '#f5d5a0';
  ctx.fillRect(x+2,y+12,2,2);
  ctx.fillRect(x+12,y+12,2,2);

  // Sword (only when facing right or down)
  if (dir===3 || dir===0) {
    ctx.fillStyle = '#c8c8d8';
    ctx.fillRect(x+14,y+9,2,6);
    ctx.fillStyle = '#d4a020';
    ctx.fillRect(x+13,y+9,3,2);
  }

  // Legs
  ctx.fillStyle = '#2040a0';
  ctx.fillRect(x+4,y+14,4,4+legOff);
  ctx.fillRect(x+8,y+14,4,4-legOff);

  // Shoes / Boots
  ctx.fillStyle = '#401008';
  ctx.fillRect(x+4,y+16+legOff,4,2);
  ctx.fillRect(x+8,y+16-legOff,4,2);
}

function drawNPCSprite(sprite, px, py, frame) {
  const x=px, y=py;
  // Base body colors per type
  const colors = {
    elder:     { body:'#4040a0', hair:'#e0e0e0', skin:'#f0c080' },
    girl:      { body:'#c04080', hair:'#f8a000', skin:'#f8d0a0' },
    innkeeper: { body:'#806020', hair:'#602000', skin:'#f0c080' },
    merchant:  { body:'#208040', hair:'#402000', skin:'#d8b070' },
  };
  const c = colors[sprite] || colors.elder;
  const bob = frame===1 ? 1 : 0;

  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(x+3,y+14,10,3);

  ctx.fillStyle = c.hair;
  ctx.fillRect(x+4,y+1+bob,8,4);

  ctx.fillStyle = c.skin;
  ctx.fillRect(x+4,y+3+bob,8,5);

  ctx.fillStyle = '#000';
  ctx.fillRect(x+6,y+6+bob,2,1);
  ctx.fillRect(x+10,y+6+bob,2,1);

  ctx.fillStyle = c.body;
  ctx.fillRect(x+3,y+8+bob,10,6);

  ctx.fillStyle = '#2040a0';
  ctx.fillRect(x+4,y+14,3,4);
  ctx.fillRect(x+8,y+14,3,4);

  ctx.fillStyle = '#301808';
  ctx.fillRect(x+4,y+16,3,2);
  ctx.fillRect(x+8,y+16,3,2);
}

function drawSlime(cx, cy, scale) {
  const s = scale;
  // Body
  ctx.fillStyle = '#10a060';
  ctx.fillRect(cx+2*s, cy+4*s, 8*s, 5*s);
  ctx.fillRect(cx+1*s, cy+6*s, 10*s, 4*s);
  ctx.fillRect(cx+3*s, cy+2*s, 6*s, 4*s);
  // Highlight
  ctx.fillStyle = '#40e0a0';
  ctx.fillRect(cx+4*s, cy+3*s, 3*s, 2*s);
  // Eyes
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(cx+3*s, cy+5*s, 2*s, 2*s);
  ctx.fillRect(cx+7*s, cy+5*s, 2*s, 2*s);
  ctx.fillStyle = '#101010';
  ctx.fillRect(cx+3*s+s/2|0, cy+5*s+s/2|0, s, s);
  ctx.fillRect(cx+7*s+s/2|0, cy+5*s+s/2|0, s, s);
  // Mouth
  ctx.fillStyle = '#108050';
  ctx.fillRect(cx+4*s, cy+8*s, 4*s, s);
  // Shadow
  ctx.fillStyle = '#086040';
  ctx.fillRect(cx+1*s, cy+9*s, 10*s, s);
}

function drawGoblin(cx, cy, scale) {
  const s = scale;
  // Legs
  ctx.fillStyle = '#6040a0';
  ctx.fillRect(cx+3*s, cy+10*s, 3*s, 4*s);
  ctx.fillRect(cx+7*s, cy+10*s, 3*s, 4*s);
  // Feet
  ctx.fillStyle = '#301020';
  ctx.fillRect(cx+2*s, cy+13*s, 4*s, 2*s);
  ctx.fillRect(cx+7*s, cy+13*s, 4*s, 2*s);
  // Body
  ctx.fillStyle = '#7a3a7a';
  ctx.fillRect(cx+2*s, cy+6*s, 9*s, 5*s);
  // Arms
  ctx.fillStyle = '#508050';
  ctx.fillRect(cx+0*s, cy+6*s, 2*s, 4*s);
  ctx.fillRect(cx+11*s, cy+6*s, 2*s, 4*s);
  // Weapon (club)
  ctx.fillStyle = '#704010';
  ctx.fillRect(cx+12*s, cy+3*s, 2*s, 7*s);
  ctx.fillRect(cx+11*s, cy+3*s, 4*s, 3*s);
  // Head
  ctx.fillStyle = '#508050';
  ctx.fillRect(cx+3*s, cy+2*s, 7*s, 5*s);
  // Ears
  ctx.fillStyle = '#508050';
  ctx.fillRect(cx+1*s, cy+3*s, 2*s, 3*s);
  ctx.fillRect(cx+10*s, cy+3*s, 2*s, 3*s);
  // Eyes
  ctx.fillStyle = '#ff3020';
  ctx.fillRect(cx+4*s, cy+3*s, 2*s, 2*s);
  ctx.fillRect(cx+7*s, cy+3*s, 2*s, 2*s);
  ctx.fillStyle = '#600';
  ctx.fillRect(cx+5*s, cy+4*s, s, s);
  ctx.fillRect(cx+8*s, cy+4*s, s, s);
  // Teeth
  ctx.fillStyle = '#e8e8c0';
  ctx.fillRect(cx+4*s, cy+6*s, s, 2*s);
  ctx.fillRect(cx+6*s, cy+6*s, s, 2*s);
  ctx.fillRect(cx+8*s, cy+6*s, s, 2*s);
}

function drawBat(cx, cy, scale, frame) {
  const s = scale;
  const wingFlap = frame ? 2*s : -s;
  // Wings
  ctx.fillStyle = '#3a1a5a';
  ctx.fillRect(cx+0,     cy+4*s+wingFlap, 4*s, 5*s);
  ctx.fillRect(cx+9*s,   cy+4*s+wingFlap, 4*s, 5*s);
  ctx.fillStyle = '#501870';
  ctx.fillRect(cx+s,     cy+5*s+wingFlap, 3*s, 3*s);
  ctx.fillRect(cx+9*s,   cy+5*s+wingFlap, 3*s, 3*s);
  // Body
  ctx.fillStyle = '#2a1040';
  ctx.fillRect(cx+4*s, cy+5*s, 5*s, 6*s);
  // Head
  ctx.fillStyle = '#3a1850';
  ctx.fillRect(cx+3*s, cy+2*s, 7*s, 5*s);
  // Ears
  ctx.fillStyle = '#501870';
  ctx.fillRect(cx+3*s, cy+0,   2*s, 3*s);
  ctx.fillRect(cx+8*s, cy+0,   2*s, 3*s);
  // Eyes
  ctx.fillStyle = '#ff2020';
  ctx.fillRect(cx+4*s, cy+3*s, 2*s, 2*s);
  ctx.fillRect(cx+7*s, cy+3*s, 2*s, 2*s);
  ctx.fillStyle = '#ff8000';
  ctx.fillRect(cx+5*s, cy+4*s, s,   s);
  ctx.fillRect(cx+8*s, cy+4*s, s,   s);
  // Fangs
  ctx.fillStyle = '#e0e0e0';
  ctx.fillRect(cx+5*s, cy+6*s, s, 2*s);
  ctx.fillRect(cx+7*s, cy+6*s, s, 2*s);
}

function drawKnight(cx, cy, scale, frame) {
  const s = scale;
  const bob = frame ? s : 0;
  // Sword glow
  ctx.fillStyle = '#6080ff';
  ctx.fillRect(cx+12*s, cy+2*s+bob, 2*s, 10*s);
  ctx.fillStyle = '#a0b0ff';
  ctx.fillRect(cx+12*s+s/2|0, cy+2*s+bob, s, 8*s);
  // Shield
  ctx.fillStyle = '#404060';
  ctx.fillRect(cx+0, cy+4*s+bob, 3*s, 6*s);
  ctx.fillStyle = '#6060a0';
  ctx.fillRect(cx+s, cy+5*s+bob, 2*s, 4*s);
  // Boots
  ctx.fillStyle = '#181820';
  ctx.fillRect(cx+3*s, cy+13*s, 3*s, 3*s);
  ctx.fillRect(cx+7*s, cy+13*s, 3*s, 3*s);
  // Legs / Armor
  ctx.fillStyle = '#282830';
  ctx.fillRect(cx+3*s, cy+9*s, 7*s, 5*s);
  // Body armor
  ctx.fillStyle = '#303040';
  ctx.fillRect(cx+2*s, cy+5*s+bob, 9*s, 5*s);
  ctx.fillStyle = '#505070';
  ctx.fillRect(cx+3*s, cy+6*s+bob, 7*s, 3*s);
  // Arms
  ctx.fillStyle = '#282830';
  ctx.fillRect(cx+0,   cy+5*s+bob, 3*s, 4*s);
  ctx.fillRect(cx+10*s,cy+5*s+bob, 3*s, 4*s);
  // Helmet
  ctx.fillStyle = '#282830';
  ctx.fillRect(cx+2*s, cy+1*s+bob, 9*s, 5*s);
  ctx.fillStyle = '#404050';
  ctx.fillRect(cx+3*s, cy+2*s+bob, 7*s, 3*s);
  // Visor slit glowing red
  ctx.fillStyle = '#ff0000';
  ctx.fillRect(cx+4*s, cy+3*s+bob, 5*s, s);
  ctx.fillStyle = '#ff6060';
  ctx.fillRect(cx+5*s, cy+3*s+bob, 3*s, s);
  // Horns
  ctx.fillStyle = '#404050';
  ctx.fillRect(cx+2*s, cy+0+bob, 2*s, 2*s);
  ctx.fillRect(cx+9*s, cy+0+bob, 2*s, 2*s);
}

// ─── GAME STATE ──────────────────────────────────────────────
let gameState = 'title';  // title | explore | dialog | battle | gameover | levelup
let tick = 0;
let flashAlpha = 0;

const player = {
  x: 15, y: 9,      // tile position
  px: 15*TILE, py: 9*TILE,  // pixel position (smooth)
  dir: 0,           // 0=down 1=up 2=left 3=right
  frame: 0,
  moving: false,
  moveTimer: 0,
  hp: 20, maxHp: 20,
  mp: 10, maxMp: 10,
  atk: 6, def: 3,
  level: 1, exp: 0, nextExp: 15,
  gold: 10,
  potions: 3,
  steps: 0,
  encounterCounter: 0,
  saveX: 15, saveY: 9,  // last inn position
};

let camera = { x:0, y:0 };

// NPC states (copy of list with runtime state)
const npcs = NPC_LIST.map(n => ({ ...n, dialogPage:0, face:0, faceTimer:0 }));

// ─── DIALOG STATE ────────────────────────────────────────────
const dlg = {
  active: false,
  lines: [],
  page: 0,
  charIdx: 0,
  charTimer: 0,
  speaker: '',
  onDone: null,
  isAuto: false,  // auto-advance (for events)
};

function showDialog(lines, speaker, onDone) {
  dlg.active = true;
  dlg.lines   = lines;
  dlg.page    = 0;
  dlg.charIdx = 0;
  dlg.charTimer = 0;
  dlg.speaker = speaker || '';
  dlg.onDone  = onDone || null;
  gameState   = 'dialog';
  sfxConfirm();
}

// ─── BATTLE STATE ────────────────────────────────────────────
const battle = {
  enemy: null,        // current enemy data (copy)
  enemyHp: 0,
  enemyMaxHp: 0,
  phase: 'menu',     // menu | playerAction | enemyAction | win | lose | run
  menuIdx: 0,
  subMenu: null,     // null | 'magic' | 'item'
  subIdx: 0,
  message: '',
  msgTimer: 0,
  animFrame: 0,
  shakeX: 0,
  winExp: 0,
  winGold: 0,
  bg: 0,             // bg variant
};

function startBattle(zone) {
  const pool = Object.values(ENEMIES).filter(e => e.zone === zone);
  const enemy = { ...pool[Math.floor(Math.random()*pool.length)] };
  battle.enemy    = enemy;
  battle.enemyHp  = enemy.hp;
  battle.enemyMaxHp = enemy.hp;
  battle.phase    = 'menu';
  battle.menuIdx  = 0;
  battle.subMenu  = null;
  battle.message  = enemy.name + '이(가) 나타났다!';
  battle.msgTimer = 120;
  battle.animFrame = 0;
  battle.shakeX   = 0;
  battle.winExp   = enemy.exp;
  battle.winGold  = enemy.gold;
  battle.bg       = Math.floor(Math.random()*3);
  flashAlpha = 1;
  gameState = 'battle';
  sfxBattleStart();
}

// ─── CAMERA ──────────────────────────────────────────────────
function updateCamera() {
  const tx = player.px/TILE - VIEW_W/2 + 0.5;
  const ty = player.py/TILE - VIEW_H/2 + 0.5;
  camera.x = Math.max(0, Math.min(tx, MAP_W - VIEW_W));
  camera.y = Math.max(0, Math.min(ty, MAP_H - VIEW_H));
}

// ─── MAP RENDER ──────────────────────────────────────────────
function renderMap() {
  const cx = camera.x, cy = camera.y;
  const startCol = Math.floor(cx), startRow = Math.floor(cy);
  const offX = -(cx - startCol) * TILE;
  const offY = -(cy - startRow) * TILE;

  for (let row = 0; row <= VIEW_H; row++) {
    for (let col = 0; col <= VIEW_W; col++) {
      const mx = startCol + col, my = startRow + row;
      if (mx<0||my<0||mx>=MAP_W||my>=MAP_H) continue;
      const tile = WORLD[my][mx];
      drawTile(tile, Math.round(col*TILE + offX), Math.round(row*TILE + offY));
    }
  }

  // Draw NPCs
  for (const npc of npcs) {
    const sx = Math.round((npc.x - cx) * TILE);
    const sy = Math.round((npc.y - cy) * TILE);
    if (sx < -TILE || sx > CW || sy < -TILE || sy > VIEW_H*TILE) continue;
    drawNPCSprite(npc.sprite, sx, sy, Math.floor(tick/30)%2);
    // Speech bubble when close
    const dx = Math.abs(npc.x - player.x), dy = Math.abs(npc.y - player.y);
    if (dx + dy <= 2) {
      ctx.fillStyle = '#ffffaa';
      ctx.fillRect(sx+4, sy-6, 8, 5);
      drawText('!', sx+6, sy-6, '#c00', 5);
    }
  }

  // Draw player
  const psx = Math.round((player.px/TILE - cx) * TILE);
  const psy = Math.round((player.py/TILE - cy) * TILE);
  drawPlayer(psx, psy, player.dir, player.frame);
}

// ─── STATUS BAR ──────────────────────────────────────────────
function renderStatus() {
  const y = VIEW_H * TILE;
  ctx.fillStyle = '#080818';
  ctx.fillRect(0, y, CW, 32);
  ctx.strokeStyle = '#303060';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(CW,y); ctx.stroke();

  // HP
  drawText('HP', 4, y+3, '#ff6060', 5);
  drawBar(22, y+4, 50, 5, player.hp, player.maxHp,
    player.hp > player.maxHp*0.5 ? '#e02020' : player.hp > player.maxHp*0.25 ? '#e08000' : '#e0e020');
  drawText(`${player.hp}/${player.maxHp}`, 74, y+3, '#c0c0c0', 5);

  // MP
  drawText('MP', 4, y+14, '#6060ff', 5);
  drawBar(22, y+15, 50, 5, player.mp, player.maxMp, '#2060e0', '#002060');
  drawText(`${player.mp}/${player.maxMp}`, 74, y+14, '#c0c0c0', 5);

  // Level / EXP
  drawText(`LV.${player.level}`, 130, y+3, '#f8d020', 5);
  drawText('EXP', 130, y+14, '#a0a000', 5);
  drawBar(148, y+15, 40, 5, player.exp, player.nextExp, '#c8c800', '#404000');

  // Gold & Potions
  drawText(`G:${player.gold}`, 198, y+3,  '#f8c000', 5);
  drawText(`P:${player.potions}`, 198, y+14, '#20e0a0', 5);
}

// ─── DIALOG RENDER ───────────────────────────────────────────
function renderDialog() {
  const bh = 52, by = VIEW_H*TILE - bh - 2;
  drawWindow(4, by, CW-8, bh);

  if (dlg.speaker) {
    drawText(dlg.speaker, 12, by+5, '#f8d020', 5);
    var lineY = by + 16;
  } else {
    var lineY = by + 8;
  }

  const line = dlg.lines[dlg.page] || '';
  const shown = line.slice(0, dlg.charIdx);
  drawText(shown, 10, lineY, '#e8e8ff', 5);

  // More indicator
  if (dlg.charIdx >= line.length) {
    const blink = Math.floor(tick/20)%2;
    if (blink) drawText('▼', CW-20, by+bh-12, '#f8d020', 6);
  }
}

// ─── BATTLE RENDER ───────────────────────────────────────────
function renderBattle() {
  const enemy = battle.enemy;

  // ── Background
  const bg = ['#1a0830','#0a1a30','#200a18'];
  ctx.fillStyle = bg[battle.bg];
  ctx.fillRect(0, 0, CW, VIEW_H*TILE);

  // Ground plane
  for (let i=0; i<4; i++) {
    ctx.fillStyle = `rgba(255,255,255,${0.03-i*0.007})`;
    ctx.fillRect(0, 120+i*8, CW, 8);
  }
  ctx.fillStyle = '#100820';
  ctx.fillRect(0, 152, CW, 40);

  // Stars in background
  ctx.fillStyle = '#ffffff';
  for (let i=0; i<20; i++) {
    const sx = (i*47+13)%CW, sy = (i*31+7)%100;
    ctx.fillRect(sx, sy, 1, 1);
  }

  // ── Enemy sprite (centered, large)
  const es = battle.animFrame < 4 ? 4 : 4;  // scale
  const ex = Math.round(CW/2 - 6*es + battle.shakeX);
  const ey = Math.round(70 - 8*es);
  ctx.save();
  if (battle.phase === 'playerAction' && battle.animFrame > 0) {
    const alpha = battle.animFrame < 10 ? 1 - battle.animFrame/10 : (battle.animFrame-10)/10;
    ctx.globalAlpha = alpha;
  }
  switch(enemy.sprite) {
    case 'slime':  drawSlime(ex, ey, es); break;
    case 'goblin': drawGoblin(ex, ey, es); break;
    case 'bat':    drawBat(ex, ey, es, Math.floor(tick/12)%2); break;
    case 'knight': drawKnight(ex, ey, es, Math.floor(tick/20)%2); break;
  }
  ctx.restore();

  // Enemy name + HP bar
  drawWindow(4, 4, 100, 28);
  drawText(enemy.name, 8, 8, '#ffcc00', 5);
  drawText('HP', 8, 18, '#ff6060', 5);
  drawBar(24, 19, 70, 6, battle.enemyHp, battle.enemyMaxHp,
    battle.enemyHp > battle.enemyMaxHp*0.5 ? '#e02020' : '#e0a020', '#400');

  // ── Bottom UI area
  const uiY = VIEW_H*TILE - 64;
  ctx.fillStyle = '#080818';
  ctx.fillRect(0, uiY, CW, 64);
  ctx.strokeStyle = '#304080';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0,uiY); ctx.lineTo(CW,uiY); ctx.stroke();

  // Player stats box (right)
  drawWindow(136, uiY+2, 116, 60);
  drawText(` 용사  LV.${player.level}`, 140, uiY+6, '#f8d020', 5);
  drawText('HP', 140, uiY+19, '#ff6060', 5);
  drawBar(156, uiY+20, 86, 6, player.hp, player.maxHp,
    player.hp > player.maxHp*0.5 ? '#e02020' : '#e0a020', '#400');
  drawText(`${player.hp}/${player.maxHp}`, 140, uiY+29, '#c0c0c0', 5);
  drawText('MP', 140, uiY+40, '#6060ff', 5);
  drawBar(156, uiY+41, 86, 6, player.mp, player.maxMp, '#2060e0', '#002060');
  drawText(`${player.mp}/${player.maxMp}`, 140, uiY+50, '#c0c0c0', 5);

  // Message OR menu
  if (battle.msgTimer > 0 || battle.phase === 'enemyAction' || battle.phase === 'win' || battle.phase === 'lose' || battle.phase === 'run') {
    // Message box
    drawWindow(4, uiY+2, 128, 60);
    // Word-wrap message
    const words = battle.message.split('');
    drawText(battle.message.slice(0,28), 8, uiY+8, '#e8e8ff', 5);
    if (battle.message.length > 28) drawText(battle.message.slice(28,56), 8, uiY+20, '#e8e8ff', 5);
    if (battle.message.length > 56) drawText(battle.message.slice(56,84), 8, uiY+32, '#e8e8ff', 5);
    if (battle.phase==='win' || battle.phase==='lose') {
      const blink = Math.floor(tick/20)%2;
      if (blink) drawText('▼계속', 60, uiY+50, '#f8d020', 5);
    }
  } else if (battle.phase === 'menu') {
    // Command menu
    drawWindow(4, uiY+2, 128, 60);
    const cmds = ['공격', '마법', '아이템', '도망'];
    cmds.forEach((cmd, i) => {
      const cx = (i<2) ? 10 : 70;
      const cy = uiY + 8 + (i%2)*24;
      const sel = i === battle.menuIdx;
      if (sel) drawText('►', cx-8, cy, '#f8d020', 5);
      drawText(cmd, cx, cy, sel ? '#ffffff' : '#a0a0c0', 5);
      // Show costs
      if (cmd==='마법') drawText('MP4', cx, cy+11, '#8080ff', 4);
      if (cmd==='아이템') drawText(`×${player.potions}`, cx, cy+11, '#40e0a0', 4);
    });
  } else if (battle.subMenu === 'magic') {
    drawWindow(4, uiY+2, 128, 60);
    const spells = ['파이어(MP4)','힐(MP3)','뒤로'];
    spells.forEach((s,i) => {
      const sel = i === battle.subIdx;
      if (sel) drawText('►', 6, uiY+8+i*16, '#f8d020', 5);
      drawText(s, 14, uiY+8+i*16, sel ? '#ffffff' : '#a0a0c0', 5);
    });
  } else if (battle.subMenu === 'item') {
    drawWindow(4, uiY+2, 128, 60);
    const items = player.potions > 0 ? [`포션×${player.potions}`, '뒤로'] : ['포션없음', '뒤로'];
    items.forEach((s,i) => {
      const sel = i === battle.subIdx;
      if (sel) drawText('►', 6, uiY+8+i*16, '#f8d020', 5);
      drawText(s, 14, uiY+8+i*16, sel ? '#ffffff' : '#a0a0c0', 5);
    });
  }
}

// ─── TITLE SCREEN ────────────────────────────────────────────
function renderTitle() {
  // Sky gradient (manual bands)
  const skyColors = ['#0a0020','#080030','#060050','#080840','#0a1060'];
  skyColors.forEach((c,i) => {
    ctx.fillStyle = c;
    ctx.fillRect(0, i*(CH/5), CW, CH/5 + 2);
  });

  // Stars
  ctx.fillStyle = '#ffffff';
  for (let i=0; i<40; i++) {
    const tx = (i*73+19)%CW, ty = (i*41+11)%(CH*0.6);
    const blink = Math.sin(tick*0.05 + i) > 0.3;
    if (blink) ctx.fillRect(tx, ty, 1, 1);
  }

  // Moon
  ctx.fillStyle = '#f0e8c0';
  ctx.fillRect(210, 20, 20, 20);
  ctx.fillStyle = '#d8d0a8';
  ctx.fillRect(212, 22, 16, 16);
  ctx.fillStyle = '#0a0040';
  ctx.fillRect(218, 22, 12, 12);

  // Mountains silhouette
  ctx.fillStyle = '#0a0830';
  ctx.fillRect(0, 110, CW, 80);
  [0,30,70,110,150,200,240].forEach((mx, i) => {
    const mh = 20 + (i%3)*15;
    ctx.fillRect(mx, 110-mh, 40, mh+10);
    ctx.fillRect(mx+5, 108-mh, 30, 5);
    ctx.fillRect(mx+10,106-mh, 20, 4);
    ctx.fillRect(mx+15,104-mh, 10, 3);
  });

  // Title text
  const titleY = 30 + Math.sin(tick*0.03)*3;
  drawWindow(16, titleY, CW-32, 46);
  ctx.fillStyle = '#f8d020';
  drawText('픽셀', 44, titleY+6, '#f8d020', 12);
  drawText('어드벤처', 26, titleY+24, '#ff8040', 10);

  // Subtitle
  drawText('- 레트로 RPG -', 50, titleY+54, '#a0a0ff', 5);

  // Blink start prompt
  if (Math.floor(tick/30)%2) {
    drawText('ENTER 키를 누르세요', 32, 140, '#f0f0f0', 5);
  }

  // Controls hint
  drawWindow(10, 160, CW-20, 50);
  drawText('방향키: 이동', 18, 165, '#c0c0c0', 5);
  drawText('A/Enter: 확인/대화', 18, 177, '#c0c0c0', 5);
  drawText('숲/동굴 = 랜덤배틀', 18, 189, '#ff8080', 5);
  drawText('여관 = 회복+저장', 18, 201, '#80ff80', 5);
}

// ─── GAME OVER SCREEN ────────────────────────────────────────
function renderGameOver() {
  ctx.fillStyle = '#000';
  ctx.fillRect(0,0,CW,CH);

  const gy = 60 + Math.sin(tick*0.03)*2;
  drawText('GAME', 70, gy, '#e02020', 16);
  drawText('OVER', 70, gy+24, '#e02020', 16);

  if (Math.floor(tick/40)%2) {
    drawText('Enter: 처음부터', 44, gy+60, '#f8f8f8', 5);
  }
  drawText(`도달 레벨: ${player.level}`, 68, gy+80, '#a0a0a0', 5);
  drawText(`골드: ${player.gold}G`, 80, gy+94, '#f8c000', 5);
}

// ─── LEVEL UP SCREEN ─────────────────────────────────────────
const levelUpData = { timeout:0, gains:null };
function renderLevelUp() {
  renderMap();
  renderStatus();
  const g = levelUpData.gains;
  drawWindow(20, 50, CW-40, 100);
  drawText('레벨 업!', 60, 58, '#f8d020', 10);
  drawText(`LV. ${player.level-1} → ${player.level}`, 50, 82, '#ffffff', 6);
  drawText(`최대HP +${g.hp}`, 40, 100, '#ff8080', 5);
  drawText(`최대MP +${g.mp}`, 40, 112, '#8080ff', 5);
  drawText(`공격력 +${g.atk}`, 40, 124, '#ffcc00', 5);
  drawText(`방어력 +${g.def}`, 40, 136, '#80ff80', 5);
  if (Math.floor(tick/30)%2) drawText('Continue...', 70, 150, '#f0f0f0', 5);
}

// ─── PLAYER MOVEMENT ─────────────────────────────────────────
function updateMovement() {
  if (player.moving) {
    const speed = 2;
    const tx = player.x * TILE, ty = player.y * TILE;
    const dx = tx - player.px, dy = ty - player.py;
    const dist = Math.sqrt(dx*dx+dy*dy);
    if (dist <= speed) {
      player.px = tx; player.py = ty;
      player.moving = false;
      player.frame = 0;
      player.steps++;
      // Check random encounter
      const tile = WORLD[player.y][player.x];
      if (DANGER.has(tile)) {
        player.encounterCounter += 3;
        if (player.encounterCounter >= 100) {
          player.encounterCounter = 0;
          const zone = tile === T.FOREST ? 'forest' : 'cave';
          startBattle(zone);
          return;
        }
      } else {
        player.encounterCounter = Math.max(0, player.encounterCounter-1);
      }
      // Check NPC collision (step on same tile)
      checkNpcInteract(false);
    } else {
      player.px += (dx/dist)*speed;
      player.py += (dy/dist)*speed;
      player.frame = Math.floor(tick/8)%2;
    }
    return;
  }

  // Read input
  let nx = player.x, ny = player.y, moved = false;
  if (KEYS['ArrowUp']    || KEYS['KeyW']) { ny--; player.dir=1; moved=true; }
  else if (KEYS['ArrowDown'] || KEYS['KeyS']) { ny++; player.dir=0; moved=true; }
  else if (KEYS['ArrowLeft'] || KEYS['KeyA']) { nx--; player.dir=2; moved=true; }
  else if (KEYS['ArrowRight']|| KEYS['KeyD']) { nx++; player.dir=3; moved=true; }

  if (!moved) return;

  if (nx<0||nx>=MAP_W||ny<0||ny>=MAP_H) return;
  const tile = WORLD[ny][nx];
  if (!WALKABLE.has(tile)) return;

  // Check NPC collision
  const npcHere = npcs.find(n => n.x===nx && n.y===ny);
  if (npcHere) return;  // can't walk into NPC

  player.x = nx; player.y = ny;
  player.moving = true;
  sfxStep();
}

// ─── NPC INTERACTION ─────────────────────────────────────────
function checkNpcInteract(onAction) {
  // Find NPC adjacent to player facing direction
  const dirs = [[0,1],[0,-1],[-1,0],[1,0]];
  const [dx,dy] = dirs[player.dir];
  const tx = player.x+dx, ty = player.y+dy;
  const npc = npcs.find(n => n.x===tx && n.y===ty);
  if (!npc) {
    // Check door under player
    const tile = WORLD[player.y][player.x];
    if (tile === T.DOOR) {
      handleDoor();
    }
    return;
  }
  if (!onAction) return;
  // Show dialog
  let lines = [...npc.lines];
  if (npc.isInnkeeper) {
    // Heal
    player.hp = player.maxHp;
    player.mp = player.maxMp;
    saveGame();
    sfxInn();
  } else if (npc.isShop) {
    // Give potion
    player.potions++;
    sfxChest();
  }
  showDialog(lines, npc.name, null);
}

function handleDoor() {
  // Determine which building (left or right)
  const isInn  = (player.x===5  && player.y===13);
  const isShop = (player.x===22 && player.y===13);
  if (isInn) {
    player.hp = player.maxHp;
    player.mp = player.maxMp;
    player.saveX = player.x;
    player.saveY = player.y;
    saveGame();
    sfxInn();
    showDialog(['여관에서 하룻밤을 묵었다.','HP와 MP가 완전히 회복되었다!','게임이 저장되었습니다.'], '여관 주인');
  } else if (isShop) {
    player.potions++;
    sfxChest();
    showDialog(['어서오세요!','포션을 1개 드립니다.','다음에 또 오세요!'], '상인');
  }
}

// ─── BATTLE LOGIC ────────────────────────────────────────────
const BATTLE_MENU = ['공격','마법','아이템','도망'];

function updateBattle() {
  battle.animFrame = (battle.animFrame+1) % 20;
  if (battle.shakeX !== 0) battle.shakeX = battle.shakeX > 0 ? battle.shakeX-1 : battle.shakeX+1;

  if (battle.msgTimer > 0) {
    battle.msgTimer--;
    if (battle.msgTimer === 0 && battle.phase === 'playerAction') {
      // Enemy's turn
      battle.phase = 'enemyAction';
      enemyAttack();
    }
    if (battle.msgTimer === 0 && battle.phase === 'enemyAction') {
      if (player.hp <= 0) {
        battle.phase = 'lose';
        battle.message = '전투에서 쓰러졌다...';
        battle.msgTimer = 180;
        sfxDead();
      } else {
        battle.phase = 'menu';
        battle.menuIdx = 0;
      }
    }
    return;
  }

  if (battle.phase === 'win') {
    if (anyConfirm()) {
      endBattleWin();
    }
    return;
  }
  if (battle.phase === 'lose') {
    if (battle.msgTimer === 0 && anyConfirm()) {
      endBattleLose();
    }
    return;
  }
  if (battle.phase === 'run') return;

  // Menu navigation
  if (battle.subMenu === null && battle.phase === 'menu') {
    if (anyUp())    battle.menuIdx = (battle.menuIdx+3)%4;
    if (anyDown())  battle.menuIdx = (battle.menuIdx+1)%4;
    if (anyLeft())  battle.menuIdx = battle.menuIdx%2===0 ? battle.menuIdx+2 : battle.menuIdx-2; // left col toggle
    if (anyRight()) battle.menuIdx = battle.menuIdx%2===0 ? battle.menuIdx+2 : battle.menuIdx-2;
    if (anyConfirm()) {
      sfxConfirm();
      switch(battle.menuIdx) {
        case 0: playerAttack(); break;
        case 1: battle.subMenu='magic'; battle.subIdx=0; break;
        case 2: battle.subMenu='item';  battle.subIdx=0; break;
        case 3: playerRun(); break;
      }
    }
  } else if (battle.subMenu === 'magic') {
    const opts = ['fire','heal','back'];
    if (anyUp())   battle.subIdx = (battle.subIdx+2)%3;
    if (anyDown()) battle.subIdx = (battle.subIdx+1)%3;
    if (anyCancel()) { battle.subMenu=null; sfxCancel(); return; }
    if (anyConfirm()) {
      sfxConfirm();
      if (opts[battle.subIdx]==='back') { battle.subMenu=null; return; }
      if (opts[battle.subIdx]==='fire')  playerMagicFire();
      if (opts[battle.subIdx]==='heal')  playerMagicHeal();
    }
  } else if (battle.subMenu === 'item') {
    const opts = player.potions>0 ? ['potion','back'] : ['none','back'];
    if (anyUp())   battle.subIdx = (battle.subIdx+1)%2;
    if (anyDown()) battle.subIdx = (battle.subIdx+1)%2;
    if (anyCancel()) { battle.subMenu=null; sfxCancel(); return; }
    if (anyConfirm()) {
      sfxConfirm();
      if (opts[battle.subIdx]==='back') { battle.subMenu=null; return; }
      if (opts[battle.subIdx]==='potion' && player.potions>0) playerUsePotion();
      else { battle.subMenu=null; }
    }
  }
}

function dmg(atk, def) {
  return Math.max(1, atk - def + Math.floor(Math.random()*3) - 1);
}

function playerAttack() {
  const d = dmg(player.atk, battle.enemy.def);
  battle.enemyHp = Math.max(0, battle.enemyHp - d);
  battle.message = `${battle.enemy.name}에게 ${d} 데미지!`;
  battle.msgTimer = 80;
  battle.phase = 'playerAction';
  battle.shakeX = 3;
  sfxHit();
  if (battle.enemyHp <= 0) {
    battle.message = `${battle.enemy.name}을(를) 쓰러뜨렸다! EXP+${battle.winExp} G+${battle.winGold}`;
    battle.msgTimer = 120;
    battle.phase = 'win';
  }
}

function playerMagicFire() {
  if (player.mp < 4) {
    battle.message = 'MP가 부족하다!';
    battle.msgTimer = 70;
    battle.subMenu = null;
    return;
  }
  player.mp -= 4;
  const d = dmg(player.atk+4, Math.floor(battle.enemy.def/2));
  battle.enemyHp = Math.max(0, battle.enemyHp - d);
  battle.message = `파이어! ${battle.enemy.name}에게 ${d} 데미지!`;
  battle.msgTimer = 80;
  battle.phase = 'playerAction';
  battle.subMenu = null;
  battle.shakeX = 5;
  sfxMagic();
  if (battle.enemyHp <= 0) {
    battle.message = `${battle.enemy.name}을(를) 쓰러뜨렸다! EXP+${battle.winExp} G+${battle.winGold}`;
    battle.msgTimer = 120;
    battle.phase = 'win';
  }
}

function playerMagicHeal() {
  if (player.mp < 3) {
    battle.message = 'MP가 부족하다!';
    battle.msgTimer = 70;
    battle.subMenu = null;
    return;
  }
  player.mp -= 3;
  const heal = 8 + Math.floor(Math.random()*5);
  player.hp = Math.min(player.maxHp, player.hp + heal);
  battle.message = `힐! HP가 ${heal} 회복되었다!`;
  battle.msgTimer = 80;
  battle.phase = 'playerAction';
  battle.subMenu = null;
  sfxMagic();
}

function playerUsePotion() {
  player.potions--;
  const heal = 15 + Math.floor(Math.random()*10);
  player.hp = Math.min(player.maxHp, player.hp + heal);
  battle.message = `포션을 사용했다! HP+${heal}`;
  battle.msgTimer = 80;
  battle.phase = 'playerAction';
  battle.subMenu = null;
}

function playerRun() {
  if (Math.random() < 0.75) {
    battle.message = '도망쳤다!';
    battle.msgTimer = 60;
    battle.phase = 'run';
    sfxCancel();
    setTimeout(() => { gameState='explore'; }, 900);
  } else {
    battle.message = '도망치지 못했다!';
    battle.msgTimer = 70;
    battle.phase = 'playerAction';
  }
}

function enemyAttack() {
  const d = dmg(battle.enemy.atk, player.def);
  player.hp = Math.max(0, player.hp - d);
  battle.message = `${battle.enemy.name}의 공격! ${d} 데미지 받았다!`;
  battle.msgTimer = 80;
  sfxHit();
}

function endBattleWin() {
  player.exp   += battle.winExp;
  player.gold  += battle.winGold;
  // Level up check
  if (player.exp >= player.nextExp) {
    player.level++;
    player.exp -= player.nextExp;
    player.nextExp = Math.round(player.nextExp * 1.6);
    const gains = {
      hp:  5 + Math.floor(Math.random()*5),
      mp:  2 + Math.floor(Math.random()*3),
      atk: 1 + Math.floor(Math.random()*2),
      def: Math.floor(Math.random()*2),
    };
    player.maxHp  += gains.hp;
    player.maxMp  += gains.mp;
    player.atk    += gains.atk;
    player.def    += gains.def;
    player.hp = player.maxHp;
    player.mp = player.maxMp;
    levelUpData.gains   = gains;
    levelUpData.timeout = 180;
    gameState = 'levelup';
    sfxLevelUp();
  } else {
    gameState = 'explore';
  }
}

function endBattleLose() {
  player.hp = Math.floor(player.maxHp / 2);
  player.mp = Math.floor(player.maxMp / 2);
  player.x  = player.saveX;
  player.y  = player.saveY;
  player.px = player.x * TILE;
  player.py = player.y * TILE;
  gameState = 'gameover';
}

// ─── SAVE / LOAD ─────────────────────────────────────────────
function saveGame() {
  try {
    localStorage.setItem('rpg_save', JSON.stringify({
      x: player.saveX, y: player.saveY,
      hp: player.hp, maxHp: player.maxHp,
      mp: player.mp, maxMp: player.maxMp,
      atk: player.atk, def: player.def,
      level: player.level, exp: player.exp,
      nextExp: player.nextExp,
      gold: player.gold, potions: player.potions,
    }));
  } catch(_) {}
}

function loadGame() {
  try {
    const s = JSON.parse(localStorage.getItem('rpg_save'));
    if (!s) return;
    Object.assign(player, s);
    player.x = s.x; player.y = s.y;
    player.px = player.x * TILE;
    player.py = player.y * TILE;
  } catch(_) {}
}

// ─── DIALOG UPDATE ───────────────────────────────────────────
function updateDialog() {
  const line = dlg.lines[dlg.page] || '';

  // Typewriter
  if (dlg.charIdx < line.length) {
    dlg.charTimer++;
    if (dlg.charTimer >= 2) {
      dlg.charTimer = 0;
      dlg.charIdx++;
    }
    // Speed up if confirm held
    if (KEYS['Enter'] || KEYS['Space'] || KEYS['KeyZ']) {
      dlg.charIdx = line.length;
    }
    return;
  }

  // Full line shown — wait for confirm
  if (anyConfirm()) {
    sfxConfirm();
    dlg.page++;
    if (dlg.page >= dlg.lines.length) {
      dlg.active = false;
      gameState = 'explore';
      if (dlg.onDone) dlg.onDone();
    } else {
      dlg.charIdx = 0;
      dlg.charTimer = 0;
    }
  }
}

// ─── SCANLINE / EFFECTS ──────────────────────────────────────
function drawScanlines() {
  ctx.fillStyle = 'rgba(0,0,0,0.08)';
  for (let y=0; y<CH; y+=2) ctx.fillRect(0, y, CW, 1);
}

function drawFlash() {
  if (flashAlpha > 0) {
    ctx.fillStyle = `rgba(255,255,255,${flashAlpha})`;
    ctx.fillRect(0,0,CW,CH);
    flashAlpha = Math.max(0, flashAlpha - 0.08);
  }
}

// ─── MAIN GAME LOOP ──────────────────────────────────────────
function frame() {
  requestAnimationFrame(frame);
  tick++;
  waterAnim = (waterAnim + 0.008) % 1;

  ctx.clearRect(0,0,CW,CH);

  switch(gameState) {
    case 'title':
      renderTitle();
      if (anyConfirm()) {
        sfxConfirm();
        loadGame();
        gameState = 'explore';
      }
      break;

    case 'explore':
      updateMovement();
      updateCamera();
      renderMap();
      renderStatus();
      // Interaction check
      if (anyConfirm()) checkNpcInteract(true);
      break;

    case 'dialog':
      updateCamera();
      renderMap();
      renderStatus();
      renderDialog();
      updateDialog();
      break;

    case 'battle':
      updateBattle();
      renderBattle();
      break;

    case 'gameover':
      renderGameOver();
      if (anyConfirm()) {
        sfxConfirm();
        gameState = 'explore';
      }
      break;

    case 'levelup':
      levelUpData.timeout--;
      renderLevelUp();
      if (levelUpData.timeout <= 0 || anyConfirm()) {
        sfxConfirm();
        gameState = 'explore';
      }
      break;
  }

  drawFlash();
  drawScanlines();

  // Clear just-pressed
  Object.keys(JUST_PRESSED).forEach(k => delete JUST_PRESSED[k]);
}

// ─── INIT ────────────────────────────────────────────────────
(function init() {
  player.px = player.x * TILE;
  player.py = player.y * TILE;
  updateCamera();
  requestAnimationFrame(frame);
})();
