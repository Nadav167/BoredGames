// BoredGames – Rummikub (רמי) engine
// 106 tiles: 1–13 in four colours, twice each, plus 2 jokers. Everyone starts with 14.
// Sets: group (3–4 tiles, same number, different colours) or run (3+ consecutive numbers, same colour).
// A turn either lays tiles (rearranging the table freely, as long as every set is valid at the end)
// or draws one tile. The first lay ("opening") must be ≥30 points from your own tiles, without touching the table.
// Empty rack wins. If the pool runs out and everyone passes in a row, the lowest rack wins.

export const COLORS = ['red', 'blue', 'black', 'orange'];
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

export function newGame(order, timeLimit = 0) {
  const pool = []; let id = 0;
  for (let k = 0; k < 2; k++) for (const c of COLORS) for (let n = 1; n <= 13; n++) pool.push({ id: id++, n, c });
  pool.push({ id: id++, j: true }, { id: id++, j: true });
  shuffle(pool);
  const racks = {}; for (const p of order) racks[p] = pool.splice(pool.length - 14, 14);
  return { order, racks, pool, table: [], opened: {}, turn: order[Math.floor(Math.random() * order.length)],
    passes: 0, winner: '', last: '', timeLimit, turnStart: Date.now() };
}

export function norm(s) {
  s.order = Object.values(s.order || []);
  s.racks = s.racks || {}; for (const p of s.order) s.racks[p] = s.racks[p] ? Object.values(s.racks[p]) : [];
  s.pool = s.pool ? Object.values(s.pool) : [];
  s.table = s.table ? Object.values(s.table).map(x => Object.values(x)) : [];
  s.opened = s.opened || {}; s.passes = s.passes || 0; s.winner = s.winner || ''; s.last = s.last || '';
  s.timeLimit = s.timeLimit || 0;
  return s;
}

// Validate a set; returns { ok, kind, value, nums } where nums[i] is the number each tile stands for.
export function checkSet(tiles) {
  const n = tiles.length;
  if (n < 3) return { ok: false };
  const real = tiles.filter(t => !t.j), jokers = n - real.length;
  if (!real.length) return { ok: true, kind: 'group', value: 0, nums: tiles.map(() => 0) };
  // group
  if (n <= 4 && real.every(t => t.n === real[0].n) && new Set(real.map(t => t.c)).size === real.length) {
    return { ok: true, kind: 'group', value: real[0].n * n, nums: tiles.map(() => real[0].n) };
  }
  // run
  if (n > 13 || !real.every(t => t.c === real[0].c)) return { ok: false };
  const ns = real.map(t => t.n).sort((a, b) => a - b);
  if (new Set(ns).size !== ns.length) return { ok: false };
  const span = ns[ns.length - 1] - ns[0] + 1;
  if (span > n) return { ok: false };
  let start = ns[0], end = ns[0] + n - 1;
  if (end > 13) { start -= end - 13; end = 13; }
  if (start < 1) return { ok: false };
  let value = 0; for (let v = start; v <= end; v++) value += v;
  return { ok: true, kind: 'run', value, start, nums: null };
}

// display order for a set: runs sorted by the number each tile stands for, jokers in the gaps
export function arrange(tiles) {
  const r = checkSet(tiles);
  if (!r.ok) return [...tiles].sort((a, b) => (a.j ? 99 : a.n) - (b.j ? 99 : b.n));
  if (r.kind === 'group') return [...tiles].sort((a, b) => (a.j ? 9 : COLORS.indexOf(a.c)) - (b.j ? 9 : COLORS.indexOf(b.c)));
  const out = [], jk = tiles.filter(t => t.j), byN = {};
  for (const t of tiles) if (!t.j) byN[t.n] = t;
  for (let v = r.start; v < r.start + tiles.length; v++) out.push(byN[v] || jk.pop());
  return out;
}

export const tileValue = t => t.j ? 30 : t.n;
export const rackValue = rack => rack.reduce((a, t) => a + tileValue(t), 0);
const ids = arr => arr.map(t => t.id).sort((a, b) => a - b).join(',');

// Commit a whole turn: newTable = array of arrays of tile ids, newRack = array of tile ids
export function commit(s, p, newTable, newRack) {
  if (s.winner) return 'over';
  if (s.turn !== p) return 'turn';
  const all = new Map();
  for (const t of s.racks[p]) all.set(t.id, t);
  for (const set of s.table) for (const t of set) all.set(t.id, t);
  const usedIds = [...newTable.flat(), ...newRack];
  if (usedIds.length !== all.size || new Set(usedIds).size !== usedIds.length || usedIds.some(id => !all.has(id))) return 'tiles';
  const rackIds = new Set(s.racks[p].map(t => t.id));
  if (!newRack.every(id => rackIds.has(id))) return 'rack';            // can't take table tiles home
  if (newRack.length >= s.racks[p].length) return 'none';
  const tbl = newTable.filter(x => x.length).map(x => x.map(id => all.get(id)));
  if (!tbl.every(x => checkSet(x).ok)) return 'invalid';
  if (!s.opened[p]) {
    const oldKeys = s.table.map(ids), newKeys = tbl.map(ids);
    const remaining = [...newKeys];
    for (const k of oldKeys) { const i = remaining.indexOf(k); if (i < 0) return 'touched'; remaining.splice(i, 1); }
    const fresh = tbl.filter(x => remaining.includes(ids(x)));
    if (!fresh.every(x => x.every(t => rackIds.has(t.id)))) return 'touched';
    const pts = fresh.reduce((a, x) => a + checkSet(x).value, 0);
    if (pts < 30) return 'open30';
    s.opened[p] = true;
  }
  s.table = tbl;
  s.racks[p] = s.racks[p].filter(t => newRack.includes(t.id));
  s.passes = 0;
  s.last = `${p}:play:${s.racks[p].length}`;
  if (!s.racks[p].length) { s.winner = p; return null; }
  nextTurn(s);
  return null;
}

export function draw(s, p) {
  if (s.winner) return 'over';
  if (s.turn !== p) return 'turn';
  if (s.pool.length) { s.racks[p].push(s.pool.pop()); s.passes = 0; s.last = `${p}:draw`; }
  else {
    s.passes++; s.last = `${p}:pass`;
    if (s.passes >= s.order.length) {           // pool empty and nobody can play: lowest rack wins
      let best = null; for (const q of s.order) if (!best || rackValue(s.racks[q]) < rackValue(s.racks[best])) best = q;
      s.winner = best; s.endByPool = true; return null;
    }
  }
  nextTurn(s);
  return null;
}
function nextTurn(s) { s.turn = s.order[(s.order.indexOf(s.turn) + 1) % s.order.length]; s.turnStart = Date.now(); }

// ---------- bot ----------
function findSets(rack) {
  const tiles = rack.filter(t => !t.j), jokers = rack.filter(t => t.j);
  const cands = [];
  // groups
  for (let n = 1; n <= 13; n++) {
    const byC = {}; for (const t of tiles) if (t.n === n && !byC[t.c]) byC[t.c] = t;
    const g = Object.values(byC);
    if (g.length >= 3) cands.push(g.slice(0, 4));
    else if (g.length === 2 && jokers.length) cands.push([...g, jokers[0]]);
  }
  // runs
  for (const c of COLORS) {
    const byN = {}; for (const t of tiles) if (t.c === c && !byN[t.n]) byN[t.n] = t;
    let run = [];
    for (let n = 1; n <= 14; n++) {
      if (byN[n]) run.push(byN[n]);
      else {
        if (run.length >= 3) cands.push(run);
        else if (run.length === 2 && jokers.length) cands.push([...run, jokers[0]]);
        run = [];
      }
    }
  }
  return cands;
}
function pickSets(rack) {
  const cands = findSets(rack).sort((a, b) => b.length - a.length || checkSet(b).value - checkSet(a).value);
  const used = new Set(), chosen = [];
  for (const set of cands) {
    if (set.some(t => used.has(t.id))) continue;
    if (!checkSet(set).ok) continue;
    chosen.push(set); set.forEach(t => used.add(t.id));
  }
  return chosen;
}
export function botTurn(s, p) {
  const rack = [...s.racks[p]];
  const table = s.table.map(x => [...x]);
  let sets = pickSets(rack);
  if (!s.opened[p]) {
    const pts = sets.reduce((a, x) => a + checkSet(x).value, 0);
    if (pts < 30) return { type: 'draw' };
  } else {
    // lay off single tiles onto table sets
    const used = new Set(sets.flat().map(t => t.id));
    let progress = true;
    while (progress) {
      progress = false;
      for (const t of rack) {
        if (used.has(t.id) || t.j) continue;
        for (const set of table) if (checkSet([...set, t]).ok) { set.push(t); used.add(t.id); progress = true; break; }
      }
    }
    const laid = rack.filter(t => used.has(t.id) && !sets.flat().some(x => x.id === t.id));
    if (!sets.length && !laid.length) return { type: 'draw' };
  }
  const newTable = [...table, ...sets].map(x => x.map(t => t.id));
  const placed = new Set(newTable.flat());
  const newRack = rack.filter(t => !placed.has(t.id)).map(t => t.id);
  if (newRack.length === rack.length) return { type: 'draw' };
  return { type: 'play', table: newTable, rack: newRack };
}
