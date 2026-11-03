// BoredGames – Taki rules engine (pure logic, no UI)
export const COLORS = ['red', 'yellow', 'green', 'blue'];
export const COLOR_HE = { red: 'אדום', yellow: 'צהוב', green: 'ירוק', blue: 'כחול' };

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function buildDeck() {
  const d = []; let id = 0;
  for (const c of COLORS) {
    for (const v of [1, 3, 4, 5, 6, 7, 8, 9]) for (let k = 0; k < 2; k++) d.push({ id: id++, c, t: 'num', v });
    for (const t of ['stop', 'dir', 'plus2', 'plus', 'taki']) for (let k = 0; k < 2; k++) d.push({ id: id++, c, t });
  }
  for (let k = 0; k < 4; k++) d.push({ id: id++, t: 'color' });
  for (let k = 0; k < 2; k++) d.push({ id: id++, t: 'super' });
  for (let k = 0; k < 2; k++) d.push({ id: id++, t: 'king' });
  return shuffle(d);
}

export function newGame(order) {
  const deck = buildDeck();
  const hands = {};
  for (const p of order) hands[p] = deck.splice(0, 8);
  const i = deck.findIndex(c => c.t === 'num');
  const top = deck.splice(i, 1)[0];
  return { deck, pile: [top], hands, order, turn: Math.floor(Math.random() * order.length), dir: 1,
    color: top.c, plus2: 0, taki: false, again: false, free: false, winner: '', last: '' };
}

// Firebase drops empty arrays / falsy fields – restore them.
export function norm(s) {
  s.deck = s.deck ? Object.values(s.deck) : [];
  s.pile = s.pile ? Object.values(s.pile) : [];
  s.hands = s.hands || {};
  s.order = Object.values(s.order || []);
  for (const p of s.order) s.hands[p] = s.hands[p] ? Object.values(s.hands[p]) : [];
  s.turn = s.turn || 0; s.dir = s.dir || 1; s.plus2 = s.plus2 || 0;
  s.taki = !!s.taki; s.again = !!s.again; s.free = !!s.free;
  s.winner = s.winner || ''; s.last = s.last || '';
  return s;
}

export const top = s => s.pile[s.pile.length - 1];
export const current = s => s.order[s.turn];

export function canPlay(s, card) {
  if (s.plus2 > 0) return card.t === 'plus2' || card.t === 'king';
  if (s.taki) return card.c === s.color;
  if (s.free) return true;
  if (card.t === 'color' || card.t === 'super' || card.t === 'king') return true;
  if (card.c === s.color) return true;
  const t = top(s);
  if (card.t === 'num') return t.t === 'num' && t.v === card.v;
  return card.t === t.t;
}

function drawCards(s, p, n) {
  let got = 0;
  for (let i = 0; i < n; i++) {
    if (!s.deck.length) {
      const t = s.pile.pop();
      s.deck = shuffle(s.pile);
      s.pile = [t];
    }
    if (!s.deck.length) break;
    s.hands[p].push(s.deck.pop()); got++;
  }
  return got;
}

function advance(s, skip = 0) {
  const n = s.order.length;
  s.turn = ((s.turn + s.dir * (1 + skip)) % n + n) % n;
  s.again = false; s.free = false;
}

export function pickColor(hand) {
  const cnt = { red: 0, yellow: 0, green: 0, blue: 0 };
  for (const c of hand) if (c.c) cnt[c.c]++;
  return COLORS.reduce((a, b) => (cnt[b] > cnt[a] ? b : a), COLORS[Math.floor(Math.random() * 4)]);
}

function effect(s, p, card, chosen) {
  const h = s.hands[p];
  if (card.c) s.color = card.c;
  if (card.t === 'color') s.color = COLORS.includes(chosen) ? chosen : pickColor(h);
  if (!h.length && card.t !== 'plus' && card.t !== 'king') { s.winner = p; return; }
  switch (card.t) {
    case 'taki': case 'super':
      s.taki = true;
      if (!h.some(c => c.c === s.color)) closeTaki(s, p);
      return;
    case 'plus': case 'king':
      if (card.t === 'king') { s.plus2 = 0; s.free = true; }
      if (!h.length) { drawCards(s, p, 1); advance(s); return; } // can't finish on + / king
      s.again = true; return;
    case 'plus2': s.plus2 += 2; advance(s); return;
    case 'stop': advance(s, 1); return;
    case 'dir': s.dir *= -1; advance(s); return;
    default: advance(s);
  }
}

export function closeTaki(s, p) {
  s.taki = false;
  const t = top(s);
  if (t.t === 'taki' || t.t === 'super') {
    if (!s.hands[p].length) { s.winner = p; return; }
    advance(s);
  } else effect(s, p, t, null); // the last card of the Taki counts
}

// Returns an error string, or null on success.
export function apply(s, p, m) {
  if (s.winner) return 'over';
  if (current(s) !== p) return 'turn';
  const h = s.hands[p];
  if (m.type === 'play') {
    const i = h.findIndex(c => c.id === m.cardId);
    if (i < 0) return 'card';
    const card = h[i];
    if (!canPlay(s, card)) return 'illegal';
    h.splice(i, 1); s.pile.push(card);
    s.last = { p, card };
    s.free = false; s.again = false;
    if (s.taki) {
      if (!h.length) { s.winner = p; return null; }
      if (!h.some(c => c.c === s.color)) closeTaki(s, p);
      return null;
    }
    effect(s, p, card, m.color);
    return null;
  }
  if (m.type === 'close') {
    if (!s.taki) return 'illegal';
    closeTaki(s, p); return null;
  }
  if (m.type === 'draw') {
    if (s.taki) { closeTaki(s, p); return null; }
    const n = drawCards(s, p, s.plus2 > 0 ? s.plus2 : 1);
    s.plus2 = 0;
    s.last = { p, drew: n };
    advance(s); return null;
  }
  return 'unknown';
}

// Simple but sensible bot.
export function botMove(s, p) {
  const h = s.hands[p];
  const ok = h.filter(c => canPlay(s, c));
  if (s.taki) {
    if (!ok.length) return { type: 'close' };
    ok.sort((a, b) => (a.t === 'num' ? 0 : 1) - (b.t === 'num' ? 0 : 1)); // finish on an action card
    return { type: 'play', cardId: ok[0].id };
  }
  if (!ok.length) return { type: 'draw' };
  const colorCount = col => h.filter(c => c.c === col).length;
  const score = c => {
    switch (c.t) {
      case 'plus2': return s.plus2 > 0 ? 100 : 30;
      case 'king': return s.plus2 > 0 ? 90 : (ok.length === 1 ? 50 : 1);
      case 'taki': return colorCount(c.c) >= 3 ? 60 : 8;
      case 'super': return colorCount(s.color) >= 2 ? 55 : 3;
      case 'stop': return 25;
      case 'plus': return ok.length > 1 ? 22 : 4;
      case 'dir': return 15;
      case 'color': return 2;
      default: return 10 + colorCount(c.c);
    }
  };
  ok.sort((a, b) => score(b) - score(a));
  const card = ok[0];
  const m = { type: 'play', cardId: card.id };
  if (card.t === 'color') m.color = pickColor(h.filter(c => c.id !== card.id));
  return m;
}
