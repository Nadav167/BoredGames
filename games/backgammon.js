// BoredGames – Backgammon (שש-בש) engine
// pts[i], i = 0..23 is point number i+1 from white's side. >0 white checkers, <0 black checkers.
// White moves down (24 → 1, home = points 1–6), black moves up (home = points 19–24).
// A step is { from, to, die }: from = 'bar' or index, to = index or 'off'.

const other = t => t === 'w' ? 'b' : 'w';
const sign = t => t === 'w' ? 1 : -1;
const mine = (v, t) => v * sign(t) > 0;

export function newGame() {
  const pts = Array(24).fill(0);
  const set = (point, n) => { pts[point - 1] = n; };
  set(24, 2); set(13, 5); set(8, 3); set(6, 5);          // white
  set(1, -2); set(12, -5); set(17, -3); set(19, -5);     // black
  return { pts, bar: { w: 0, b: 0 }, off: { w: 0, b: 0 }, turn: Math.random() < 0.5 ? 'w' : 'b', dice: [], used: [], winner: '', last: '' };
}

export function norm(s) {
  const p = s.pts || {}; s.pts = Array.from({ length: 24 }, (_, i) => p[i] || 0);
  s.bar = { w: s.bar?.w || 0, b: s.bar?.b || 0 };
  s.off = { w: s.off?.w || 0, b: s.off?.b || 0 };
  s.dice = s.dice ? Object.values(s.dice) : [];
  s.rolled = s.rolled ? Object.values(s.rolled) : null;
  s.winner = s.winner || ''; s.last = s.last || '';
  return s;
}
const clone = s => ({ ...s, pts: [...s.pts], bar: { ...s.bar }, off: { ...s.off }, dice: [...s.dice] });

function allHome(s, t) {
  if (s.bar[t]) return false;
  for (let i = 0; i < 24; i++) if (mine(s.pts[i], t) && (t === 'w' ? i > 5 : i < 18)) return false;
  return true;
}

// legal single steps for one die (ignores "must use both dice")
function stepsForDie(s, t, die) {
  const out = [];
  const open = i => s.pts[i] * sign(t) >= -1;
  if (s.bar[t]) {
    const to = t === 'w' ? 24 - die : die - 1;
    if (open(to)) out.push({ from: 'bar', to, die });
    return out;
  }
  const home = allHome(s, t);
  for (let i = 0; i < 24; i++) {
    if (!mine(s.pts[i], t)) continue;
    const to = t === 'w' ? i - die : i + die;
    if (to >= 0 && to < 24) { if (open(to)) out.push({ from: i, to, die }); continue; }
    if (!home) continue;
    const dist = t === 'w' ? i + 1 : 24 - i;          // pips needed to bear off exactly
    if (dist === die) { out.push({ from: i, to: 'off', die }); continue; }
    // higher die: only if no checker on a higher point
    let further = false;
    for (let j = 0; j < 24; j++) if (mine(s.pts[j], t) && (t === 'w' ? j > i : j < i)) further = true;
    if (!further) out.push({ from: i, to: 'off', die });
  }
  return out;
}

export function applyStep(s, st) {
  const t = s.turn, sg = sign(t);
  if (st.from === 'bar') s.bar[t]--; else s.pts[st.from] -= sg;
  if (st.to === 'off') s.off[t]++;
  else {
    if (s.pts[st.to] === -sg) { s.pts[st.to] = 0; s.bar[other(t)]++; st.hit = true; }
    s.pts[st.to] += sg;
  }
  const k = s.dice.indexOf(st.die); s.dice.splice(k, 1);
  return s;
}

// All maximal legal step sequences for the current dice.
export function sequences(s) {
  const t = s.turn, res = [];
  let best = 0;
  (function dfs(st, seq) {
    const dice = [...new Set(st.dice)];
    let moved = false;
    for (const d of dice) for (const step of stepsForDie(st, t, d)) {
      moved = true;
      dfs(applyStep(clone(st), { ...step }), [...seq, step]);
    }
    if (!moved) { best = Math.max(best, seq.length); res.push(seq); }
  })(clone(s), []);
  let legal = res.filter(q => q.length === best);
  if (best === 1 && s.dice.length === 2 && s.dice[0] !== s.dice[1]) {   // must play the larger die if possible
    const hi = Math.max(...s.dice);
    if (legal.some(q => q[0].die === hi)) legal = legal.filter(q => q[0].die === hi);
  }
  return legal;
}

export const sameStep = (a, b) => a.from === b.from && a.to === b.to && a.die === b.die;

export function roll(s) {
  const a = 1 + Math.floor(Math.random() * 6), b = 1 + Math.floor(Math.random() * 6);
  s.dice = a === b ? [a, a, a, a] : [a, b];
  s.rolled = [a, b];
  return s;
}

// play a full sequence of steps; returns error or null
export function play(s, steps) {
  if (s.winner) return 'over';
  const legal = sequences(s);
  const ok = legal.some(q => q.length === steps.length && q.every((x, i) => sameStep(x, steps[i])));
  if (!ok) return 'illegal';
  for (const st of steps) applyStep(s, { ...st });
  s.last = steps.map(x => `${x.from}>${x.to}`).join(',');
  endTurn(s);
  return null;
}
export function endTurn(s) {
  if (s.off[s.turn] === 15) {
    const o = other(s.turn);
    s.winner = s.turn;
    s.mars = s.off[o] === 0 ? 'mars' : '';
  }
  s.dice = []; s.rolled = null;
  if (!s.winner) s.turn = other(s.turn);
}

export function pips(s, t) {
  let n = s.bar[t] * 25;
  for (let i = 0; i < 24; i++) if (mine(s.pts[i], t)) n += Math.abs(s.pts[i]) * (t === 'w' ? i + 1 : 24 - i);
  return n;
}

// ---------- bot ----------
function evaluate(s, me) {
  const op = other(me), sg = sign(me);
  const pos = i => me === 'w' ? i : 23 - i;          // 0 = my 1-point (deepest home)
  // contact: some of my checkers are still behind some opponent checkers
  let contact = s.bar[me] > 0 || s.bar[op] > 0;
  for (let i = 0; i < 24 && !contact; i++) if (mine(s.pts[i], me)) for (let j = 0; j < 24; j++)
    if (mine(s.pts[j], op) && pos(j) < pos(i)) { contact = true; break; }

  let sc = (pips(s, op) - pips(s, me)) * 1.0 + (s.off[me] - s.off[op]) * 6;
  if (!contact) return sc;
  sc += s.bar[op] * 22 - s.bar[me] * 22;
  let run = 0;
  for (let i = 0; i < 24; i++) {
    const v = s.pts[i] * sg, p = pos(i);
    if (v >= 2) {
      sc += 7 + (p < 6 ? 6 : 0) + (p >= 18 ? 4 : 0);   // made points, home board, anchors
      run++; if (run >= 3) sc += 5 * (run - 2);        // primes
    } else run = 0;
    if (v === 1) {                                      // blot: how many opponent checkers can reach it
      let shooters = s.bar[op] ? 2 : 0;
      for (let j = 0; j < 24; j++) if (mine(s.pts[j], op)) {
        const dist = me === 'w' ? i - j : j - i;       // opponent at j moving toward my blot at i
        if (dist > 0 && dist <= 12) shooters += dist <= 6 ? 2 : 1;
      }
      if (shooters) sc -= 9 + shooters * 3 + (p < 6 ? 6 : 0);
    }
  }
  return sc;
}
export function botSteps(s) {
  const seqs = sequences(s);
  if (!seqs.length || !seqs[0].length) return [];
  const me = s.turn, seen = new Map();
  for (const q of seqs) {
    const n = clone(s); for (const st of q) applyStep(n, { ...st });
    const key = n.pts.join(',') + '|' + n.bar.w + n.bar.b + n.off.w + n.off.b;
    if (!seen.has(key)) seen.set(key, { q, v: evaluate(n, me) + Math.random() * 0.5 });
  }
  let best = null; for (const x of seen.values()) if (!best || x.v > best.v) best = x;
  return best.q;
}
