// BoredGames – Cards Against Humanity style game (original decks)
// Each round a rotating "czar" shows a black card; everyone else plays one white card from a hand of 10.
// The czar picks the funniest answer; that player scores a point. First to the target score wins.
import { deck } from './cahcards.js';

function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
export const DEFAULT_SETTINGS = { lang: 'he', mode: 'online', target: 7 };
const HAND = 10;

export function newGame(order, settings) {
  const st = { ...DEFAULT_SETTINGS, ...(settings || {}) };
  const d = deck(st.lang);
  const s = { order, lang: st.lang, mode: st.mode, target: st.target, scores: {}, hands: {}, round: 0,
    blackPile: shuffle(d.black.map((_, i) => i)), whitePile: shuffle(d.white.map((_, i) => i)),
    czar: order[Math.floor(Math.random() * order.length)], winner: '' };
  for (const p of order) { s.scores[p] = 0; s.hands[p] = []; }
  return newRound(s, true);
}
export function norm(s) {
  s.order = Object.values(s.order || []);
  s.hands = s.hands || {}; for (const p of s.order) s.hands[p] = s.hands[p] ? Object.values(s.hands[p]) : [];
  s.scores = s.scores || {}; for (const p of s.order) s.scores[p] = s.scores[p] || 0;
  s.blackPile = s.blackPile ? Object.values(s.blackPile) : []; s.whitePile = s.whitePile ? Object.values(s.whitePile) : [];
  s.subs = s.subs || {}; s.reveal = s.reveal ? Object.values(s.reveal) : []; s.winner = s.winner || ''; s.roundWinner = s.roundWinner || '';
  return s;
}
function refillPiles(s) {
  const d = deck(s.lang);
  if (!s.whitePile.length) {
    const inHands = new Set(s.order.flatMap(p => s.hands[p]));
    s.whitePile = shuffle(d.white.map((_, i) => i).filter(i => !inHands.has(i)));
  }
  if (!s.blackPile.length) s.blackPile = shuffle(d.black.map((_, i) => i));
}
export function newRound(s, first = false) {
  s.round = (s.round || 0) + 1;
  if (!first) s.czar = s.order[(s.order.indexOf(s.czar) + 1) % s.order.length];
  for (const p of s.order) while (s.hands[p].length < HAND) { refillPiles(s); s.hands[p].push(s.whitePile.pop()); }
  refillPiles(s);
  s.black = s.blackPile.pop();
  s.subs = {}; s.reveal = []; s.phase = 'submit'; s.roundWinner = '';
  return s;
}
export const players = s => s.order.filter(p => p !== s.czar);
export function submit(s, p, card) {
  if (s.phase !== 'submit' || p === s.czar || s.subs[p] != null) return 'phase';
  const i = s.hands[p].indexOf(card); if (i < 0) return 'card';
  s.hands[p].splice(i, 1);
  s.subs[p] = card;
  if (players(s).every(q => s.subs[q] != null)) { s.phase = 'judge'; s.reveal = shuffle(players(s)); }
  return null;
}
export function pick(s, p, who) {
  if (s.phase !== 'judge' || p !== s.czar || s.subs[who] == null) return 'phase';
  s.scores[who]++; s.roundWinner = who; s.phase = 'result';
  if (s.scores[who] >= s.target) s.winner = who;
  return null;
}
export function next(s) { if (s.phase !== 'result' || s.winner) return 'phase'; newRound(s); return null; }
export const text = (s, kind, i) => deck(s.lang)[kind][i];
// the answer is wrapped in ⟦ ⟧ markers; the screen turns them into bold text
export const fill = (black, white) => black.includes('___') ? black.replace('___', `⟦${white.replace(/[.!?]$/, '')}⟧`) : `${black} ⟦${white}⟧`;
