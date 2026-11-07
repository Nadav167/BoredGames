// BoredGames – Shithead (שיט-הד) engine
// Each player: 3 face-down, 3 face-up, 3 in hand. Before play, swap between hand and face-up.
// Play 1+ cards of one rank, equal or higher than the pile top (Ace high).
// 2 resets (anything goes on it), 10 burns the pile (play again), 7 → next card must be 7 or lower,
// four of the same rank in a row burns the pile too. Can't play → take the pile.
// Hand refills to 3 while the deck lasts; then face-up cards, then face-down blind.
// Last player holding cards is the Shithead.

const SUITS = ['♠', '♥', '♦', '♣'];
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

export function newGame(order) {
  const decks = order.length > 5 ? 2 : 1, deck = []; let id = 0;
  for (let d = 0; d < decks; d++) for (let r = 2; r <= 14; r++) for (const s of SUITS) deck.push({ id: id++, r, s });
  shuffle(deck);
  const hands = {}, up = {}, down = {};
  for (const p of order) { down[p] = deck.splice(0, 3); up[p] = deck.splice(0, 3); hands[p] = deck.splice(0, 3); }
  return { order, hands, up, down, deck, pile: [], phase: 'swap', ready: {}, turn: order[Math.floor(Math.random() * order.length)],
    out: [], loser: '', last: null, burned: 0 };
}

export function norm(s) {
  s.order = Object.values(s.order || []);
  for (const k of ['hands', 'up', 'down']) { s[k] = s[k] || {}; for (const p of s.order) s[k][p] = s[k][p] ? Object.values(s[k][p]) : []; }
  s.deck = s.deck ? Object.values(s.deck) : []; s.pile = s.pile ? Object.values(s.pile) : [];
  s.ready = s.ready || {}; s.out = s.out ? Object.values(s.out) : []; s.loser = s.loser || ''; s.last = s.last || null;
  if (s.last?.cards) s.last.cards = Object.values(s.last.cards);
  s.burned = s.burned || 0;
  return s;
}

export const top = s => s.pile[s.pile.length - 1];
export function canPlayRank(s, r) {
  if (r === 2 || r === 10) return true;
  const t = top(s);
  if (!t || t.r === 2) return true;
  if (t.r === 7) return r <= 7;
  return r >= t.r;
}
export const source = (s, p) => s.hands[p].length ? 'hands' : s.up[p].length ? 'up' : s.down[p].length ? 'down' : '';
export const active = s => s.order.filter(p => !s.out.includes(p));
export function canPlayAny(s, p) {
  const src = source(s, p);
  if (src === 'down') return true;                        // blind flip is always allowed
  return (s[src] ? s[src][p] : []).some(c => canPlayRank(s, c.r));
}

function nextTurn(s, p) {
  const n = s.order.length; let i = s.order.indexOf(p);
  for (let k = 0; k < n; k++) { i = (i + 1) % n; if (!s.out.includes(s.order[i])) return s.order[i]; }
  return p;
}
function refill(s, p) { while (s.hands[p].length < 3 && s.deck.length) s.hands[p].push(s.deck.pop()); }
function checkOut(s, p) {
  if (!s.hands[p].length && !s.up[p].length && !s.down[p].length && !s.out.includes(p)) s.out.push(p);
  const left = active(s);
  if (left.length === 1) { s.loser = left[0]; s.phase = 'over'; }
  if (!left.length) s.phase = 'over';
}
function shouldBurn(s) {
  const t = top(s); if (!t) return false;
  if (t.r === 10) return true;
  if (s.pile.length < 4) return false;
  return s.pile.slice(-4).every(c => c.r === t.r);
}

// --- swap phase ---
export function swap(s, p, handId, upId) {
  if (s.phase !== 'swap' || s.ready[p]) return 'phase';
  const hi = s.hands[p].findIndex(c => c.id === handId), ui = s.up[p].findIndex(c => c.id === upId);
  if (hi < 0 || ui < 0) return 'cards';
  [s.hands[p][hi], s.up[p][ui]] = [s.up[p][ui], s.hands[p][hi]];
  return null;
}
export function setReady(s, p) {
  if (s.phase !== 'swap') return 'phase';
  s.ready[p] = true;
  if (s.order.every(q => s.ready[q])) s.phase = 'play';
  return null;
}

// --- play phase ---
export function play(s, p, ids) {
  if (s.phase !== 'play') return 'phase';
  if (s.turn !== p) return 'turn';
  const src = source(s, p);
  if (src === 'down') return 'blind';
  const from = s[src][p];
  const cards = ids.map(id => from.find(c => c.id === id));
  if (!cards.length || cards.some(c => !c) || new Set(ids).size !== ids.length) return 'cards';
  if (!cards.every(c => c.r === cards[0].r)) return 'rank';
  if (!canPlayRank(s, cards[0].r)) return 'low';
  s[src][p] = from.filter(c => !ids.includes(c.id));
  s.pile.push(...cards);
  s.last = { p, cards, kind: 'play' };
  return afterPlay(s, p);
}
function afterPlay(s, p) {
  refill(s, p);
  if (shouldBurn(s)) { s.burned += s.pile.length; s.pile = []; s.last.burn = true; checkOut(s, p); if (s.out.includes(p)) s.turn = nextTurn(s, p); return null; }
  const t = top(s);
  checkOut(s, p);
  s.turn = nextTurn(s, p);
  return null;
}

export function flipDown(s, p, idx) {
  if (s.phase !== 'play') return 'phase';
  if (s.turn !== p || source(s, p) !== 'down') return 'turn';
  const card = s.down[p][idx]; if (!card) return 'card';
  s.down[p].splice(idx, 1);
  if (canPlayRank(s, card.r)) { s.pile.push(card); s.last = { p, cards: [card], kind: 'blind' }; return afterPlay(s, p); }
  s.hands[p].push(card, ...s.pile); s.pile = [];
  s.last = { p, cards: [card], kind: 'blindfail' };
  s.turn = nextTurn(s, p);
  return null;
}

export function pickUp(s, p) {
  if (s.phase !== 'play') return 'phase';
  if (s.turn !== p) return 'turn';
  if (!s.pile.length) return 'empty';
  s.hands[p].push(...s.pile); s.pile = [];
  s.last = { p, kind: 'pickup' };
  s.turn = nextTurn(s, p);
  return null;
}

// --- bots ---
const power = r => r === 2 ? 15 : r === 10 ? 16 : r;   // keep specials for last
export function botSwap(s, p) {
  // best cards (2, 10, high) go face-up
  const all = [...s.hands[p], ...s.up[p]].sort((a, b) => power(b.r) - power(a.r));
  const want = all.slice(0, 3).map(c => c.id);
  for (const u of [...s.up[p]]) if (!want.includes(u.id)) {
    const h = s.hands[p].find(c => want.includes(c.id)); if (h) swap(s, p, h.id, u.id);
  }
  setReady(s, p);
}
export function botMove(s, p) {
  const src = source(s, p);
  if (src === 'down') return { type: 'flip', idx: Math.floor(Math.random() * s.down[p].length) };
  const cards = s[src][p].filter(c => canPlayRank(s, c.r));
  if (!cards.length) return { type: 'pickup' };
  // leading a 7 onto an empty pile can make the 7s circle forever, so save it when there's another choice
  const lead = c => power(c.r) + (!s.pile.length && c.r === 7 ? 10 : 0);
  cards.sort((a, b) => lead(a) - lead(b));
  // now and then vary the choice (more often on a fresh pile), so bots never repeat the same cycle forever
  const r = Math.random() < (s.pile.length ? 0.2 : 0.35) ? cards[Math.floor(Math.random() * cards.length)].r : cards[0].r;
  return { type: 'play', ids: s[src][p].filter(c => c.r === r).map(c => c.id) };
}
