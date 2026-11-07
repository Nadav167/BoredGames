// BoredGames – Codenames (שם קוד), fully online
// 25 words. Starting team has 9 agents, the other 8, 7 bystanders, 1 assassin.
// Each team: one spymaster (sees the key) and operatives. Spymaster gives "word + number",
// operatives reveal cards: own colour → may continue (up to number+1), anything else ends the turn,
// the assassin loses the game. First team to reveal all its agents wins.
import { parse } from './codewords.js';

function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
export const TEAM_HE = { r: 'האדומה', b: 'הכחולה' };

export function newGame(lang, teams, spy) {
  const words = shuffle(parse(lang)).slice(0, 25).map(x => x.w);
  const first = Math.random() < 0.5 ? 'r' : 'b', second = first === 'r' ? 'b' : 'r';
  const key = shuffle([...Array(9).fill(first), ...Array(8).fill(second), ...Array(7).fill('n'), 'a']);
  return { lang, words, key, revealed: {}, teams, spy, turn: first, first, phase: 'clue', clue: null, left: 0, winner: '', log: [] };
}
export function norm(s) {
  s.words = Object.values(s.words || {}); s.key = Object.values(s.key || {});
  s.revealed = s.revealed || {}; s.teams = s.teams || {}; s.spy = s.spy || {};
  s.clue = s.clue || null; s.left = s.left || 0; s.winner = s.winner || ''; s.log = s.log ? Object.values(s.log) : [];
  return s;
}
export const remaining = (s, t) => s.key.filter((k, i) => k === t && !s.revealed[i]).length;
const other = t => t === 'r' ? 'b' : 'r';

export function giveClue(s, p, word, n) {
  if (s.winner || s.phase !== 'clue') return 'phase';
  if (s.spy[s.turn] !== p) return 'notspy';
  word = String(word || '').trim();
  if (!word || /\s/.test(word)) return 'oneword';
  if (s.words.some((w, i) => !s.revealed[i] && w.replace(/-/g, ' ').toLowerCase() === word.replace(/-/g, ' ').toLowerCase())) return 'boardword';
  if (!(n >= 0 && n <= 9)) return 'num';
  s.clue = { word, n, team: s.turn };
  s.left = n === 0 ? 99 : n + 1;
  s.phase = 'guess';
  s.log.push(`${s.turn}:clue:${word}:${n}`);
  return null;
}
export function guess(s, p, i) {
  if (s.winner || s.phase !== 'guess') return 'phase';
  if (s.teams[p] !== s.turn || s.spy[s.turn] === p) return 'notyours';
  if (s.revealed[i] || i < 0 || i > 24) return 'card';
  s.revealed[i] = true;
  const k = s.key[i];
  s.log.push(`${s.turn}:guess:${i}`);
  if (k === 'a') { s.winner = other(s.turn); s.reason = 'assassin'; return null; }
  if (!remaining(s, 'r')) { s.winner = 'r'; return null; }
  if (!remaining(s, 'b')) { s.winner = 'b'; return null; }
  if (k === s.turn) { s.left--; if (s.left <= 0) endTurn(s); }
  else endTurn(s);
  return null;
}
export function pass(s, p) {
  if (s.winner || s.phase !== 'guess' || s.teams[p] !== s.turn || s.spy[s.turn] === p) return 'phase';
  endTurn(s); return null;
}
function endTurn(s) { s.turn = other(s.turn); s.phase = 'clue'; s.clue = null; s.left = 0; }

// ---------- clue helper ----------
// Uses the association lists: picks an association shared by as many of the team's
// unrevealed words as possible, never one linked to the assassin, avoiding the other colours.
export function suggest(s, team, skip = []) {
  const db = new Map(parse(s.lang).map(x => [x.w, x.tags]));
  const boardNorm = new Set(s.words.map(w => w.replace(/-/g, ' ').toLowerCase()));
  const cands = new Map();
  s.words.forEach((w, i) => {
    if (s.revealed[i]) return;
    for (const t of db.get(w) || []) {
      if (!cands.has(t)) cands.set(t, { own: [], opp: 0, neu: 0, ass: false });
      const c = cands.get(t), k = s.key[i];
      if (k === team) c.own.push(w); else if (k === 'a') c.ass = true; else if (k === 'n') c.neu++; else c.opp++;
    }
  });
  const list = [...cands.entries()]
    .filter(([t, c]) => !c.ass && c.own.length && !boardNorm.has(t.replace(/-/g, ' ').toLowerCase()) && !skip.includes(t))
    .map(([t, c]) => ({ word: t, n: c.own.length, targets: c.own, score: c.own.length * 3 - c.opp * 2.5 - c.neu * 1.2 + Math.random() * 0.5 }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score);
  return list[0] || null;
}
