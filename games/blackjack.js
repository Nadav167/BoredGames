// BoredGames – Blackjack: everyone at the table plays against an automatic dealer (the house).
// 6-deck shoe. Blackjack pays 3:2, dealer stands on all 17s, dealer peeks for blackjack.
// Moves: hit, stand, split (equal-value pairs, up to 4 hands; split aces get one card each).
// settings: { chips, minBet, rounds } – the game ends after `rounds` rounds (or when everyone is broke); most chips wins.

const SUITS = ['♠', '♥', '♦', '♣'];
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
export const DEFAULT_SETTINGS = { chips: 1000, minBet: 10, rounds: 15 };

function newShoe() {
  const d = []; let id = 0;
  for (let k = 0; k < 6; k++) for (let r = 2; r <= 14; r++) for (const s of SUITS) d.push({ id: id++, r, s });
  return shuffle(d);
}
export const cardVal = c => c.r === 14 ? 11 : Math.min(c.r, 10);
export function total(cards) {
  let t = 0, aces = 0;
  for (const c of cards) { t += cardVal(c); if (c.r === 14) aces++; }
  while (t > 21 && aces) { t -= 10; aces--; }
  return { t, soft: aces > 0 };
}
const isBJ = cards => cards.length === 2 && total(cards).t === 21;

export function newGame(order, settings) {
  const st = { ...DEFAULT_SETTINGS, ...(settings || {}) };
  const chips = {}; for (const p of order) chips[p] = st.chips;
  return newRound({ order, chips, minBet: st.minBet, maxRounds: st.rounds, round: 0, shoe: newShoe(), winner: '' });
}
export function norm(s) {
  s.order = Object.values(s.order || []);
  s.chips = s.chips || {}; for (const p of s.order) s.chips[p] = s.chips[p] || 0;
  s.bets = s.bets || {}; s.ready = s.ready || {}; s.shoe = s.shoe ? Object.values(s.shoe) : [];
  s.dealer = s.dealer ? Object.values(s.dealer) : [];
  s.hands = s.hands || {};
  for (const p of s.order) s.hands[p] = s.hands[p] ? Object.values(s.hands[p]).map(h => ({ ...h, cards: h.cards ? Object.values(h.cards) : [] })) : [];
  s.results = s.results || {}; s.winner = s.winner || ''; s.cur = s.cur || null;
  return s;
}
export const seated = s => s.order.filter(p => s.chips[p] >= s.minBet || (s.bets[p] || 0) > 0);

export function newRound(s) {
  s.round = (s.round || 0) + 1;
  if (s.shoe.length < 80) s.shoe = newShoe();
  s.bets = {}; s.ready = {}; s.hands = {}; s.dealer = []; s.results = {}; s.cur = null; s.phase = 'bet';
  for (const p of s.order) s.hands[p] = [];
  return s;
}

export function bet(s, p, amount) {
  if (s.phase !== 'bet' || s.ready[p]) return 'phase';
  amount = Math.floor(amount);
  if (amount < s.minBet || amount > s.chips[p]) return 'amount';
  s.bets[p] = amount; s.ready[p] = true;
  if (seated(s).every(q => s.ready[q] || s.chips[q] < s.minBet)) deal(s);
  return null;
}

function draw(s) { if (!s.shoe.length) s.shoe = newShoe(); return s.shoe.pop(); }
function deal(s) {
  const players = s.order.filter(p => s.ready[p]);
  if (!players.length) { s.phase = 'over'; return; }
  for (const p of players) { s.chips[p] -= s.bets[p]; s.hands[p] = [{ cards: [draw(s)], bet: s.bets[p] }]; }
  s.dealer = [draw(s)];
  for (const p of players) s.hands[p][0].cards.push(draw(s));
  s.dealer.push(draw(s));
  s.phase = 'play';
  for (const p of players) if (isBJ(s.hands[p][0].cards)) s.hands[p][0].done = true;
  if (isBJ(s.dealer)) { finish(s); return; }                 // dealer peeks: blackjack ends the round at once
  advance(s);
}

function advance(s) {
  for (const p of s.order) {
    const hs = s.hands[p] || [];
    for (let h = 0; h < hs.length; h++) if (!hs[h].done) { s.cur = { p, h }; return; }
  }
  s.cur = null;
  dealerPlay(s);
}

export function canSplit(s, p) {
  const c = s.cur; if (!c || c.p !== p) return false;
  const hand = s.hands[p][c.h];
  return hand.cards.length === 2 && cardVal(hand.cards[0]) === cardVal(hand.cards[1]) && s.hands[p].length < 4 && s.chips[p] >= hand.bet;
}

export function act(s, p, type) {
  if (s.phase !== 'play' || !s.cur || s.cur.p !== p) return 'turn';
  const hand = s.hands[p][s.cur.h];
  if (type === 'hit') {
    if (hand.splitAces) return 'noHit';
    hand.cards.push(draw(s));
    const { t } = total(hand.cards);
    if (t >= 21) { hand.done = true; if (t > 21) hand.bust = true; }
  } else if (type === 'stand') hand.done = true;
  else if (type === 'split') {
    if (!canSplit(s, p)) return 'noSplit';
    const aces = hand.cards[0].r === 14;
    const second = { cards: [hand.cards.pop()], bet: hand.bet, splitAces: aces };
    s.chips[p] -= hand.bet;
    hand.splitAces = aces;
    hand.cards.push(draw(s)); second.cards.push(draw(s));
    s.hands[p].splice(s.cur.h + 1, 0, second);
    for (const h of [hand, second]) { if (aces || total(h.cards).t === 21) h.done = true; }
  } else return 'type';
  if (hand.done) advance(s);
  return null;
}

function dealerPlay(s) {
  const anyLive = s.order.some(p => (s.hands[p] || []).some(h => !h.bust));
  if (anyLive) while (total(s.dealer).t < 17) s.dealer.push(draw(s));
  finish(s);
}

function finish(s) {
  s.phase = 'result'; s.cur = null;
  const d = total(s.dealer).t, dBJ = isBJ(s.dealer);
  for (const p of s.order) {
    const res = [];
    for (const h of s.hands[p] || []) {
      const { t } = total(h.cards), bj = isBJ(h.cards) && s.hands[p].length === 1;
      let pay = 0, out;
      if (h.bust) out = 'bust';
      else if (dBJ) { out = bj ? 'push' : 'lose'; pay = bj ? h.bet : 0; }
      else if (bj) { out = 'bj'; pay = h.bet + Math.floor(h.bet * 1.5); }
      else if (d > 21 || t > d) { out = 'win'; pay = h.bet * 2; }
      else if (t === d) { out = 'push'; pay = h.bet; }
      else out = 'lose';
      s.chips[p] += pay;
      res.push({ out, net: pay - h.bet });
    }
    s.results[p] = res;
  }
  const broke = s.order.every(p => s.chips[p] < s.minBet);
  if (s.round >= s.maxRounds || broke) {
    const top = Math.max(...s.order.map(p => s.chips[p]));
    s.winner = s.order.find(p => s.chips[p] === top); s.over = true;
  }
}
export function next(s) {
  if (s.phase !== 'result') return 'phase';
  if (s.over) { s.phase = 'over'; return null; }
  newRound(s); return null;
}

// ---------- bot (basic strategy, simplified) ----------
export function botBet(s, p) { return Math.min(s.chips[p], s.minBet * [1, 1, 2, 3][Math.floor(Math.random() * 4)]); }
export function botAct(s, p) {
  const hand = s.hands[p][s.cur.h], up = cardVal(s.dealer[0]);
  if (canSplit(s, p)) {
    const v = cardVal(hand.cards[0]);
    if (v === 11 || v === 8) return 'split';
    if ([2, 3, 6, 7, 9].includes(v) && up <= 7 && !(v === 9 && up === 7)) return 'split';
  }
  const { t, soft } = total(hand.cards);
  if (soft) return t <= 17 || (t === 18 && up >= 9) ? 'hit' : 'stand';
  if (t <= 11) return 'hit';
  if (t >= 17) return 'stand';
  if (t === 12) return up >= 4 && up <= 6 ? 'stand' : 'hit';
  return up <= 6 ? 'stand' : 'hit';
}
