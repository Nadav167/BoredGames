// BoredGames – 8½ (שמונה וחצי, Haim Shafir) engine, following the printed rules.
// 72 cards: 1,2 ×4 · 0,3,4,5,6,7,8,9 ×6 · ½ ×8 · devil (שד) ×8. 2–5 players.
// All cards are dealt into each player's face-down "bank". From it: 3 blind cards, 3 face-up cards on them, 3 in hand.
// The pile's value is the last card played. Play a card of equal or higher value (several identical cards count as one),
// then refill your hand to 3 from your bank. Can't play → take the pile; those cards are "burned" (out of play, count
// against you). The next player opens a new, empty pile with any card.
// Specials: devil – on anything, keeps the value. ½ – on anything except 8½, adds ½ (several add up).
// 0 – resets to 0, only on a whole number. Pile at 5 → the next player must play 5 or lower.
// Non-whole pile: whoever made (or kept, with a devil) a non-whole value is the "offender"; if the very next player
// plays the next whole number (the "policeman", e.g. 4 on 3½), the offender takes the pile.
// 8½: no ½ (and no 0) on it; an 8 together with a ½ may be played as 8½.
// Bank empty → play from hand, then the 3 face-up cards, then the blind ones (flip one: playable → play, else take the
// pile and the card goes back face down). Round ends when someone has no cards left:
// +1 to the winner, +1 to whoever holds fewest cards incl. burned (2 if that's the winner), +1 bonus for a clean win.
// First to 7 points (alone at the top) wins.

function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
export const DEFAULT_SETTINGS = { target: 7 };

function buildDeck() {
  const d = []; let id = 0;
  const add = (k, n, times) => { for (let i = 0; i < times; i++) d.push({ id: id++, k, n }); };
  add('n', 1, 4); add('n', 2, 4);
  for (const n of [0, 3, 4, 5, 6, 7, 8, 9]) add('n', n, 6);
  add('half', 0.5, 8); add('devil', 0, 8);
  return shuffle(d);
}

export function newGame(order, settings) {
  const st = { ...DEFAULT_SETTINGS, ...(settings || {}) };
  const scores = {}; for (const p of order) scores[p] = 0;
  return startRound({ order, scores, target: st.target, round: 0, winner: '' });
}

export function norm(s) {
  s.order = Object.values(s.order || []);
  for (const k of ['bank', 'blind', 'up', 'hands']) { s[k] = s[k] || {}; for (const p of s.order) s[k][p] = s[k][p] ? Object.values(s[k][p]) : []; }
  s.burned = s.burned || {}; s.scores = s.scores || {};
  for (const p of s.order) { s.burned[p] = s.burned[p] || 0; s.scores[p] = s.scores[p] || 0; }
  s.pile = s.pile ? Object.values(s.pile) : []; s.value = s.value || 0;
  s.offender = s.offender || ''; s.lastBy = s.lastBy || ''; s.winner = s.winner || '';
  s.last = s.last || null; if (s.last?.cards) s.last.cards = Object.values(s.last.cards);
  if (s.result) { s.result.points = s.result.points || {}; s.result.left = s.result.left || {}; }
  return s;
}

export function startRound(s) {
  const deck = buildDeck();
  s.bank = {}; s.blind = {}; s.up = {}; s.hands = {}; s.burned = {};
  for (const p of s.order) { s.bank[p] = []; s.burned[p] = 0; }
  deck.forEach((c, i) => s.bank[s.order[i % s.order.length]].push(c));
  for (const p of s.order) { s.blind[p] = s.bank[p].splice(0, 3); s.up[p] = s.bank[p].splice(0, 3); s.hands[p] = s.bank[p].splice(0, 3); }
  s.round = (s.round || 0) + 1;
  if (s.round === 1) {               // first opener: whoever holds the lowest number card
    let best = null;
    for (const p of shuffle([...s.order])) for (const c of s.hands[p]) if (c.k === 'n' && (!best || c.n < best.n)) { best = c; s.turn = p; }
    if (!best) s.turn = s.order[0];
  } else s.turn = s.order[(s.order.indexOf(s.opener || s.order[0]) + 1) % s.order.length];
  s.opener = s.turn;
  s.pile = []; s.value = 0; s.offender = ''; s.lastBy = ''; s.last = null; s.result = null; s.phase = 'play';
  return s;
}

const isWhole = v => Number.isInteger(v);
export const nextP = (s, p) => s.order[(s.order.indexOf(p) + 1) % s.order.length];
export const source = (s, p) => s.hands[p].length ? 'hands' : s.up[p].length ? 'up' : s.blind[p].length ? 'blind' : '';
export const label = c => c.k === 'half' ? '½' : c.k === 'devil' ? 'שד' : String(c.n);
export const fmt = v => (v >= 1 || v === 0 ? Math.floor(v) : '') + (isWhole(v) ? '' : '½');

// Check a play of `cards` (all from one source). Returns { ok, value, police, offender } or { ok:false, err }.
export function check(s, p, cards) {
  if (!cards.length) return { ok: false, err: 'none' };
  const empty = !s.pile.length, v = s.value;
  const kinds = [...new Set(cards.map(c => c.k === 'n' ? 'n' + c.n : c.k))];
  let value, isCombo = false;
  if (kinds.length === 2 && cards.length === 2 && kinds.includes('n8') && kinds.includes('half')) isCombo = true;
  else if (kinds.length !== 1) return { ok: false, err: 'mixed' };
  const c0 = cards[0];
  if (isCombo) {
    if (!empty && (v > 8.5 || v === 5)) return { ok: false, err: 'low' };
    value = 8.5;
  } else if (c0.k === 'devil') {
    value = empty ? 0 : v;
  } else if (c0.k === 'half') {
    if (!empty && v === 8.5) return { ok: false, err: 'half85' };
    value = (empty ? 0 : v) + 0.5 * cards.length;
  } else if (c0.n === 0) {
    if (!empty && !isWhole(v)) return { ok: false, err: 'zero' };
    value = 0;
  } else {
    if (!empty) {
      if (v === 5) { if (c0.n > 5) return { ok: false, err: 'five' }; }
      else if (c0.n < v) return { ok: false, err: 'low' };
    }
    value = c0.n;
  }
  // policeman: the very next player after the offender plays the next whole number
  const police = !empty && !isWhole(v) && s.offender && s.lastBy === s.offender && nextP(s, s.offender) === p
    && !isCombo && c0.k === 'n' && c0.n === Math.ceil(v);
  return { ok: true, value, police, offender: !isWhole(value) };
}

export function legalPlays(s, p, from = source(s, p)) {
  if (from === 'blind' || !from) return [];
  const cards = s[from][p], groups = {}, out = [];
  for (const c of cards) { const key = c.k === 'n' ? 'n' + c.n : c.k; (groups[key] = groups[key] || []).push(c); }
  for (const g of Object.values(groups)) for (let k = 1; k <= g.length; k++) { const r = check(s, p, g.slice(0, k)); if (r.ok) out.push({ cards: g.slice(0, k), ...r }); }
  const eight = cards.find(c => c.k === 'n' && c.n === 8), half = cards.find(c => c.k === 'half');
  if (eight && half) { const r = check(s, p, [eight, half]); if (r.ok) out.push({ cards: [eight, half], ...r }); }
  return out;
}

function refill(s, p) { while (s.hands[p].length < 3 && s.bank[p].length) s.hands[p].push(s.bank[p].shift()); }
const cardsLeft = (s, p) => s.bank[p].length + s.hands[p].length + s.up[p].length + s.blind[p].length;

function takePile(s, taker) {
  s.burned[taker] += s.pile.length;
  s.pile = []; s.value = 0; s.offender = ''; s.lastBy = '';
  s.turn = nextP(s, taker);
}

function apply(s, p, cards, r) {
  s.pile.push(...cards);
  s.last = { p, cards, police: r.police };
  if (r.police) {
    const off = s.offender;
    refill(s, p);
    s.last.caught = off;
    if (!cardsLeft(s, p)) { endRound(s, p); return; }
    takePile(s, off);
    return;
  }
  s.value = r.value; s.lastBy = p; s.offender = r.offender ? p : '';
  refill(s, p);
  if (!cardsLeft(s, p)) { endRound(s, p); return; }
  s.turn = nextP(s, p);
}

export function play(s, p, ids) {
  if (s.phase !== 'play') return 'phase';
  if (s.turn !== p) return 'turn';
  const from = source(s, p);
  if (from === 'blind' || !from) return 'blind';
  const cards = ids.map(id => s[from][p].find(c => c.id === id));
  if (cards.some(c => !c) || new Set(ids).size !== ids.length) return 'cards';
  const r = check(s, p, cards); if (!r.ok) return r.err;
  s[from][p] = s[from][p].filter(c => !ids.includes(c.id));
  apply(s, p, cards, r);
  return null;
}

export function flipBlind(s, p, idx) {
  if (s.phase !== 'play') return 'phase';
  if (s.turn !== p || source(s, p) !== 'blind') return 'turn';
  const c = s.blind[p][idx]; if (!c) return 'card';
  const r = check(s, p, [c]);
  if (r.ok) { s.blind[p].splice(idx, 1); apply(s, p, [c], r); s.last.blind = true; return null; }
  s.last = { p, cards: [c], blindFail: true, took: s.pile.length };
  takePile(s, p);                          // the blind card is turned back face down
  return null;
}

export function take(s, p) {
  if (s.phase !== 'play' || s.turn !== p) return 'turn';
  if (!s.pile.length) return 'empty';
  if (source(s, p) !== 'blind' && legalPlays(s, p).length) return 'canplay';
  s.last = { p, took: s.pile.length };
  takePile(s, p);
  return null;
}

function endRound(s, w) {
  const left = {}; for (const p of s.order) left[p] = cardsLeft(s, p) + s.burned[p];
  const min = Math.min(...s.order.map(p => left[p]));
  const points = {}; for (const p of s.order) points[p] = 0;
  points[w] += 1;
  for (const p of s.order) if (left[p] === min) points[p] += 1;
  if (s.burned[w] === 0) points[w] += 1;
  for (const p of s.order) s.scores[p] += points[p];
  s.result = { winner: w, points, left, clean: s.burned[w] === 0 };
  s.phase = 'roundEnd';
  const top = Math.max(...s.order.map(p => s.scores[p]));
  const leaders = s.order.filter(p => s.scores[p] === top);
  if (top >= s.target && leaders.length === 1) { s.winner = leaders[0]; s.phase = 'over'; }
}
export function nextRound(s) { if (s.phase !== 'roundEnd') return 'phase'; startRound(s); return null; }

// ---------- bot ----------
const special = c => c.k !== 'n' || c.n === 0;
export function botMove(s, p) {
  const from = source(s, p);
  if (from === 'blind') return { type: 'flip', idx: Math.floor(Math.random() * s.blind[p].length) };
  const plays = legalPlays(s, p);
  if (!plays.length) return { type: 'take' };
  const score = m => {
    if (m.police) return 1000;
    const c = m.cards[0];
    let sc = 100 + m.cards.length * 6;
    if (special(c) || m.cards.length === 2 && m.cards[1].k === 'half' && c.n === 8) sc -= 60;   // save specials
    else sc -= c.n * 4;                                                                      // shed low cards first
    if (m.offender) sc -= 25;                                                                // could get caught
    if (m.value === 5) sc += 8;                                                              // squeeze the next player
    return sc + Math.random() * 3;
  };
  plays.sort((a, b) => score(b) - score(a));
  // with nothing but special cards left to use, keep the max cards only when it isn't the last option
  const best = plays[0];
  const same = plays.filter(m => m.cards[0].k === best.cards[0].k && m.cards[0].n === best.cards[0].n && m.cards.length >= best.cards.length);
  return { type: 'play', ids: (same[same.length - 1] || best).cards.map(c => c.id) };
}
