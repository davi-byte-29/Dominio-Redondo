(() => {
'use strict';

/* =====================================================================
   MOTOR DO JOGO (regras puras, sem DOM)
   ===================================================================== */
/* ===== ENGINE ===== */
const N = 5;            // tabuleiro 5x5
const CRIT = 4;         // a casa explode com 4 pontos
const DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];

function newState(n, first) {
  return {
    n,
    turn: first,
    grid: Array.from({ length: N }, () => Array.from({ length: N }, () => ({ o: -1, d: 0 }))),
    placed: Array(n).fill(false),
    elim: Array(n).fill(false),
  };
}
function cloneState(s) {
  return {
    n: s.n, turn: s.turn,
    grid: s.grid.map(r => r.map(c => ({ o: c.o, d: c.d }))),
    placed: s.placed.slice(), elim: s.elim.slice(),
  };
}
function countCells(s, p) {
  let k = 0;
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    const x = s.grid[r][c];
    if (x.o === p && x.d > 0) k++;
  }
  return k;
}
function validMove(s, p, r, c) {
  if (r < 0 || c < 0 || r >= N || c >= N) return false;
  const x = s.grid[r][c];
  return s.placed[p] ? (x.o === p && x.d > 0) : x.d === 0;
}
function listMoves(s, p) {
  const m = [];
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (validMove(s, p, r, c)) m.push({ r, c });
  return m;
}
function placeDot(s, p, r, c) {
  const x = s.grid[r][c];
  if (!s.placed[p]) { x.o = p; x.d = 3; s.placed[p] = true; }   // 1ª jogada: 3 pontos
  else x.d += 1;                                                // demais: +1
}
function hasCritical(g) {
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (g[r][c].d >= CRIT) return true;
  return false;
}
// Inicia uma "onda" de explosões simultâneas.
function explodeStart(g) {
  const ex = [], arr = [], out = [];
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++)
    if (g[r][c].d >= CRIT) ex.push({ r, c, o: g[r][c].o });
  for (const e of ex) {
    const cell = g[e.r][e.c];
    cell.d -= CRIT;
    if (cell.d === 0) cell.o = -1;
    for (const [dr, dc] of DIRS) {
      const nr = e.r + dr, nc = e.c + dc;
      if (nr >= 0 && nc >= 0 && nr < N && nc < N) arr.push({ r: nr, c: nc, o: e.o, from: e });
      else out.push({ r: e.r, c: e.c, dr, dc, o: e.o });
    }
  }
  return { ex, arr, out };
}
function applyArrivals(g, arr) {
  for (const a of arr) { const x = g[a.r][a.c]; x.o = a.o; x.d += 1; }
}
function updateElim(s) {
  for (let p = 0; p < s.n; p++)
    if (s.placed[p] && !s.elim[p] && countCells(s, p) === 0) s.elim[p] = true;
}
function winner(s) {
  let alive = -1, k = 0;
  for (let p = 0; p < s.n; p++) if (!s.elim[p]) { alive = p; k++; }
  return k === 1 ? alive : -1;
}
function nextTurn(s) {
  let guard = 0;
  do { s.turn = (s.turn + 1) % s.n; } while (s.elim[s.turn] && guard++ < 10);
}
function simResolve(s) {
  let guard = 0;
  while (guard++ < 400) {
    const ev = explodeStart(s.grid);
    if (!ev.ex.length) break;
    applyArrivals(s.grid, ev.arr);
    updateElim(s);
    if (winner(s) !== -1) break;
  }
}

/* ----- robô ----- */
function evalState(s, p) {
  const w = winner(s);
  if (w === p) return 10000;
  if (w !== -1) return -10000;
  let v = 0;
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    const x = s.grid[r][c];
    if (x.d <= 0) continue;
    const val = 1 + 0.25 * x.d;
    v += x.o === p ? val : -val;
  }
  return v;
}
function botMove(s, p) {
  const moves = listMoves(s, p);
  if (!moves.length) return null;
  let best = null, bestScore = -Infinity;
  for (const m of moves) {
    const s1 = cloneState(s);
    placeDot(s1, p, m.r, m.c);
    simResolve(s1);
    let score;
    if (winner(s1) === p) score = 10000;
    else {
      nextTurn(s1);
      const opp = s1.turn;
      const replies = listMoves(s1, opp);
      if (!replies.length || opp === p) score = evalState(s1, p);
      else {
        let worst = Infinity;
        for (const om of replies) {
          const s2 = cloneState(s1);
          placeDot(s2, opp, om.r, om.c);
          simResolve(s2);
          const v = evalState(s2, p);
          if (v < worst) worst = v;
        }
        score = worst;
      }
    }
    score += Math.random() * 0.8;
    if (score > bestScore) { bestScore = score; best = m; }
  }
  return best;
}
/* ===== /ENGINE ===== */

/* Hook para testes em Node */
if (typeof module !== 'undefined' && module.exports && typeof document === 'undefined') {
  module.exports = { N, CRIT, newState, cloneState, countCells, validMove, listMoves, placeDot, explodeStart, applyArrivals, updateElim, winner, nextTurn, simResolve, botMove };
  return;
}

/* =====================================================================
   INTERFACE
   ===================================================================== */
const $ = id => document.getElementById(id);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const waveMs = k => Math.max(110, 260 - (k - 1) * 22);   // cadeias longas ficam mais rápidas
let lastAccent = null;
const PREFIX = 'dominioredondo-v1-';

const COLORS = [
  { name: 'Rosa',     orb: '#ff3d6e', rgb: '255,61,110' },
  { name: 'Ciano',    orb: '#19e3ff', rgb: '25,227,255' },
  { name: 'Amarelo',  orb: '#ffd23f', rgb: '255,210,63' },
];
const DEFAULT_RGB = '25,227,255', DEFAULT_ACCENT = '#19e3ff';
// Servidores ICE: STUN + TURN público (ajuda celular 4G/5G <-> PC em redes diferentes)
const PEER_OPTS = {
  debug: 0,
  config: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:global.stun.twilio.com:3478' },
      { urls: ['turn:openrelay.metered.ca:80', 'turn:openrelay.metered.ca:443', 'turn:openrelay.metered.ca:443?transport=tcp'],
        username: 'openrelayproject', credential: 'openrelayproject' },
    ],
  },
};
const DOTS = {
  1: [[50, 50]],
  2: [[33, 50], [67, 50]],
  3: [[50, 32], [33, 64], [67, 64]],
  4: [[33, 33], [67, 33], [33, 67], [67, 67]],
};

let G = null;        // partida atual
let cells = [];      // elementos das casas
let slotEls = [];
let net = null;      // {role:'host'|'guest', code}
let peer = null, guestConn = null;
let lobby = { players: [] };
let lastLocal = 1;

/* ---------- utilidades de tela ---------- */
function show(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === 'screen-' + id));
  document.body.classList.toggle('ingame', id === 'game');
  if (id !== 'game') resetTheme();
}
function resetTheme() {
  const st = document.documentElement.style;
  lastAccent = null;
  st.setProperty('--accent', DEFAULT_ACCENT);
  st.setProperty('--rgb', DEFAULT_RGB);
}
let toastT = null;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2800);
}
const cleanName = s => (s || '').replace(/[<>&"']/g, '').trim().slice(0, 12);
const shortName = s => (s.length > 8 ? s.slice(0, 8) + '…' : s);

let actx = null;
function sfx(kind) {
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
    const o = actx.createOscillator(), g = actx.createGain(), t = actx.currentTime;
    o.connect(g); g.connect(actx.destination);
    if (kind === 'boom') {
      o.type = 'triangle';
      o.frequency.setValueAtTime(260, t); o.frequency.exponentialRampToValueAtTime(90, t + .18);
      g.gain.setValueAtTime(.16, t); g.gain.exponentialRampToValueAtTime(.001, t + .2);
      o.start(t); o.stop(t + .22);
    } else {
      o.type = 'sine';
      o.frequency.setValueAtTime(520, t);
      g.gain.setValueAtTime(.1, t); g.gain.exponentialRampToValueAtTime(.001, t + .1);
      o.start(t); o.stop(t + .12);
    }
  } catch (e) { /* sem áudio */ }
}

/* ---------- menus ---------- */
$('btn-online').onclick = () => { show('online'); $('online-status').textContent = ''; };
$('btn-local').onclick = () => show('local');
$('btn-rules').onclick = () => $('modal-rules').classList.add('show');
$('btn-rules-close').onclick = () => $('modal-rules').classList.remove('show');
document.querySelectorAll('[data-back]').forEach(b => b.onclick = () => show(b.dataset.back));
document.querySelectorAll('[data-local]').forEach(b => b.onclick = () => startLocal(+b.dataset.local));

function startLocal(k) {
  lastLocal = k;
  const players = [];
  for (let i = 0; i < k; i++) players.push({ name: 'Jogador ' + (i + 1), kind: 'human' });
  if (k === 1) players.push({ name: 'Robô', kind: 'bot' });
  startGame({ online: false, players, me: -1, first: Math.floor(Math.random() * players.length), authority: true });
}

/* =====================================================================
   PARTIDA
   ===================================================================== */
function startGame(cfg) {
  const n = cfg.players.length;
  G = {
    online: cfg.online, authority: cfg.authority, me: cfg.me,
    players: cfg.players.map(p => ({ name: p.name, kind: p.kind, conn: p.conn || null })),
    st: newState(n, cfg.first),
    busy: false, over: false, chain: Promise.resolve(),
  };
  buildBoard();
  buildSlots();
  $('result').classList.remove('show');
  show('game');
  updateHUD(); renderBoard();
  maybeBot();
}

function buildBoard() {
  const grid = $('grid');
  grid.innerHTML = ''; $('fx').innerHTML = '';
  cells = [];
  for (let r = 0; r < N; r++) {
    cells.push([]);
    for (let c = 0; c < N; c++) {
      const d = document.createElement('div');
      d.className = 'cell';
      d.addEventListener('click', () => onCell(r, c));
      grid.appendChild(d);
      cells[r].push(d);
    }
  }
}

function slotFor(i) {
  const n = G.players.length;
  if (!G.online) return ['br', 'tlf', 'bl'][i];
  if (i === G.me) return 'br';
  const others = [];
  for (let k = 0; k < n; k++) if (k !== G.me) others.push(k);
  return ['tl', 'tr'][others.indexOf(i)];
}
function turnText(p) {
  const pl = G.players[p];
  if (G.online) return p === G.me ? 'Sua vez!' : 'Vez de ' + shortName(pl.name);
  return pl.kind === 'bot' ? 'Vez do Robô' : 'Sua vez!';
}
function buildSlots() {
  const box = $('slots');
  box.innerHTML = ''; slotEls = [];
  G.players.forEach((pl, i) => {
    const el = document.createElement('div');
    el.className = 'slot o' + i + ' ' + slotFor(i);
    el.innerHTML = `<div class="pill"><span>0</span></div><div class="turnb"><span>${turnText(i)}</span></div>`;
    box.appendChild(el);
    slotEls.push(el);
  });
  const chips = $('chips');
  chips.innerHTML = '';
  G.players.forEach((pl, i) => {
    const ch = document.createElement('div');
    ch.className = 'pc o' + i;
    ch.innerHTML = '<i></i><span class="nm"></span><b class="cnt">0</b><em>VEZ</em>';
    ch.querySelector('.nm').textContent = pl.name + (G.online && i === G.me ? ' (você)' : '');
    chips.appendChild(ch);
  });
}

function orbHtml(x) {
  const pts = DOTS[Math.min(x.d, 4)];
  return `<div class="orb o${x.o}">` + pts.map(p => `<i style="left:${p[0]}%;top:${p[1]}%"></i>`).join('') + '</div>';
}
function renderBoard() {
  const st = G.st;
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    const x = st.grid[r][c], el = cells[r][c];
    const sig = x.d > 0 ? x.o + ':' + Math.min(x.d, 4) : '';
    if (el._sig !== sig) { el._sig = sig; el.innerHTML = x.d > 0 ? orbHtml(x) : ''; }
    el.classList.toggle('mine', !G.over && x.d > 0 && x.o === st.turn);
  }
}
function updateHUD() {
  const st = G.st, col = COLORS[st.turn], root = document.documentElement.style;
  if (lastAccent !== col.orb) { lastAccent = col.orb; root.setProperty('--accent', col.orb); root.setProperty('--rgb', col.rgb); }
  G.players.forEach((pl, i) => {
    const el = slotEls[i], n = countCells(st, i);
    el.querySelector('.pill span').textContent = n;
    el.classList.toggle('active', !G.over && st.turn === i);
    el.classList.toggle('dead', st.elim[i]);
  });
  Array.from($('chips').children).forEach((ch, i) => {
    ch.querySelector('.cnt').textContent = countCells(st, i);
    ch.classList.toggle('dead', st.elim[i]);
    ch.classList.toggle('turn', !G.over && st.turn === i);
  });
  const p = st.turn;
  $('hint').textContent = G.over ? '' :
    (!st.placed[p] ? 'Toque em uma casa vazia: ela recebe 3 pontos.' : 'Toque em uma casa sua para somar 1 ponto.');
}

/* ---------- jogadas ---------- */
function onCell(r, c) {
  if (!G || G.busy || G.over) return;
  const p = G.st.turn;
  if (G.players[p].kind !== 'human') return;
  if (G.online && p !== G.me) return;
  if (!validMove(G.st, p, r, c)) {
    const el = cells[r][c];
    el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake');
    return;
  }
  if (G.online && !G.authority) { guestConn && guestConn.open && guestConn.send({ t: 'move', r, c }); return; }
  submit(p, r, c);
}
function broadcast(msg) {
  G.players.forEach(pl => { if (pl.conn && pl.conn.open) pl.conn.send(msg); });
}
function enqueue(fn) {
  const g = G;
  g.chain = g.chain.then(() => (G === g ? fn() : null)).catch(e => console.error(e));
}
function submit(p, r, c) {          // só quem é "autoridade" (local ou anfitrião)
  G.busy = true;
  if (G.online) broadcast({ t: 'move', p, r, c });
  enqueue(() => playMove(p, r, c));
}

async function playMove(p, r, c) {
  const g = G;
  try { await playMoveInner(p, r, c); }
  catch (e) {                       // nunca deixa o jogo travado
    console.error(e);
    if (G === g) {
      g.busy = false; $('fx').innerHTML = '';
      try { updateHUD(); renderBoard(); sendSync(); } catch (_) {}
    }
  }
}
async function playMoveInner(p, r, c) {
  const g = G, st = g.st;
  if (g.over) return;
  g.busy = true;
  placeDot(st, p, r, c);
  sfx('tap');
  updateHUD(); renderBoard();
  const fast = document.hidden;                 // aba em segundo plano: sem animação
  if (!fast && hasCritical(st.grid)) await sleep(110);
  let guard = 0;
  while (guard++ < 400 && G === g) {
    const ev = explodeStart(st.grid);
    if (!ev.ex.length) break;
    if (!fast && guard <= 14) {                 // cadeias muito longas: o resto resolve na hora
      const wm = waveMs(guard);
      if (guard <= 6) sfx('boom');
      renderBoard();
      spawnFlyers(ev, wm);
      await sleep(wm);
      $('fx').innerHTML = '';
    }
    applyArrivals(st.grid, ev.arr);
    updateElim(st);
    if (!fast && guard <= 14) { renderBoard(); updateHUD(); }
    if (winner(st) !== -1) break;
  }
  if (G !== g) return;
  $('fx').innerHTML = '';
  renderBoard(); updateHUD();
  updateElim(st);
  const w = winner(st);
  if (w !== -1) { g.over = true; g.busy = false; updateHUD(); renderBoard(); sendSync(); setTimeout(() => G === g && showResult(w), 700); return; }
  nextTurn(st);
  g.busy = false;
  updateHUD(); renderBoard();
  sendSync();
  maybeBot();
}

function cellBox(r, c) {
  const e = cells[r][c];
  return { x: e.offsetLeft + e.offsetWidth / 2, y: e.offsetTop + e.offsetHeight / 2, w: e.offsetWidth };
}
function fly(a, b, o, fade, dur) {
  const s = a.w * 0.5, el = document.createElement('div');
  el.className = 'fly o' + o;
  el.style.cssText = `width:${s}px;height:${s}px;left:${a.x - s / 2}px;top:${a.y - s / 2}px`;
  $('fx').appendChild(el);
  if (el.animate) el.animate([
    { transform: 'translate(0,0) scale(1)', opacity: 1 },
    { transform: `translate(${b.x - a.x}px,${b.y - a.y}px) scale(${fade ? 0.6 : 1})`, opacity: fade ? 0 : 1 },
  ], { duration: dur - 15, easing: 'cubic-bezier(.5,0,.8,.6)', fill: 'forwards' });
}
function spawnFlyers(ev, dur) {
  for (const e of ev.ex) {
    const el = cells[e.r][e.c];
    el.classList.remove('boom'); void el.offsetWidth; el.classList.add('boom');
    setTimeout(() => el.classList.remove('boom'), 320);
  }
  for (const a of ev.arr) fly(cellBox(a.from.r, a.from.c), cellBox(a.r, a.c), a.o, false, dur);
  for (const o of ev.out) {
    const from = cellBox(o.r, o.c);
    fly(from, { x: from.x + o.dc * from.w * 0.9, y: from.y + o.dr * from.w * 0.9 }, o.o, true, dur);
  }
}

/* ---------- sincronização (mantém PC e celular idênticos) ---------- */
function snap(st) {
  const o = [], d = [];
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) { o.push(st.grid[r][c].o); d.push(st.grid[r][c].d); }
  return { turn: st.turn, placed: st.placed.slice(), elim: st.elim.slice(), o, d };
}
function sendSync() {
  if (G && G.online && G.authority) broadcast({ t: 'sync', s: snap(G.st) });
}
function applySync(m) {
  const g = G, st = g.st, s = m.s;
  if (!s || !s.o || s.o.length !== N * N) return;
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) { st.grid[r][c].o = s.o[r * N + c]; st.grid[r][c].d = s.d[r * N + c]; }
  st.turn = s.turn; st.placed = s.placed.slice(); st.elim = s.elim.slice();
  const w = winner(st);
  if (w !== -1 && !g.over) { g.over = true; updateHUD(); renderBoard(); setTimeout(() => G === g && showResult(w), 700); return; }
  updateHUD(); renderBoard();
}

/* ---------- robô ---------- */
function maybeBot() {
  const g = G;
  if (!g || !g.authority || g.over) return;
  if (g.players[g.st.turn].kind !== 'bot') return;
  const run = () => {
    if (G !== g || g.over) return;
    if (g.busy) { setTimeout(run, 200); return; }
    const p = g.st.turn;
    if (g.players[p].kind !== 'bot') return;
    const m = botMove(g.st, p);
    if (m) submit(p, m.r, m.c);
  };
  setTimeout(run, 420);
}

/* ---------- jogador saiu (online) ---------- */
function dropPlayer(p) {
  const g = G, st = g.st;
  if (!g || g.over || st.elim[p]) return;
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++)
    if (st.grid[r][c].o === p) { st.grid[r][c].o = -1; st.grid[r][c].d = 0; }
  st.elim[p] = true;
  g.players[p].name += ' (saiu)';
  const w = winner(st);
  if (w !== -1) { g.over = true; g.busy = false; updateHUD(); renderBoard(); showResult(w); return; }
  if (st.turn === p) nextTurn(st);
  updateHUD(); renderBoard();
  maybeBot();
}

/* ---------- fim de jogo ---------- */
function showResult(w) {
  const g = G;
  const pl = g.players[w];
  $('result-orb').style.setProperty('--oc', COLORS[w].orb);
  $('result-title').textContent = (g.online && w === g.me) ? 'Você venceu! 🏆' : pl.name.replace(' (saiu)', '') + ' venceu! 🏆';
  const canRestart = !g.online || g.authority;
  $('btn-again').hidden = !canRestart;
  $('result-wait').hidden = canRestart;
  $('result').classList.add('show');
}
$('btn-again').onclick = () => {
  if (!G) return;
  if (!G.online) startLocal(lastLocal);
  else if (G.authority) hostStart();
};
$('btn-menu').onclick = leaveToMenu;
$('btn-quit').onclick = () => { if (confirm('Sair da partida?')) leaveToMenu(); };

function leaveToMenu() {
  cleanupNet();
  G = null;
  $('result').classList.remove('show');
  show('home');
}

/* =====================================================================
   ONLINE (salas via PeerJS)
   ===================================================================== */
const myName = () => cleanName($('nick').value) || 'Jogador';
const setStatus = t => { $('online-status').textContent = t; };
function genCode() {
  const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 5; i++) s += a[Math.floor(Math.random() * a.length)];
  return s;
}
let hbTimer = null, lastRx = 0;
function stopHeartbeat() { clearInterval(hbTimer); hbTimer = null; }
function cleanupNet() {
  stopHeartbeat();
  const n = net, p = peer, gc = guestConn;
  net = null; peer = null; guestConn = null; lobby = { players: [] };
  try { if (n && n.role === 'host') G && G.players.forEach(pl => pl.conn && pl.conn.close()); } catch (e) {}
  try { gc && gc.close(); } catch (e) {}
  try { p && p.destroy(); } catch (e) {}
}

/* PeerJS é carregado só quando o jogador entra no modo online (o resto do jogo abre na hora) */
let peerLoading = null;
function ensurePeer() {
  if (typeof Peer !== 'undefined') return Promise.resolve();
  if (peerLoading) return peerLoading;
  const urls = ['https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js', 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js'];
  peerLoading = new Promise((resolve, reject) => {
    let i = 0;
    const next = () => {
      if (i >= urls.length) { peerLoading = null; reject(new Error('peerjs')); return; }
      const sc = document.createElement('script');
      sc.src = urls[i++];
      sc.onload = () => resolve();
      sc.onerror = () => { sc.remove(); next(); };
      document.head.appendChild(sc);
    };
    next();
  });
  return peerLoading;
}
const peerFail = () => setStatus('Biblioteca online não carregou. Verifique a internet.');

/* --- criar sala (anfitrião) --- */
$('btn-create').onclick = () => {
  setStatus('Carregando...');
  ensurePeer().then(() => {
    cleanupNet();
    setStatus('Criando sala...');
    tryCreate(0);
  }).catch(peerFail);
};
function tryCreate(attempt) {
  const code = genCode();
  const p = new Peer(PREFIX + code, PEER_OPTS);
  peer = p;
  p.on('open', () => {
    if (peer !== p) return;
    net = { role: 'host', code };
    lobby = { code, players: [{ name: myName(), conn: null }] };
    stopHeartbeat();
    hbTimer = setInterval(hostHeartbeat, 5000);
    renderLobby(); show('lobby');
  });
  p.on('disconnected', () => { if (peer === p && !p.destroyed) { try { p.reconnect(); } catch (e) {} } });
  p.on('connection', conn => {
    if (peer !== p) return;
    conn._seen = Date.now();
    conn.on('data', msg => { conn._seen = Date.now(); hostOnData(conn, msg); });
    conn.on('close', () => hostOnClose(conn));
    conn.on('error', () => hostOnClose(conn));
  });
  p.on('error', err => {
    if (peer !== p) return;
    if (err.type === 'unavailable-id' && attempt < 5) { try { p.destroy(); } catch (e) {} peer = null; tryCreate(attempt + 1); return; }
    setStatus('Não foi possível criar a sala. Tente novamente.');
    cleanupNet();
  });
}
function hostHeartbeat() {
  if (!net || net.role !== 'host') return;
  const now = Date.now();
  lobby.players.slice().forEach(pl => {
    if (pl.conn && now - (pl.conn._seen || now) > 30000) { try { pl.conn.close(); } catch (e) {} hostOnClose(pl.conn); }
  });
}
function hostOnData(conn, msg) {
  if (!net || net.role !== 'host' || !msg) return;
  if (msg.t === 'ping') { if (conn.open) conn.send({ t: 'pong' }); return; }
  if (msg.t === 'join') {
    if ((G && !G.over) || lobby.players.length >= 3) { conn.send({ t: 'full' }); setTimeout(() => { try { conn.close(); } catch (e) {} }, 400); return; }
    if (lobby.players.some(x => x.conn === conn)) return;
    lobby.players.push({ name: cleanName(msg.name) || 'Jogador', conn });
    broadcastLobby();
  } else if (msg.t === 'move') {
    if (!G || !G.online || G.busy || G.over) return;
    const p = G.players.findIndex(x => x.conn === conn);
    const r = msg.r | 0, c = msg.c | 0;
    if (p < 0 || p !== G.st.turn || !validMove(G.st, p, r, c)) return;
    submit(p, r, c);
  }
}
function hostOnClose(conn) {
  if (!net || net.role !== 'host') return;
  const i = lobby.players.findIndex(x => x.conn === conn);
  if (i >= 0) lobby.players.splice(i, 1);
  if (G && G.online && !G.over) {
    const p = G.players.findIndex(x => x.conn === conn);
    if (p >= 0) { G.players[p].conn = null; broadcast({ t: 'drop', p }); enqueue(() => dropPlayer(p)); }
  }
  if (document.getElementById('screen-lobby').classList.contains('active')) broadcastLobby();
}
function broadcastLobby() {
  const names = lobby.players.map(x => x.name);
  lobby.players.forEach((pl, i) => { if (pl.conn && pl.conn.open) pl.conn.send({ t: 'lobby', names, you: i, code: lobby.code }); });
  renderLobby();
}
function hostStart() {
  if (!net || net.role !== 'host' || !lobby.players.length) return;
  const players = lobby.players.map(x => ({ name: x.name, kind: 'human', conn: x.conn }));
  if (players.length === 1) players.push({ name: 'Robô', kind: 'bot', conn: null });
  const first = Math.floor(Math.random() * players.length);
  const info = players.map(p => ({ name: p.name, kind: p.kind }));
  players.forEach((p, i) => { if (p.conn && p.conn.open) p.conn.send({ t: 'start', players: info, you: i, first }); });
  startGame({ online: true, players, me: 0, first, authority: true });
}

/* --- entrar na sala (convidado) --- */
$('btn-join').onclick = joinRoom;
function joinRoom() {
  const code = ($('code-input').value || '').trim().toUpperCase();
  if (code.length < 4) { setStatus('Digite o código da sala.'); return; }
  setStatus('Conectando...');
  ensurePeer().then(() => doJoin(code)).catch(peerFail);
}
function doJoin(code) {
  cleanupNet();
  setStatus('Conectando...');
  const p = new Peer(undefined, PEER_OPTS);
  peer = p;
  let opened = false;
  const to = setTimeout(() => { if (!opened && peer === p) { setStatus('Não foi possível conectar. Confira o código.'); cleanupNet(); } }, 20000);
  p.on('open', () => {
    if (peer !== p) return;
    const conn = p.connect(PREFIX + code, { reliable: true });
    guestConn = conn;
    net = { role: 'guest', code };
    conn.on('open', () => {
      opened = true; clearTimeout(to); lastRx = Date.now();
      conn.send({ t: 'join', name: myName() });
      stopHeartbeat();
      hbTimer = setInterval(() => {
        if (!net || net.role !== 'guest') return;
        if (Date.now() - lastRx > 30000) { guestOnClose('Conexão perdida com o anfitrião.'); return; }
        if (conn.open) conn.send({ t: 'ping' });
      }, 5000);
    });
    conn.on('data', guestOnData);
    conn.on('close', () => guestOnClose());
    conn.on('error', () => {});
  });
  p.on('error', err => {
    if (peer !== p) return;
    clearTimeout(to);
    setStatus(err.type === 'peer-unavailable' ? 'Sala não encontrada.' : 'Erro de conexão. Tente novamente.');
    cleanupNet();
  });
}
function guestOnData(msg) {
  if (!net || net.role !== 'guest' || !msg) return;
  lastRx = Date.now();
  if (msg.t === 'pong') return;
  if (msg.t === 'sync') { if (G) enqueue(() => applySync(msg)); return; }
  if (msg.t === 'lobby') {
    lobby = { code: msg.code, you: msg.you, players: msg.names.map(n => ({ name: n })) };
    renderLobby(); show('lobby');
  } else if (msg.t === 'full') {
    cleanupNet(); show('online'); setStatus('Sala cheia ou partida em andamento.');
  } else if (msg.t === 'start') {
    startGame({ online: true, players: msg.players, me: msg.you, first: msg.first, authority: false });
  } else if (msg.t === 'move') {
    if (!G) return;
    enqueue(() => playMove(msg.p, msg.r, msg.c));
  } else if (msg.t === 'drop') {
    if (!G) return;
    enqueue(() => dropPlayer(msg.p));
  }
}
function guestOnClose(reason) {
  if (!net || net.role !== 'guest') return;
  cleanupNet(); G = null;
  $('result').classList.remove('show');
  show('home');
  toast(typeof reason === 'string' ? reason : 'O anfitrião saiu da sala.');
}

/* --- lobby --- */
function renderLobby() {
  const isHost = net && net.role === 'host';
  const code = lobby.code || (net && net.code) || '-----';
  $('room-code').textContent = code;
  const ul = $('lobby-list');
  ul.innerHTML = '';
  for (let i = 0; i < 3; i++) {
    const li = document.createElement('li');
    const pl = lobby.players[i];
    li.innerHTML = '<i></i><span></span><b></b>';
    li.className = 'o' + i;
    if (pl) {
      li.children[1].textContent = pl.name;
      li.children[2].textContent = i === 0 ? 'ANFITRIÃO' : '';
    } else { li.className += ' empty'; li.children[1].textContent = 'Aguardando jogador...'; }
    ul.appendChild(li);
  }
  const n = lobby.players.length;
  $('btn-start').hidden = !isHost;
  $('btn-start').textContent = n === 1 ? 'Jogar sozinho (contra o robô)' : 'Iniciar jogo (' + n + ' jogadores)';
  $('lobby-info').textContent = isHost
    ? 'Passe o código ou o link para até 2 amigos entrarem (celular, tablet ou PC).'
    : 'Aguardando o anfitrião iniciar a partida...';
}
$('btn-start').onclick = hostStart;
$('btn-leave').onclick = () => { cleanupNet(); G = null; show('online'); setStatus(''); };
function copyText(t, ok) {
  const done = () => toast(ok);
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(done, () => toast(t));
  else { toast(t); }
}
$('btn-copy-code').onclick = () => copyText(lobby.code || '', 'Código copiado!');
const roomLink = () => location.origin + location.pathname + '?sala=' + (lobby.code || '');
$('btn-copy-link').onclick = () => {
  if (location.protocol === 'file:') { toast('Para usar link, hospede o site. Use o código da sala.'); return; }
  copyText(roomLink(), 'Link copiado!');
};
if (navigator.share) {
  $('btn-share').hidden = false;
  $('btn-share').onclick = () => {
    const text = 'Entre na minha sala do Dominio Redondo! Código: ' + (lobby.code || '');
    const data = location.protocol === 'file:' ? { title: 'Dominio Redondo', text } : { title: 'Dominio Redondo', text, url: roomLink() };
    navigator.share(data).catch(() => {});
  };
}

/* entrar direto pelo link ?sala=CODIGO */
(function () {
  const m = /[?&]sala=([A-Za-z0-9]{4,5})/.exec(location.search);
  if (m) { $('code-input').value = m[1].toUpperCase(); show('online'); setStatus('Digite seu apelido e toque em "Entrar na sala".'); }
})();
$('code-input').addEventListener('input', e => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); });
})();
