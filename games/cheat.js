// BoredGames – Cheat (צ'יט) engine
// Cards are dealt face down; players put 1–4 cards on the pile and claim they're all of one rank.
// rule 'seq'  – ranks go up in order (A, 2, 3 … K, A …); you must play every turn.
// rule 'near' – claim the last claimed rank, one above or one below (K and A wrap around); a fresh pile: any rank.
// rule 'free' – whoever starts a pile picks the rank; others must claim the same rank or pass.
//               If everyone passes back to the last player, the pile is discarded and they start a new one.
// Anyone can call "Cheat!" on the last play: a liar takes the whole pile, otherwise the caller does.
// Emptying your hand wins once the next player moves on (or a Cheat call on you fails).

export const RANKS = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
export const SUITS = ['♠', '♥', '♦', '♣'];
export const RULES = { near: 'אותו מספר, אחד מעל או אחד מתחת', seq: 'סדר עולה (A, 2, 3…)', free: 'דרגה חופשית' };
export const RULES_INFO = {
  near: 'אחרי X אפשר להגיד X−1, X או X+1 (K ו-A מתחברים). בערימה חדשה – כל מספר. חייבים לשים בכל תור',
  seq: 'כל תור הדרגה עולה באחת. חייבים לשים קלפים בכל תור',
  free: 'מי שפותח ערימה בוחר דרגה, והשאר ממשיכים באותה דרגה או אומרים פס',
};

function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

export function newGame(order, rule = 'near') {
  const decks = order.length > 5 ? 2 : 1, deck = []; let id = 0;
  for (let d = 0; d < decks; d++) for (let r = 1; r <= 13; r++) for (const s of SUITS) deck.push({ id: id++, r, s });
  shuffle(deck);
  const hands = {}; order.forEach(p => hands[p] = []);
  deck.forEach((c, i) => hands[order[i % order.length]].push(c));
  return { order, hands, pile: [], rule, decks, turn: order[Math.floor(Math.random() * order.length)],
    rank: rule === 'seq' ? 1 : 0, last: null, reveal: null, passes: 0, pendingWin: '', winner: '' };
}

export function norm(s) {
  s.order = Object.values(s.order || []);
  s.hands = s.hands || {}; for (const p of s.order) s.hands[p] = s.hands[p] ? Object.values(s.hands[p]) : [];
  s.pile = s.pile ? Object.values(s.pile) : [];
  s.last = s.last || null; if (s.last) s.last.ids = Object.values(s.last.ids || {});
  s.reveal = s.reveal || null; if (s.reveal) s.reveal.cards = Object.values(s.reveal.cards || {});
  s.rank = s.rank || 0; s.passes = s.passes || 0; s.pendingWin = s.pendingWin || ''; s.winner = s.winner || '';
  return s;
}

export const nextP = (s, p) => s.order[(s.order.indexOf(p) + 1) % s.order.length];
export const mustPickRank = s => (s.rule === 'free' || s.rule === 'near') && !s.pile.length;
const wrap = r => ((r - 1 + 13) % 13) + 1;
// ranks a player may announce now
export function claimOptions(s) {
  if (mustPickRank(s)) return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
  if (s.rule === 'near') return [wrap(s.rank - 1), s.rank, wrap(s.rank + 1)];
  return [s.rank];
}
export const canCall = (s, p) => !s.winner && s.last && !s.last.called && s.last.by !== p;

function settleWin(s) { if (s.pendingWin) { s.winner = s.pendingWin; return true; } return false; }

export function play(s, p, ids, claim) {
  if (s.winner) return 'over';
  if (s.turn !== p) return 'turn';
  if (!Array.isArray(ids) || ids.length < 1 || ids.length > 4) return 'count';
  const hand = s.hands[p];
  if (!ids.every(id => hand.some(c => c.id === id)) || new Set(ids).size !== ids.length) return 'cards';
  if (mustPickRank(s) || s.rule === 'near') { if (!claimOptions(s).includes(claim)) return 'rank'; s.rank = claim; }
  if (settleWin(s)) return null;                       // the previous player emptied their hand and nobody called
  const cards = ids.map(id => hand.find(c => c.id === id));
  s.hands[p] = hand.filter(c => !ids.includes(c.id));
  s.pile.push(...cards);
  s.last = { by: p, ids, n: ids.length, claim: s.rank, called: false };
  s.reveal = null; s.passes = 0;
  if (!s.hands[p].length) s.pendingWin = p;
  if (s.rule === 'seq') s.rank = s.rank % 13 + 1;
  s.turn = nextP(s, p);
  return null;
}

export function pass(s, p) {
  if (s.winner) return 'over';
  if (s.rule !== 'free' || s.turn !== p || !s.pile.length) return 'nopass';
  if (settleWin(s)) return null;
  s.passes++;
  s.turn = nextP(s, p);
  if (s.last && s.turn === s.last.by) {               // everyone passed: discard the pile
    s.pile = []; s.last = null; s.rank = 0; s.passes = 0; s.reveal = { burned: true };
  }
  return null;
}

export function call(s, p) {
  if (!canCall(s, p)) return 'nocall';
  const L = s.last;
  const cards = s.pile.slice(-L.n);
  const liar = cards.some(c => c.r !== L.claim);
  const picker = liar ? L.by : p;
  s.hands[picker].push(...s.pile);
  s.pile = [];
  L.called = true;
  s.reveal = { caller: p, by: L.by, cards, liar, picker, claim: L.claim };
  if (s.pendingWin === L.by && !liar) s.winner = L.by;
  s.pendingWin = '';
  if (s.rule === 'free' || s.rule === 'near') { s.rank = 0; s.last = null; s.passes = 0; }   // next player starts a fresh pile
  return null;
}

// ---------- bots ----------
export function botTurn(s, p) {
  const hand = s.hands[p];
  const byRank = r => hand.filter(c => c.r === r);
  if (mustPickRank(s)) {
    const counts = {}; for (const c of hand) counts[c.r] = (counts[c.r] || 0) + 1;
    const r = +Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
    return { type: 'play', ids: byRank(r).slice(0, 4).map(c => c.id), claim: r };
  }
  if (s.rule === 'near') {
    // pick the allowed rank I hold most of; with none, lie using a card far from the current rank
    const opts = claimOptions(s), best = opts.map(r => [r, byRank(r)]).sort((a, b) => b[1].length - a[1].length)[0];
    if (best[1].length) {
      const ids = best[1].slice(0, 4).map(c => c.id);
      if (ids.length < 4 && hand.length > 6 && Math.random() < 0.25) { const extra = hand.find(c => !opts.includes(c.r)); if (extra) ids.push(extra.id); }
      return { type: 'play', ids, claim: best[0] };
    }
    const far = [...hand].sort((a, b) => Math.min(Math.abs(b.r - s.rank), 13 - Math.abs(b.r - s.rank)) - Math.min(Math.abs(a.r - s.rank), 13 - Math.abs(a.r - s.rank)));
    return { type: 'play', ids: far.slice(0, hand.length > 8 && Math.random() < 0.35 ? 2 : 1).map(c => c.id), claim: opts[Math.floor(Math.random() * 3)] };
  }
  const real = byRank(s.rank);
  if (real.length) {
    const ids = real.slice(0, 4).map(c => c.id);
    if (ids.length < 4 && hand.length > 6 && Math.random() < 0.25) {      // sneak in an extra card
      const extra = hand.find(c => c.r !== s.rank); if (extra) ids.push(extra.id);
    }
    return { type: 'play', ids };
  }
  if (s.rule === 'free' && Math.random() < 0.55) return { type: 'pass' };
  // lie with cards that are far from coming up next
  const dist = c => ((c.r - s.rank + 13) % 13) || 13;
  const sorted = [...hand].sort((a, b) => dist(b) - dist(a));
  const n = hand.length > 8 && Math.random() < 0.35 ? 2 : 1;
  return { type: 'play', ids: sorted.slice(0, n).map(c => c.id) };
}

export function botWantsCall(s, p) {
  const L = s.last; if (!L || L.called || L.by === p) return false;
  const mine = s.hands[p].filter(c => c.r === L.claim).length;
  if (mine + L.n > 4 * (s.decks || 1)) return true;             // impossible claim
  let prob = 0.08 + (L.n >= 3 ? 0.15 : 0) + mine * 0.08;
  if (s.pendingWin === L.by) prob += 0.7;
  if (s.hands[L.by].length <= 2) prob += 0.2;
  return Math.random() < prob;
}
