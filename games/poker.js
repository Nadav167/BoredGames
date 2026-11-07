// BoredGames – Texas Hold'em (no limit) engine
// Cards { id, r: 2..14, s }. Chips are virtual.
// settings: { chips, sb, grow } – grow = hands per blind level (0 = fixed blinds), blinds double each level.

const SUITS = ['♠', '♥', '♦', '♣'];
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
export const DEFAULT_SETTINGS = { chips: 1000, sb: 10, grow: 10 };

// ---------- hand evaluation ----------
export const HAND_NAMES = ['קלף גבוה', 'זוג', 'שני זוגות', 'שלישייה', 'רצף', 'צבע', 'פול האוס', 'רביעייה', 'רצף בצבע'];
function eval5(cs) {
  const rs = cs.map(c => c.r).sort((a, b) => b - a);
  const flush = cs.every(c => c.s === cs[0].s);
  const uniq = [...new Set(rs)];
  let straightHigh = 0;
  if (uniq.length === 5) {
    if (rs[0] - rs[4] === 4) straightHigh = rs[0];
    else if (rs[0] === 14 && rs[1] === 5) straightHigh = 5;           // wheel A-2-3-4-5
  }
  const cnt = {}; for (const r of rs) cnt[r] = (cnt[r] || 0) + 1;
  const groups = Object.entries(cnt).map(([r, n]) => [n, +r]).sort((a, b) => b[0] - a[0] || b[1] - a[1]);
  let cat, tie;
  if (straightHigh && flush) { cat = 8; tie = [straightHigh]; }
  else if (groups[0][0] === 4) { cat = 7; tie = groups.map(g => g[1]); }
  else if (groups[0][0] === 3 && groups[1][0] === 2) { cat = 6; tie = groups.map(g => g[1]); }
  else if (flush) { cat = 5; tie = rs; }
  else if (straightHigh) { cat = 4; tie = [straightHigh]; }
  else if (groups[0][0] === 3) { cat = 3; tie = groups.map(g => g[1]); }
  else if (groups[0][0] === 2 && groups[1][0] === 2) { cat = 2; tie = groups.map(g => g[1]); }
  else if (groups[0][0] === 2) { cat = 1; tie = groups.map(g => g[1]); }
  else { cat = 0; tie = rs; }
  let score = cat;
  for (let i = 0; i < 5; i++) score = score * 15 + (tie[i] || 0);
  return score;
}
export function bestHand(cards) {
  let best = -1, bestCards = null;
  const n = cards.length;
  for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) for (let c = b + 1; c < n; c++) for (let d = c + 1; d < n; d++) for (let e = d + 1; e < n; e++) {
    const five = [cards[a], cards[b], cards[c], cards[d], cards[e]], sc = eval5(five);
    if (sc > best) { best = sc; bestCards = five; }
  }
  return { score: best, cat: Math.floor(best / 15 ** 5), cards: bestCards };
}

// ---------- game flow ----------
export function newGame(order, settings) {
  const st = { ...DEFAULT_SETTINGS, ...(settings || {}) };
  const chips = {}; for (const p of order) chips[p] = st.chips;
  const s = { order, chips, baseSb: st.sb, grow: st.grow, handNo: 0, dealer: Math.floor(Math.random() * order.length), winner: '' };
  return startHand(s, true);
}
export function norm(s) {
  s.order = Object.values(s.order || []);
  s.chips = s.chips || {}; for (const p of s.order) s.chips[p] = s.chips[p] || 0;
  for (const k of ['bets', 'contrib', 'folded', 'acted', 'hole']) s[k] = s[k] || {};
  for (const p of s.order) { s.bets[p] = s.bets[p] || 0; s.contrib[p] = s.contrib[p] || 0; s.hole[p] = s.hole[p] ? Object.values(s.hole[p]) : []; }
  s.deck = s.deck ? Object.values(s.deck) : []; s.board = s.board ? Object.values(s.board) : [];
  s.currentBet = s.currentBet || 0; s.winner = s.winner || ''; s.result = s.result || null;
  if (s.result) { s.result.winners = Object.values(s.result.winners || {}); s.result.shown = s.result.shown || {}; }
  s.log = s.log ? Object.values(s.log) : [];
  return s;
}
export const inHand = s => s.order.filter(p => s.hole[p]?.length && !s.folded[p]);
export const canAct = (s, p) => inHand(s).includes(p) && s.chips[p] > 0;
export const pot = s => s.order.reduce((a, p) => a + (s.contrib[p] || 0), 0);
const seated = s => s.order.filter(p => s.chips[p] > 0);
function nextSeat(s, i, pred) { const n = s.order.length; for (let k = 1; k <= n; k++) { const p = s.order[(i + k) % n]; if (pred(p)) return p; } return null; }

export function startHand(s, first = false) {
  const alive = seated(s);
  if (alive.length <= 1) { s.winner = alive[0] || ''; s.phase = 'over'; return s; }
  s.handNo = (s.handNo || 0) + 1;
  s.level = s.grow ? Math.floor((s.handNo - 1) / s.grow) : 0;
  s.sb = s.baseSb * 2 ** s.level; s.bb = s.sb * 2;
  if (!first) s.dealer = s.order.indexOf(nextSeat(s, s.dealer, p => s.chips[p] > 0));
  else if (!s.chips[s.order[s.dealer]]) s.dealer = s.order.indexOf(alive[0]);
  const deck = []; let id = 0;
  for (let r = 2; r <= 14; r++) for (const su of SUITS) deck.push({ id: id++, r, s: su });
  shuffle(deck);
  s.deck = deck; s.board = []; s.hole = {}; s.bets = {}; s.contrib = {}; s.folded = {}; s.acted = {}; s.result = null; s.log = [];
  for (const p of s.order) { s.bets[p] = 0; s.contrib[p] = 0; s.hole[p] = s.chips[p] > 0 ? [s.deck.pop(), s.deck.pop()] : []; }
  const dealerP = s.order[s.dealer];
  const heads = alive.length === 2;
  const sbP = heads ? dealerP : nextSeat(s, s.dealer, p => s.chips[p] > 0);
  const bbP = nextSeat(s, s.order.indexOf(sbP), p => s.chips[p] > 0);
  pay(s, sbP, s.sb); pay(s, bbP, s.bb);
  s.sbP = sbP; s.bbP = bbP;
  s.currentBet = s.bb; s.minRaise = s.bb; s.phase = 'preflop';
  s.toAct = nextSeat(s, s.order.indexOf(bbP), p => canAct(s, p));
  s.log.push(`blinds ${s.sb}/${s.bb}`);
  if (!s.toAct || needsRunout(s)) runout(s);
  return s;
}
function pay(s, p, amt) {
  const a = Math.min(amt, s.chips[p]);
  s.chips[p] -= a; s.bets[p] += a; s.contrib[p] += a;
  return a;
}
const needsRunout = s => inHand(s).filter(p => s.chips[p] > 0).length <= 1 &&
  inHand(s).every(p => s.chips[p] === 0 || s.bets[p] >= s.currentBet);

export function legal(s, p) {
  if (s.phase === 'showdown' || s.phase === 'over' || s.toAct !== p) return null;
  const toCall = Math.min(s.currentBet - s.bets[p], s.chips[p]);
  const maxTo = s.bets[p] + s.chips[p];
  const minTo = Math.min(s.currentBet + s.minRaise, maxTo);
  return { toCall, canCheck: toCall === 0, minTo, maxTo, canRaise: maxTo > s.currentBet };
}

export function act(s, p, type, amount = 0) {
  const L = legal(s, p); if (!L) return 'turn';
  if (type === 'fold') { s.folded[p] = true; s.log.push(`${p}:fold`); }
  else if (type === 'check') { if (!L.canCheck) return 'nocheck'; s.log.push(`${p}:check`); }
  else if (type === 'call') { pay(s, p, L.toCall); s.log.push(`${p}:call`); }
  else if (type === 'raise') {
    if (!L.canRaise) return 'noraise';
    const to = Math.max(L.minTo, Math.min(amount, L.maxTo));
    const raiseBy = to - s.currentBet;
    pay(s, p, to - s.bets[p]);
    if (raiseBy >= s.minRaise) { s.minRaise = raiseBy; s.acted = {}; }   // full raise reopens the betting
    s.currentBet = Math.max(s.currentBet, to);
    s.log.push(`${p}:raise:${to}`);
  } else return 'type';
  s.acted[p] = true;
  advance(s);
  return null;
}

function advance(s) {
  const live = inHand(s);
  if (live.length === 1) { awardSingle(s, live[0]); return; }
  const actors = live.filter(p => s.chips[p] > 0);
  const pending = actors.filter(p => !s.acted[p] || s.bets[p] < s.currentBet);
  if (pending.length) {
    s.toAct = nextSeat(s, s.order.indexOf(s.toAct), p => pending.includes(p));
    return;
  }
  nextStreet(s);
}
function nextStreet(s) {
  for (const p of s.order) s.bets[p] = 0;
  s.currentBet = 0; s.minRaise = s.bb; s.acted = {};
  if (s.phase === 'river') { showdown(s); return; }
  s.deck.pop();                                                     // burn
  if (s.phase === 'preflop') { s.board.push(s.deck.pop(), s.deck.pop(), s.deck.pop()); s.phase = 'flop'; }
  else if (s.phase === 'flop') { s.board.push(s.deck.pop()); s.phase = 'turn'; }
  else { s.board.push(s.deck.pop()); s.phase = 'river'; }
  if (inHand(s).filter(p => s.chips[p] > 0).length <= 1) { nextStreet(s); return; }   // everyone else all-in: run it out
  s.toAct = nextSeat(s, s.dealer, p => canAct(s, p));
}
function runout(s) { while (s.phase !== 'showdown' && s.phase !== 'over') { s.acted = {}; nextStreet(s); } }

function awardSingle(s, p) {
  const total = pot(s);
  s.chips[p] += total;
  s.result = { winners: [p], amount: total, uncontested: true, shown: {} };
  s.phase = 'showdown'; s.toAct = '';
  checkOver(s);
}

function showdown(s) {
  s.phase = 'showdown'; s.toAct = '';
  const live = inHand(s);
  const scores = {}, shown = {};
  for (const p of live) { const h = bestHand([...s.hole[p], ...s.board]); scores[p] = h.score; shown[p] = h.cat; }
  // side pots
  const levels = [...new Set(s.order.map(p => s.contrib[p]).filter(x => x > 0))].sort((a, b) => a - b);
  let prev = 0, carry = 0, lastWs = []; const won = {};
  const dIdx = s.dealer;
  for (const lv of levels) {
    let amount = 0; for (const p of s.order) amount += Math.max(0, Math.min(s.contrib[p], lv) - prev);
    const elig = live.filter(p => s.contrib[p] >= lv);
    prev = lv;
    if (!elig.length) { carry += amount; continue; }
    amount += carry; carry = 0;
    const top = Math.max(...elig.map(p => scores[p]));
    const ws = elig.filter(p => scores[p] === top)
      .sort((a, b) => ((s.order.indexOf(a) - dIdx + s.order.length) % s.order.length) - ((s.order.indexOf(b) - dIdx + s.order.length) % s.order.length));
    const share = Math.floor(amount / ws.length); let rem = amount - share * ws.length;
    for (const w of ws) { const x = share + (rem-- > 0 ? 1 : 0); s.chips[w] += x; won[w] = (won[w] || 0) + x; }
    lastWs = ws;
  }
  if (carry && lastWs.length) { s.chips[lastWs[0]] += carry; won[lastWs[0]] += carry; }
  s.result = { winners: Object.keys(won), won, shown, amount: pot(s) };
  checkOver(s);
}
function checkOver(s) {
  const alive = seated(s);
  if (alive.length <= 1) { s.winner = alive[0] || ''; s.over = true; }
}
export function nextHand(s) {
  if (s.phase !== 'showdown') return 'phase';
  if (s.over) { s.phase = 'over'; return null; }
  startHand(s); return null;
}

// ---------- bot ----------
function equity(hole, board, opponents, iters = 220) {
  const used = new Set([...hole, ...board].map(c => c.r + c.s));
  const deck = []; for (let r = 2; r <= 14; r++) for (const su of SUITS) if (!used.has(r + su)) deck.push({ r, s: su });
  let wins = 0;
  for (let i = 0; i < iters; i++) {
    shuffle(deck); let k = 0;
    const b = [...board]; while (b.length < 5) b.push(deck[k++]);
    const mine = bestHand([...hole, ...b]).score;
    let best = true, tie = false;
    for (let o = 0; o < opponents; o++) {
      const sc = bestHand([deck[k++], deck[k++], ...b]).score;
      if (sc > mine) { best = false; break; } if (sc === mine) tie = true;
    }
    if (best) wins += tie ? 0.5 : 1;
  }
  return wins / iters;
}
export function botMove(s, p) {
  const L = legal(s, p); if (!L) return null;
  const opps = inHand(s).length - 1;
  const eq = equity(s.hole[p], s.board, Math.max(1, opps));
  const potNow = pot(s);
  const odds = L.toCall / (potNow + L.toCall || 1);
  const r = Math.random();
  const strong = eq > (opps > 2 ? 0.55 : 0.68);
  if (strong && L.canRaise && r < 0.8) {
    const target = s.currentBet + Math.max(s.minRaise, Math.round(potNow * (0.5 + Math.random() * 0.6)));
    return { type: 'raise', amount: Math.min(target, L.maxTo) };
  }
  if (L.canCheck) {
    if (r < 0.07 && L.canRaise) return { type: 'raise', amount: Math.min(s.currentBet + s.minRaise, L.maxTo) };   // small bluff
    return { type: 'check' };
  }
  if (eq > odds + 0.04 || (L.toCall <= s.bb && eq > 0.25)) return { type: 'call' };
  return { type: 'fold' };
}
