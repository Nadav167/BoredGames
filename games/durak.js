// BoredGames – Durak (דוראק) engine, "throw-in" (podkidnoy) version
// 36 cards (6..A). The bottom card of the deck sets the trump suit. Everyone holds 6.
// Attacker leads 1+ cards of one rank. Defender beats each with a higher card of the same suit or any trump
// (a trump attack needs a higher trump). Other players may throw in cards of ranks already on the table,
// never more unbeaten cards than the defender holds, and at most 6 attacks per round.
// Defender beats everything → cards discarded, defender attacks next. Defender takes → skips their attack.
// Refill to 6 (attackers first, defender last). Last player left with cards is the Durak.

const SUITS = ['♠', '♥', '♦', '♣'];
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

export function newGame(order) {
  const deck = []; let id = 0;
  for (let r = 6; r <= 14; r++) for (const s of SUITS) deck.push({ id: id++, r, s });
  shuffle(deck);
  const trump = { ...deck[0] };                            // bottom card, drawn last (with 6 players: the last card dealt)
  const hands = {}; for (const p of order) hands[p] = deck.splice(deck.length - 6, 6);
  const s = { order, hands, deck, trump, table: [], out: [], loser: '', taking: false, done: {}, discarded: 0, last: '' };
  // lowest trump leads
  let best = null, att = order[0];
  for (const p of order) for (const c of hands[p]) if (c.s === trump.s && (!best || c.r < best.r)) { best = c; att = p; }
  s.attacker = att; s.defender = nextActive(s, att);
  return s;
}

export function norm(s) {
  s.order = Object.values(s.order || []);
  s.hands = s.hands || {}; for (const p of s.order) s.hands[p] = s.hands[p] ? Object.values(s.hands[p]) : [];
  s.deck = s.deck ? Object.values(s.deck) : [];
  s.table = s.table ? Object.values(s.table).map(x => ({ a: x.a, d: x.d || null })) : [];
  s.out = s.out ? Object.values(s.out) : []; s.done = s.done || {};
  s.taking = !!s.taking; s.loser = s.loser || ''; s.discarded = s.discarded || 0; s.last = s.last || '';
  return s;
}

export const active = s => s.order.filter(p => !s.out.includes(p));
export function nextActive(s, p) {
  const n = s.order.length; let i = s.order.indexOf(p);
  for (let k = 0; k < n; k++) { i = (i + 1) % n; const q = s.order[i]; if (!s.out.includes(q)) return q; }
  return p;
}
export const over = s => !!s.loser || active(s).length <= 1;
export const beats = (s, card, a) => (card.s === a.s && card.r > a.r) || (card.s === s.trump.s && a.s !== s.trump.s);
export const unbeaten = s => s.table.filter(x => !x.d).length;
export const tableRanks = s => new Set(s.table.flatMap(x => [x.a.r, x.d && x.d.r]).filter(Boolean));
export const attackers = s => active(s).filter(p => p !== s.defender);
const maxAttacks = s => Math.min(6, s.firstHand || 6);

export function canThrow(s, p, cards) {
  if (over(s) || p === s.defender || s.out.includes(p)) return false;
  if (!cards.length || !cards.every(c => c.r === cards[0].r)) return false;
  if (!s.table.length) { if (p !== s.attacker) return false; }
  else if (!cards.every(c => tableRanks(s).has(c.r))) return false;
  const defHand = s.hands[s.defender].length;
  if (unbeaten(s) + cards.length > defHand) return false;
  if (s.table.length + cards.length > maxAttacks(s)) return false;
  return true;
}

export function attack(s, p, ids) {
  const cards = ids.map(id => s.hands[p].find(c => c.id === id));
  if (cards.some(c => !c) || new Set(ids).size !== ids.length) return 'cards';
  if (!canThrow(s, p, cards)) return 'illegal';
  if (!s.table.length) s.firstHand = Math.min(6, s.hands[s.defender].length);
  s.hands[p] = s.hands[p].filter(c => !ids.includes(c.id));
  for (const c of cards) s.table.push({ a: c, d: null });
  s.done = {};
  s.last = p;
  return null;
}

export function defend(s, p, idx, id) {
  if (over(s) || p !== s.defender || s.taking) return 'turn';
  const slot = s.table[idx]; if (!slot || slot.d) return 'slot';
  const card = s.hands[p].find(c => c.id === id); if (!card) return 'card';
  if (!beats(s, card, slot.a)) return 'weak';
  slot.d = card;
  s.hands[p] = s.hands[p].filter(c => c.id !== id);
  s.last = p;
  return maybeEnd(s);
}

export function take(s, p) {
  if (over(s) || p !== s.defender || s.taking || !s.table.length) return 'turn';
  s.taking = true; s.done = {};
  return maybeEnd(s);
}

export function pass(s, p) {
  if (over(s) || p === s.defender || s.out.includes(p) || !s.table.length) return 'turn';
  if (!s.taking && unbeaten(s)) return 'wait';
  s.done[p] = true;
  return maybeEnd(s);
}

function maybeEnd(s) {
  const atk = attackers(s);
  const allDone = atk.every(p => s.done[p] || !s.hands[p].length);
  const full = s.table.length >= maxAttacks(s) || (!s.taking && !s.hands[s.defender].length);
  if (s.taking) { if (allDone || s.table.length >= maxAttacks(s)) endRound(s, true); }
  else if (!unbeaten(s) && (allDone || full)) endRound(s, false);
  return null;
}

function endRound(s, took) {
  const cards = s.table.flatMap(x => [x.a, x.d]).filter(Boolean);
  if (took) s.hands[s.defender].push(...cards); else s.discarded += cards.length;
  s.table = []; s.taking = false; s.done = {}; s.firstHand = 0;
  // refill: attacker first, others around, defender last
  const order = [s.attacker]; let q = s.attacker;
  for (let k = 0; k < s.order.length; k++) { q = nextActive(s, q); if (q !== s.defender && !order.includes(q)) order.push(q); }
  order.push(s.defender);
  for (const p of order) while (s.hands[p].length < 6 && s.deck.length) s.hands[p].push(s.deck.pop());
  if (!s.deck.length) for (const p of s.order) if (!s.hands[p].length && !s.out.includes(p)) s.out.push(p);
  const left = active(s);
  if (left.length <= 1) { s.loser = left[0] || 'draw'; return; }
  const def = s.defender;
  let next = took ? nextActive(s, def) : (s.out.includes(def) ? nextActive(s, def) : def);
  s.attacker = next; s.defender = nextActive(s, next);
}

// --- bots ---
const cost = (s, c) => c.r + (c.s === s.trump.s ? 20 : 0);
export function botAction(s, p) {
  if (over(s)) return null;
  const hand = [...s.hands[p]].sort((a, b) => cost(s, a) - cost(s, b));
  if (p === s.defender) {
    if (s.taking) return null;
    const open = s.table.map((x, i) => [x, i]).filter(([x]) => !x.d);
    if (!open.length) return null;
    const used = new Set(), plan = [];
    for (const [x, i] of open) {
      const c = hand.find(h => !used.has(h.id) && beats(s, h, x.a));
      if (!c) return { type: 'take' };
      used.add(c.id); plan.push({ idx: i, id: c.id });
    }
    // giving up very expensive defences early in the game is often better
    if (s.deck.length > 10 && plan.some(x => cost(s, hand.find(h => h.id === x.id)) >= 32)) return { type: 'take' };
    return { type: 'defend', ...plan[0] };
  }
  if (s.done[p] && !(s.table.length === 0 && p === s.attacker)) return null;
  if (!s.table.length) {
    if (p !== s.attacker) return null;
    const c = hand[0]; const same = hand.filter(h => h.r === c.r && (h.s !== s.trump.s || s.deck.length < 4));
    const ids = (same.length ? same : [c]).slice(0, s.hands[s.defender].length).map(x => x.id);
    return { type: 'attack', ids: ids.length ? ids : [c.id] };
  }
  if (!s.taking && unbeaten(s)) return null;             // wait for the defender
  const ranks = tableRanks(s);
  const opts = hand.filter(c => ranks.has(c.r) && (c.s !== s.trump.s || s.deck.length === 0) && c.r < 13);
  if (opts.length && canThrow(s, p, [opts[0]])) return { type: 'attack', ids: [opts[0].id] };
  return { type: 'pass' };
}
