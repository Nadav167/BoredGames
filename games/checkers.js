// BoredGames – Checkers (דמקה) engine
// Board: 64-char string, index r*8+c, row 0 at the top (black's side).
// '.' empty, 'w' white man, 'W' white king, 'b' black man, 'B' black king. White moves up and starts.
// rules: 'il' – Israeli: flying kings, men capture backwards too
//        'en' – English: kings move one square, men capture forward only, turn ends when a man is crowned
// Captures are mandatory in both; a capture sequence must be completed.

export const RULES = { il: 'חוקים ישראליים', en: 'חוקים אנגליים' };
export const RULES_INFO = {
  il: 'מלכה זזה כמה משבצות שרוצה · חייל אוכל גם אחורה · חובה לאכול',
  en: 'מלכה זזה משבצת אחת · חייל אוכל רק קדימה · חובה לאכול',
};

const owner = p => (p === 'w' || p === 'W') ? 'w' : (p === 'b' || p === 'B') ? 'b' : '';
const isKing = p => p === 'W' || p === 'B';
const other = t => t === 'w' ? 'b' : 'w';
const DIRS = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
const inside = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;
const fwd = t => t === 'w' ? -1 : 1;
const lastRow = t => t === 'w' ? 0 : 7;

export function newGame(rules = 'il') {
  let b = '';
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++)
    b += (r + c) % 2 === 1 ? (r < 3 ? 'b' : r > 4 ? 'w' : '.') : '.';
  return { board: b, turn: 'w', rules, quiet: 0, winner: '', last: '' };
}

function capsFrom(b, pos, piece, rules, path, taken, out) {
  const t = owner(piece), king = isKing(piece), r0 = pos >> 3, c0 = pos & 7;
  let any = false;
  for (const [dr, dc] of DIRS) {
    if (!king && rules === 'en' && dr !== fwd(t)) continue;
    if (king && rules === 'il') {
      let r = r0 + dr, c = c0 + dc;
      while (inside(r, c) && b[r * 8 + c] === '.') { r += dr; c += dc; }
      if (!inside(r, c)) continue;
      const v = r * 8 + c;
      if (owner(b[v]) !== other(t) || taken.includes(v)) continue;
      let lr = r + dr, lc = c + dc;
      while (inside(lr, lc) && b[lr * 8 + lc] === '.') {
        const land = lr * 8 + lc; any = true;
        capsFrom(b, land, piece, rules, [...path, land], [...taken, v], out);
        lr += dr; lc += dc;
      }
    } else {
      const r = r0 + dr, c = c0 + dc, lr = r0 + 2 * dr, lc = c0 + 2 * dc;
      if (!inside(lr, lc)) continue;
      const v = r * 8 + c, land = lr * 8 + lc;
      if (owner(b[v]) !== other(t) || taken.includes(v) || b[land] !== '.') continue;
      any = true;
      if (!king && rules === 'en' && lr === lastRow(t)) { out.push({ path: [...path, land], taken: [...taken, v] }); continue; }
      capsFrom(b, land, piece, rules, [...path, land], [...taken, v], out);
    }
  }
  if (!any && taken.length) out.push({ path, taken });
}

export function legalMoves(s) {
  const t = s.turn, caps = [], quiet = [];
  for (let i = 0; i < 64; i++) {
    if (owner(s.board[i]) !== t) continue;
    const b = s.board.slice(0, i) + '.' + s.board.slice(i + 1); // moving piece leaves its square
    capsFrom(b, i, s.board[i], s.rules, [i], [], caps);
  }
  if (caps.length) return caps;
  for (let i = 0; i < 64; i++) {
    const p = s.board[i];
    if (owner(p) !== t) continue;
    const r0 = i >> 3, c0 = i & 7;
    for (const [dr, dc] of DIRS) {
      if (!isKing(p) && dr !== fwd(t)) continue;
      let r = r0 + dr, c = c0 + dc;
      while (inside(r, c) && s.board[r * 8 + c] === '.') {
        quiet.push({ path: [i, r * 8 + c], taken: [] });
        if (!(isKing(p) && s.rules === 'il')) break;
        r += dr; c += dc;
      }
    }
  }
  return quiet;
}

export function applyMove(s, m) {
  const b = s.board.split('');
  const from = m.path[0], to = m.path[m.path.length - 1];
  let p = b[from];
  b[from] = '.';
  for (const v of m.taken) b[v] = '.';
  const wasMan = !isKing(p);
  if (wasMan && (to >> 3) === lastRow(s.turn)) p = p.toUpperCase();
  b[to] = p;
  s.board = b.join('');
  s.quiet = (m.taken.length || wasMan) ? 0 : (s.quiet || 0) + 1;
  s.last = m.path.join(',');
  s.turn = other(s.turn);
  if (!legalMoves(s).length) s.winner = other(s.turn);
  else if (s.quiet >= 50) s.winner = 'draw';
  return s;
}

export const samePath = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
export function play(s, path) {
  if (s.winner) return 'over';
  const m = legalMoves(s).find(m => samePath(m.path, path));
  if (!m) return 'illegal';
  applyMove(s, m); return null;
}

export const count = (board, t) => [...board].filter(p => owner(p) === t).length;

// ---------- bot: alpha-beta search ----------
function evaluate(s, me) {
  const kingVal = s.rules === 'il' ? 320 : 170;
  let sc = 0;
  for (let i = 0; i < 64; i++) {
    const p = s.board[i]; if (p === '.') continue;
    const t = owner(p), r = i >> 3, c = i & 7;
    let v = isKing(p) ? kingVal : 100 + (t === 'w' ? 7 - r : r) * 4;
    if (!isKing(p) && (r === 0 || r === 7)) v += 6;          // back row guard
    if (c >= 2 && c <= 5 && r >= 2 && r <= 5) v += 5;         // centre
    sc += t === me ? v : -v;
  }
  return sc;
}
function search(s, depth, alpha, beta, me, deadline) {
  if (s.winner) return s.winner === 'draw' ? 0 : (s.winner === me ? 100000 + depth : -100000 - depth);
  if (depth <= 0 || Date.now() > deadline) return evaluate(s, me);
  const moves = legalMoves(s);
  const maxing = s.turn === me;
  let best = maxing ? -Infinity : Infinity;
  for (const m of moves) {
    const n = applyMove({ ...s }, m);
    const v = search(n, depth - (moves.length === 1 ? 0 : 1), alpha, beta, me, deadline);
    if (maxing) { best = Math.max(best, v); alpha = Math.max(alpha, v); }
    else { best = Math.min(best, v); beta = Math.min(beta, v); }
    if (beta <= alpha) break;
  }
  return best;
}
export const LEVELS = { easy: 'קל', medium: 'בינוני', hard: 'קשה' };
export function botMove(s, level = 'medium') {
  const moves = legalMoves(s);
  if (moves.length <= 1) return moves[0];
  const me = s.turn;
  if (level === 'easy' && Math.random() < 0.45) return moves[Math.floor(Math.random() * moves.length)];
  const maxDepth = level === 'easy' ? 1 : level === 'medium' ? 4 : 9;
  const deadline = Date.now() + (level === 'hard' ? 900 : 400);
  let bestMoves = moves;
  for (let d = 1; d <= maxDepth; d++) {           // iterative deepening
    let best = -Infinity, list = [];
    for (const m of moves) {
      const v = search(applyMove({ ...s }, m), d - 1, -Infinity, Infinity, me, deadline);
      if (v > best) { best = v; list = [m]; } else if (v === best) list.push(m);
    }
    if (Date.now() > deadline && d > 1) break;
    bestMoves = list;
  }
  return bestMoves[Math.floor(Math.random() * bestMoves.length)];
}
