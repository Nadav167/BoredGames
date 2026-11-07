// BoredGames – Hitster (around the table)
// Everyone builds a timeline of songs ordered by year. On your turn a song plays (opened by the "DJ" in a music app);
// you place it in your timeline. Right spot → the card stays. First to the target wins.
// mode 'one' – one shared phone; 'multi' – every player on their own phone (DJ = the next player).
import { songs } from './songs.js';

function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
export const DEFAULT_SETTINGS = { mode: 'one', service: 'spotify', pack: 'mix', target: 10 };
export const SERVICES = {
  spotify: { name: 'Spotify', url: q => `https://open.spotify.com/search/${encodeURIComponent(q)}` },
  apple: { name: 'Apple Music', url: q => `https://music.apple.com/il/search?term=${encodeURIComponent(q)}` },
  youtube: { name: 'YouTube Music', url: q => `https://music.youtube.com/search?q=${encodeURIComponent(q)}` },
};
export const list = pack => songs(pack);

export function newGame(order, settings) {
  const st = { ...DEFAULT_SETTINGS, ...(settings || {}) };
  const deck = shuffle(list(st.pack).map((_, i) => i));
  const lines = {}; for (const p of order) lines[p] = [deck.pop()];
  const s = { order, mode: st.mode, service: st.service, pack: st.pack, target: st.target, deck, lines,
    turn: order[Math.floor(Math.random() * order.length)], winner: '', round: 0 };
  return nextSong(s, true);
}
export function norm(s) {
  s.order = Object.values(s.order || []);
  s.deck = s.deck ? Object.values(s.deck) : [];
  s.lines = s.lines || {}; for (const p of s.order) s.lines[p] = s.lines[p] ? Object.values(s.lines[p]) : [];
  s.winner = s.winner || ''; s.slot = s.slot ?? null;
  return s;
}
export const year = (s, i) => list(s.pack)[i].y;
export const song = (s, i) => list(s.pack)[i];
export const sorted = (s, p) => [...s.lines[p]].sort((a, b) => year(s, a) - year(s, b));
export const dj = s => s.order[(s.order.indexOf(s.turn) + 1) % s.order.length];

function nextSong(s, first) {
  if (!first) s.turn = s.order[(s.order.indexOf(s.turn) + 1) % s.order.length];
  if (!s.deck.length) {                       // out of songs: most cards wins
    const best = Math.max(...s.order.map(p => s.lines[p].length));
    s.winner = s.order.find(p => s.lines[p].length === best); s.phase = 'over'; return s;
  }
  s.current = s.deck.pop(); s.round = (s.round || 0) + 1;
  s.phase = 'listen'; s.slot = null; s.correct = null;
  return s;
}
export function startPlacing(s) { if (s.phase !== 'listen') return 'phase'; s.phase = 'place'; return null; }
export function place(s, slot) {
  if (s.phase !== 'place') return 'phase';
  const line = sorted(s, s.turn), y = year(s, s.current);
  if (!(slot >= 0 && slot <= line.length)) return 'slot';
  const ok = (slot === 0 || year(s, line[slot - 1]) <= y) && (slot === line.length || y <= year(s, line[slot]));
  s.slot = slot; s.correct = ok; s.phase = 'reveal';
  if (ok) { s.lines[s.turn].push(s.current); if (s.lines[s.turn].length >= s.target) { s.winner = s.turn; } }
  return null;
}
export function next(s) { if (s.phase !== 'reveal' || s.winner) return 'phase'; nextSong(s); return null; }
