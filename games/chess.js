// BoredGames – Chess engine + bot
// board: 64-char string, index r*8+c, r=0 is rank 8. Uppercase = white, lowercase = black, '.' empty.

export const START = 'rnbqkbnrpppppppp' + '.'.repeat(32) + 'PPPPPPPPRNBQKBNR';
const isW = p => p >= 'A' && p <= 'Z';
const colorOf = p => p === '.' ? '' : isW(p) ? 'w' : 'b';
const other = t => t === 'w' ? 'b' : 'w';
const rc = i => [i >> 3, i & 7];
const inside = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;
const N_D = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
const K_D = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
const B_D = [[-1, -1], [-1, 1], [1, -1], [1, 1]], R_D = [[-1, 0], [1, 0], [0, -1], [0, 1]];

export function newGame() {
  return { board: START, turn: 'w', castle: 'KQkq', ep: -1, half: 0, full: 1, reps: [], winner: '', reason: '', last: '' };
}
export function norm(s) {
  s.castle = s.castle || ''; s.ep = s.ep ?? -1; if (s.ep === undefined || s.ep === null) s.ep = -1;
  s.half = s.half || 0; s.full = s.full || 1; s.reps = s.reps ? Object.values(s.reps) : [];
  s.winner = s.winner || ''; s.reason = s.reason || ''; s.last = s.last || '';
  return s;
}

export function attacked(b, sq, by) {
  const [r, c] = rc(sq);
  const pawnDir = by === 'w' ? 1 : -1;                   // white pawns attack upward (from r+1)
  for (const dc of [-1, 1]) {
    const rr = r + pawnDir, cc = c + dc;
    if (inside(rr, cc) && b[rr * 8 + cc] === (by === 'w' ? 'P' : 'p')) return true;
  }
  for (const [dr, dc] of N_D) { const rr = r + dr, cc = c + dc; if (inside(rr, cc) && b[rr * 8 + cc] === (by === 'w' ? 'N' : 'n')) return true; }
  for (const [dr, dc] of K_D) { const rr = r + dr, cc = c + dc; if (inside(rr, cc) && b[rr * 8 + cc] === (by === 'w' ? 'K' : 'k')) return true; }
  const slide = (dirs, pieces) => {
    for (const [dr, dc] of dirs) {
      let rr = r + dr, cc = c + dc;
      while (inside(rr, cc)) {
        const p = b[rr * 8 + cc];
        if (p !== '.') { if (colorOf(p) === by && pieces.includes(p.toUpperCase())) return true; break; }
        rr += dr; cc += dc;
      }
    }
    return false;
  };
  return slide(B_D, 'BQ') || slide(R_D, 'RQ');
}
const kingSq = (b, t) => b.indexOf(t === 'w' ? 'K' : 'k');
export const inCheck = (s, t = s.turn) => attacked(s.board, kingSq(s.board, t), other(t));

function pseudo(s) {
  const b = s.board, t = s.turn, out = [];
  const add = (from, to, extra = {}) => out.push({ from, to, ...extra });
  for (let i = 0; i < 64; i++) {
    const p = b[i]; if (colorOf(p) !== t) continue;
    const [r, c] = rc(i), P = p.toUpperCase();
    if (P === 'P') {
      const dir = t === 'w' ? -1 : 1, start = t === 'w' ? 6 : 1, last = t === 'w' ? 0 : 7;
      const pushP = (to, extra) => { if ((to >> 3) === last) for (const pr of 'QRBN') add(i, to, { ...extra, promo: pr }); else add(i, to, extra); };
      const f = (r + dir) * 8 + c;
      if (inside(r + dir, c) && b[f] === '.') {
        pushP(f);
        const f2 = (r + 2 * dir) * 8 + c;
        if (r === start && b[f2] === '.') add(i, f2, { double: true });
      }
      for (const dc of [-1, 1]) {
        if (!inside(r + dir, c + dc)) continue;
        const to = (r + dir) * 8 + c + dc;
        if (b[to] !== '.' && colorOf(b[to]) !== t) pushP(to);
        else if (to === s.ep) add(i, to, { ep: true });
      }
    } else if (P === 'N' || P === 'K') {
      for (const [dr, dc] of P === 'N' ? N_D : K_D) {
        const rr = r + dr, cc = c + dc; if (!inside(rr, cc)) continue;
        const to = rr * 8 + cc; if (colorOf(b[to]) !== t) add(i, to);
      }
      if (P === 'K') {
        const row = t === 'w' ? 7 : 0, home = row * 8 + 4, op = other(t);
        if (i === home && !attacked(b, home, op)) {
          const [k, q] = t === 'w' ? ['K', 'Q'] : ['k', 'q'];
          if (s.castle.includes(k) && b[home + 1] === '.' && b[home + 2] === '.' && !attacked(b, home + 1, op) && !attacked(b, home + 2, op))
            add(i, home + 2, { castle: 'k' });
          if (s.castle.includes(q) && b[home - 1] === '.' && b[home - 2] === '.' && b[home - 3] === '.' && !attacked(b, home - 1, op) && !attacked(b, home - 2, op))
            add(i, home - 2, { castle: 'q' });
        }
      }
    } else {
      const dirs = P === 'B' ? B_D : P === 'R' ? R_D : [...B_D, ...R_D];
      for (const [dr, dc] of dirs) {
        let rr = r + dr, cc = c + dc;
        while (inside(rr, cc)) {
          const to = rr * 8 + cc;
          if (b[to] === '.') add(i, to);
          else { if (colorOf(b[to]) !== t) add(i, to); break; }
          rr += dr; cc += dc;
        }
      }
    }
  }
  return out;
}

export function makeMove(s, m) {
  const b = s.board.split(''), t = s.turn;
  const p = b[m.from], cap = b[m.to];
  b[m.to] = m.promo ? (t === 'w' ? m.promo : m.promo.toLowerCase()) : p;
  b[m.from] = '.';
  if (m.ep) b[m.to + (t === 'w' ? 8 : -8)] = '.';
  if (m.castle) {
    const row = t === 'w' ? 56 : 0;
    if (m.castle === 'k') { b[row + 5] = b[row + 7]; b[row + 7] = '.'; } else { b[row + 3] = b[row]; b[row] = '.'; }
  }
  let castle = s.castle;
  const strip = chars => { for (const ch of chars) castle = castle.replace(ch, ''); };
  if (p === 'K') strip('KQ'); if (p === 'k') strip('kq');
  for (const [sq, ch] of [[63, 'K'], [56, 'Q'], [7, 'k'], [0, 'q']]) if (m.from === sq || m.to === sq) strip(ch);
  return {
    ...s, board: b.join(''), turn: other(t), castle,
    ep: m.double ? (m.from + m.to) / 2 : -1,
    half: (p.toUpperCase() === 'P' || cap !== '.' || m.ep) ? 0 : s.half + 1,
    full: s.full + (t === 'b' ? 1 : 0),
  };
}

export function legalMoves(s) {
  return pseudo(s).filter(m => { const n = makeMove(s, m); return !attacked(n.board, kingSq(n.board, s.turn), n.turn); });
}

const posKey = s => s.board + s.turn + s.castle + s.ep;
function insufficient(b) {
  const pcs = [...b].filter(p => p !== '.' && p.toUpperCase() !== 'K');
  if (!pcs.length) return true;
  if (pcs.length === 1 && 'NB'.includes(pcs[0].toUpperCase())) return true;
  return false;
}

// apply a user/bot move and update result; returns error or null
export function play(s, mv) {
  if (s.winner) return 'over';
  const m = legalMoves(s).find(x => x.from === mv.from && x.to === mv.to && (x.promo || '') === (mv.promo || ''));
  if (!m) return 'illegal';
  const n = makeMove(s, m);
  Object.assign(s, n);
  s.last = `${m.from},${m.to}`;
  s.reps = [...(s.reps || []).slice(-60), posKey(s)];
  const moves = legalMoves(s);
  if (!moves.length) { if (inCheck(s)) { s.winner = other(s.turn); s.reason = 'mate'; } else { s.winner = 'draw'; s.reason = 'stalemate'; } }
  else if (s.half >= 100) { s.winner = 'draw'; s.reason = '50'; }
  else if (insufficient(s.board)) { s.winner = 'draw'; s.reason = 'material'; }
  else if (s.reps.filter(k => k === posKey(s)).length >= 3) { s.winner = 'draw'; s.reason = 'repetition'; }
  return null;
}

// ---------- bot ----------
const VAL = { P: 100, N: 320, B: 330, R: 500, Q: 900, K: 0 };
// piece-square tables from white's view (index 0 = a8)
const PST = {
  P: [0,0,0,0,0,0,0,0, 50,50,50,50,50,50,50,50, 10,10,20,30,30,20,10,10, 5,5,10,25,25,10,5,5, 0,0,0,20,20,0,0,0, 5,-5,-10,0,0,-10,-5,5, 5,10,10,-20,-20,10,10,5, 0,0,0,0,0,0,0,0],
  N: [-50,-40,-30,-30,-30,-30,-40,-50, -40,-20,0,0,0,0,-20,-40, -30,0,10,15,15,10,0,-30, -30,5,15,20,20,15,5,-30, -30,0,15,20,20,15,0,-30, -30,5,10,15,15,10,5,-30, -40,-20,0,5,5,0,-20,-40, -50,-40,-30,-30,-30,-30,-40,-50],
  B: [-20,-10,-10,-10,-10,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,10,10,5,0,-10, -10,5,5,10,10,5,5,-10, -10,0,10,10,10,10,0,-10, -10,10,10,10,10,10,10,-10, -10,5,0,0,0,0,5,-10, -20,-10,-10,-10,-10,-10,-10,-20],
  R: [0,0,0,0,0,0,0,0, 5,10,10,10,10,10,10,5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, 0,0,0,5,5,0,0,0],
  Q: [-20,-10,-10,-5,-5,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,5,5,5,0,-10, -5,0,5,5,5,5,0,-5, 0,0,5,5,5,5,0,-5, -10,5,5,5,5,5,0,-10, -10,0,5,0,0,0,0,-10, -20,-10,-10,-5,-5,-10,-10,-20],
  K: [-30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -20,-30,-30,-40,-40,-30,-30,-20, -10,-20,-20,-20,-20,-20,-20,-10, 20,20,0,0,0,0,20,20, 20,30,10,0,0,10,30,20],
};
function evaluate(b, t) {
  let sc = 0;
  for (let i = 0; i < 64; i++) {
    const p = b[i]; if (p === '.') continue;
    const P = p.toUpperCase(), w = isW(p);
    const v = VAL[P] + PST[P][w ? i : (7 - (i >> 3)) * 8 + (i & 7)];
    sc += w ? v : -v;
  }
  return t === 'w' ? sc : -sc;
}
const capVal = (s, m) => (s.board[m.to] !== '.' ? VAL[s.board[m.to].toUpperCase()] * 10 - VAL[s.board[m.from].toUpperCase()] : 0) + (m.promo ? 800 : 0);
function order(s, ms) { return ms.sort((a, b) => capVal(s, b) - capVal(s, a)); }

let deadline = 0, aborted = false;
function quiesce(s, alpha, beta, depth) {
  const stand = evaluate(s.board, s.turn);
  if (stand >= beta) return beta;
  if (alpha < stand) alpha = stand;
  if (depth <= 0) return alpha;
  for (const m of order(s, legalMoves(s).filter(m => s.board[m.to] !== '.' || m.promo))) {
    const v = -quiesce(makeMove(s, m), -beta, -alpha, depth - 1);
    if (v >= beta) return beta;
    if (v > alpha) alpha = v;
  }
  return alpha;
}
function negamax(s, depth, alpha, beta, ply) {
  if (Date.now() > deadline) { aborted = true; return 0; }
  const moves = legalMoves(s);
  if (!moves.length) return inCheck(s) ? -100000 + ply : 0;
  if (s.half >= 100) return 0;
  if (depth <= 0) return quiesce(s, alpha, beta, 4);
  let best = -Infinity;
  for (const m of order(s, moves)) {
    const v = -negamax(makeMove(s, m), depth - 1, -beta, -alpha, ply + 1);
    if (aborted) return 0;
    if (v > best) best = v;
    if (v > alpha) alpha = v;
    if (alpha >= beta) break;
  }
  return best;
}
export const LEVELS = { easy: 'קל', medium: 'בינוני', hard: 'קשה' };
export function botMove(s, level = 'medium') {
  const moves = legalMoves(s);
  if (moves.length <= 1) return moves[0];
  if (level === 'easy' && Math.random() < 0.3) return moves[Math.floor(Math.random() * moves.length)];
  const maxD = level === 'easy' ? 1 : level === 'medium' ? 3 : 6;
  deadline = Date.now() + (level === 'hard' ? 1500 : 800);
  let bestMoves = moves;
  for (let d = 1; d <= maxD; d++) {
    aborted = false;
    let best = -Infinity, list = [];
    for (const m of order(s, [...moves])) {
      const v = -negamax(makeMove(s, m), d - 1, -Infinity, -best === Infinity ? Infinity : -best + 1, 1);
      if (aborted) break;
      if (v > best) { best = v; list = [m]; } else if (v === best) list.push(m);
    }
    if (aborted) break;
    bestMoves = list;
    if (best > 90000) break;
  }
  const pick = bestMoves[Math.floor(Math.random() * bestMoves.length)];
  return pick;
}
