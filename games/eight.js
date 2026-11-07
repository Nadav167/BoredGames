// BoredGames – Eight and a half (שמונה וחצי), everyone against everyone
// 44 cards: A–8 count their value, J/Q/K count half a point.
// Each round everyone gets one hidden card. In turn, players draw open cards or stop.
// Over 8½ = bust. Closest to 8½ wins the round (ties share it). First to the target score wins the game.

const SUITS = ['♠', '♥', '♦', '♣'];
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
export const value = c => c.r >= 11 ? 0.5 : c.r;
export const total = cards => cards.reduce((a, c) => a + value(c), 0);
export const fmt = v => (v >= 1 || v === 0 ? Math.floor(v) : '') + (v % 1 ? '½' : '');

export function newGame(order, target = 5) {
  const scores = {}; for (const p of order) scores[p] = 0;
  return newRound({ order, scores, target, round: 0, starter: order[Math.floor(Math.random() * order.length)], winner: '' });
}

export function newRound(s) {
  const deck = []; let id = 0;
  for (const r of [1, 2, 3, 4, 5, 6, 7, 8, 11, 12, 13]) for (const su of SUITS) deck.push({ id: id++, r, s: su });
  shuffle(deck);
  s.deck = deck; s.hands = {}; s.stood = {}; s.bust = {};
  for (const p of s.order) s.hands[p] = [s.deck.pop()];
  s.round = (s.round || 0) + 1;
  if (s.round > 1) s.starter = s.order[(s.order.indexOf(s.starter) + 1) % s.order.length];
  s.turn = s.starter; s.phase = 'play'; s.roundWinners = [];
  return s;
}

export function norm(s) {
  s.order = Object.values(s.order || []);
  s.hands = s.hands || {}; for (const p of s.order) s.hands[p] = s.hands[p] ? Object.values(s.hands[p]) : [];
  s.deck = s.deck ? Object.values(s.deck) : [];
  s.stood = s.stood || {}; s.bust = s.bust || {}; s.scores = s.scores || {};
  for (const p of s.order) s.scores[p] = s.scores[p] || 0;
  s.roundWinners = s.roundWinners ? Object.values(s.roundWinners) : []; s.winner = s.winner || '';
  return s;
}

function advance(s) {
  const n = s.order.length, i = s.order.indexOf(s.turn);
  for (let k = 1; k <= n; k++) { const q = s.order[(i + k) % n]; if (!s.stood[q] && !s.bust[q]) { s.turn = q; return; } }
  finishRound(s);
}
function finishRound(s) {
  s.phase = 'reveal';
  let best = -1; const alive = s.order.filter(p => !s.bust[p]);
  for (const p of alive) best = Math.max(best, total(s.hands[p]));
  s.roundWinners = alive.filter(p => total(s.hands[p]) === best);
  for (const p of s.roundWinners) s.scores[p]++;
  const top = Math.max(...s.order.map(p => s.scores[p]));
  const leaders = s.order.filter(p => s.scores[p] === top);
  if (top >= s.target && leaders.length === 1) s.winner = leaders[0];
}

export function draw(s, p) {
  if (s.phase !== 'play' || s.turn !== p) return 'turn';
  s.hands[p].push(s.deck.pop());
  const t = total(s.hands[p]);
  if (t > 8.5) { s.bust[p] = true; advance(s); }
  else if (t === 8.5) { s.stood[p] = true; advance(s); }
  return null;
}
export function stand(s, p) {
  if (s.phase !== 'play' || s.turn !== p) return 'turn';
  s.stood[p] = true; advance(s);
  return null;
}
export function nextRound(s) {
  if (s.phase !== 'reveal' || s.winner) return 'phase';
  newRound(s); return null;
}

export function botMove(s, p) {
  const t = total(s.hands[p]);
  if (t <= 5) return 'draw';
  if (t <= 6) return Math.random() < 0.45 ? 'draw' : 'stand';
  if (t === 6.5) return Math.random() < 0.2 ? 'draw' : 'stand';
  return 'stand';
}
