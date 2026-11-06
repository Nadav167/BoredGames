// BoredGames – Perudo (פרודו) engine
// Each player starts with 5 dice. Ones ("פאקו") are wild unless it's a palifico round.
// Bid { q, f }: "there are at least q dice showing f on the table".
// Raise: more dice of any face, or same quantity with a higher face.
// Switching to ones: q ≥ ceil(q/2). Switching from ones: q ≥ 2q+1.
// Dudo: challenge the last bid. Calza (optional): claim the bid is exact; right → gain a die, wrong → lose one.
// Palifico (optional): when a player drops to 1 die, next round ones aren't wild and the face can't change.

export const DEFAULT_SETTINGS = { mode: 'online', calza: true, palifico: true };
const roll = n => Array.from({ length: n }, () => 1 + Math.floor(Math.random() * 6));

export function newGame(order, settings) {
  const st = { ...DEFAULT_SETTINGS, ...(settings || {}) };
  const count = {}; for (const p of order) count[p] = 5;
  const s = { order, count, mode: st.mode, calza: !!st.calza, palifico: !!st.palifico, round: 0, winner: '', usedPalifico: {} };
  return newRound(s, order[Math.floor(Math.random() * order.length)], false);
}

export function norm(s) {
  s.order = Object.values(s.order || []);
  s.count = s.count || {}; for (const p of s.order) s.count[p] = s.count[p] || 0;
  s.dice = s.dice || {}; for (const p of s.order) s.dice[p] = s.dice[p] ? Object.values(s.dice[p]) : [];
  s.bid = s.bid || null; s.reveal = s.reveal || null; s.winner = s.winner || '';
  s.usedPalifico = s.usedPalifico || {}; s.history = s.history ? Object.values(s.history) : [];
  s.palRound = !!s.palRound; s.calza = !!s.calza; s.palifico = !!s.palifico;
  return s;
}

export const alive = s => s.order.filter(p => s.count[p] > 0);
export const totalDice = s => alive(s).reduce((a, p) => a + s.count[p], 0);

export function newRound(s, starter, palRound) {
  s.round = (s.round || 0) + 1;
  s.dice = {}; for (const p of s.order) s.dice[p] = roll(s.count[p]);
  s.turn = alive(s).includes(starter) ? starter : nextAlive(s, starter);
  s.bid = null; s.reveal = null; s.history = []; s.phase = 'bid';
  s.palRound = !!palRound;
  return s;
}

export function nextAlive(s, p) {
  const n = s.order.length; let i = s.order.indexOf(p);
  for (let k = 0; k < n; k++) { i = (i + 1) % n; if (s.count[s.order[i]] > 0) return s.order[i]; }
  return p;
}

export function minBid(prev, f, palRound) {
  if (!prev) return 1;
  if (palRound) return f === prev.f ? prev.q + 1 : Infinity;
  if (f === 1 && prev.f !== 1) return Math.ceil(prev.q / 2);
  if (f !== 1 && prev.f === 1) return prev.q * 2 + 1;
  return f > prev.f ? prev.q : prev.q + 1;
}
export function validBid(s, b) {
  if (!(b.q >= 1 && b.f >= 1 && b.f <= 6)) return false;
  if (b.q > totalDice(s)) return false;
  if (!s.bid && !s.palRound && b.f === 1) return true;   // opening on ones is allowed
  return b.q >= minBid(s.bid, b.f, s.palRound);
}

export function countFace(s, f) {
  let n = 0;
  for (const p of alive(s)) for (const d of s.dice[p]) if (d === f || (!s.palRound && f !== 1 && d === 1)) n++;
  return n;
}

// online actions; return error string or null
export function bid(s, p, b) {
  if (s.winner || s.phase !== 'bid') return 'phase';
  if (s.turn !== p) return 'turn';
  if (!validBid(s, b)) return 'low';
  s.bid = { q: b.q, f: b.f, by: p };
  s.history.push(s.bid);
  s.turn = nextAlive(s, p);
  return null;
}

export function challenge(s, p, type) {
  if (s.winner || s.phase !== 'bid' || !s.bid) return 'phase';
  if (type === 'dudo' && s.turn !== p) return 'turn';
  if (type === 'calza' && (!s.calza || s.bid.by === p || s.count[p] < 1)) return 'calza';
  const actual = countFace(s, s.bid.f);
  let loser = '', gainer = '';
  if (type === 'dudo') loser = actual >= s.bid.q ? p : s.bid.by;
  else if (actual === s.bid.q) gainer = p; else loser = p;
  s.reveal = { caller: p, type, bid: s.bid, actual, loser, gainer };
  s.phase = 'reveal';
  if (loser) s.count[loser] -= 1;
  if (gainer) s.count[gainer] = Math.min(5, s.count[gainer] + 1);
  const left = alive(s);
  if (left.length === 1) s.winner = left[0];
  return null;
}

// after a reveal: loser starts (or the caller if the loser is out / calza won)
export function nextRound(s) {
  if (s.winner) return 'over';
  const r = s.reveal || {};
  let starter = r.loser || r.gainer || s.turn;
  if (s.count[starter] <= 0) starter = nextAlive(s, starter);
  let pal = false;
  if (s.palifico && r.loser && s.count[r.loser] === 1 && !s.usedPalifico[r.loser] && alive(s).length > 2) {
    pal = true; s.usedPalifico[r.loser] = true;
  }
  newRound(s, starter, pal);
  return null;
}

// table mode: host adjusts dice by hand
export function adjust(s, p, delta) {
  s.count[p] = Math.max(0, Math.min(5, s.count[p] + delta));
  const left = alive(s);
  s.winner = left.length === 1 ? left[0] : '';
}
