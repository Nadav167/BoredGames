// BoredGames – app shell
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth, signInAnonymously, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signInWithRedirect,
  getRedirectResult, linkWithPopup, signInWithCredential, signOut
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  getDatabase, ref, get, set, update, push, remove, onValue, runTransaction, onDisconnect, increment
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js';
import * as Taki from './games/taki.js';

const firebaseConfig = {
  apiKey: 'AIzaSyAxDe5vTn6Mnzjs6_iv8P69tQ1rzz_dJKE',
  authDomain: 'boredgames-b9ef1.firebaseapp.com',
  databaseURL: 'https://boredgames-b9ef1-default-rtdb.europe-west1.firebasedatabase.app',
  projectId: 'boredgames-b9ef1',
  storageBucket: 'boredgames-b9ef1.firebasestorage.app',
  messagingSenderId: '760954625208',
  appId: '1:760954625208:web:ac340d092df957591c684d'
};
const fbApp = initializeApp(firebaseConfig);
const auth = getAuth(fbApp);
const db = getDatabase(fbApp);

// ---------- games catalogue ----------
const GAMES = [
  { id: 'taki', name: 'טאקי', ico: '🃏', ready: true, min: 2, max: 8 },
  { id: 'imposter', name: 'המתחזה', ico: '🕵️' },
  { id: 'checkers', name: 'דמקה', ico: '⚫' },
  { id: 'backgammon', name: 'שש-בש', ico: '🎲' },
  { id: 'cheat', name: "צ'יט", ico: '🤥' },
  { id: 'shithead', name: 'שיט-הד', ico: '💩' },
  { id: 'durak', name: 'דוראק', ico: '🂡' },
  { id: 'eight', name: 'שמונה וחצי', ico: '8½' },
  { id: 'perudo', name: 'פרודו', ico: '🎰' },
  { id: 'rummy', name: 'רמי', ico: '🀄' },
  { id: 'cah', name: 'קלפים נגד האנושות', ico: '😈' },
  { id: 'chess', name: 'שחמט', ico: '♟️' },
  { id: 'poker', name: 'פוקר', ico: '♠️' },
  { id: 'codenames', name: 'שם קוד', ico: '🔤' },
  { id: 'catan', name: 'קטאן', ico: '🏝️' },
  { id: 'hitster', name: 'היטסטר', ico: '🎵' },
];
const gameById = id => GAMES.find(g => g.id === id);

// ---------- helpers ----------
const $ = s => document.querySelector(s);
const view = $('#view');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nickKey = n => n.trim().toLowerCase();
let toastTimer;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}
function modal(html) { const m = $('#modal'); m.innerHTML = `<div class="modal-box">${html}</div>`; m.hidden = false; return m; }
function closeModal() { $('#modal').hidden = true; $('#modal').innerHTML = ''; }
$('#modal').addEventListener('click', e => { if (e.target.id === 'modal' && !$('#modal').dataset.locked) closeModal(); });

// ---------- theme ----------
const darkToggle = $('#darkToggle');
function applyTheme(dark) { document.documentElement.dataset.theme = dark ? 'dark' : 'light'; darkToggle.checked = dark; }
let savedTheme = null; try { savedTheme = localStorage.getItem('bg-theme'); } catch {}
applyTheme(savedTheme ? savedTheme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches);
darkToggle.addEventListener('change', () => { applyTheme(darkToggle.checked); try { localStorage.setItem('bg-theme', darkToggle.checked ? 'dark' : 'light'); } catch {} });

// ---------- drawer ----------
const drawer = $('#drawer'), scrim = $('#scrim');
const openDrawer = o => { drawer.classList.toggle('open', o); scrim.classList.toggle('open', o); };
$('#menuBtn').onclick = () => openDrawer(true);
scrim.onclick = () => openDrawer(false);
$('#brandHome').onclick = () => me.nick && go('home');
drawer.querySelectorAll('[data-nav]').forEach(b => b.onclick = () => { openDrawer(false); go(b.dataset.nav); });

// ---------- state ----------
const me = { uid: null, nick: null };
let friends = {}, requests = {}, invites = {}, presence = {}, activeGame = null;
let screenOff = [];
let current = 'home';
let curGid = null, curGame = null;

function clearScreen() { screenOff.forEach(f => f()); screenOff = []; curGid = null; curGame = null; view.classList.remove('game-mode'); }
function go(name, arg) {
  clearScreen(); current = name;
  drawer.querySelectorAll('[data-nav]').forEach(b => b.classList.toggle('active', b.dataset.nav === name));
  ({ home: showHome, friends: showFriends, stats: showStats, about: showAbout, game: openGame }[name] || showHome)(arg);
  window.scrollTo(0, 0);
}

// ---------- auth & nickname ----------
const gProvider = new GoogleAuthProvider();
gProvider.setCustomParameters({ prompt: 'select_account' });
let claiming = false, sessionStarted = false, loginShown = '';
const G_ICON = `<svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.5 30.2 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.8 6C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z"/><path fill="#FBBC05" d="M10.5 28.7c-.5-1.4-.8-3-.8-4.7s.3-3.3.8-4.7l-7.8-6C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.8-6z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.7l-7.8 6C6.6 42.6 14.6 48 24 48z"/></svg>`;

getRedirectResult(auth).catch(e => toast('ההתחברות עם Google נכשלה: ' + (e.code || e.message)));

onAuthStateChanged(auth, async user => {
  if (!user) { showWelcome(); return; }
  me.uid = user.uid;
  updateAccountMenu();
  if (claiming || sessionStarted) return;
  const snap = await get(ref(db, `users/${me.uid}/nick`));
  if (snap.exists()) { me.nick = snap.val(); startSession(); }
  else showNickSetup(user.displayName ? user.displayName.split(' ')[0] : '');
});

function validNick(n) {
  if (n.length < 2) return 'לפחות 2 תווים';
  if (n.length > 16) return 'עד 16 תווים';
  if (/[.#$\[\]\/]/.test(n)) return 'בלי התווים . # $ [ ] /';
  return null;
}
async function claimNick(n) {
  const r = await runTransaction(ref(db, `nicks/${nickKey(n)}`), cur => (cur === null || cur === me.uid) ? me.uid : undefined);
  if (!r.committed) return false;
  await update(ref(db, `users/${me.uid}`), { nick: n, createdAt: Date.now() });
  me.nick = n; return true;
}
const nickInput = (val = '') => `<input class="input" id="nickIn" type="text" inputmode="text" dir="auto" value="${esc(val)}"
  placeholder="שם כינוי" autocomplete="nickname" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="go">`;

async function googleLogin(btn) {
  btn.disabled = true;
  try { await signInWithPopup(auth, gProvider); }
  catch (e) {
    if (['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment', 'auth/cancelled-popup-request'].includes(e.code))
      return signInWithRedirect(auth, gProvider);
    if (e.code !== 'auth/popup-closed-by-user') toast('ההתחברות נכשלה: ' + (e.code || e.message));
    btn.disabled = false;
  }
}

// first screen: nickname only, or Google
function showWelcome() {
  if (loginShown === 'welcome') return;
  loginShown = 'welcome';
  view.innerHTML = `
    <div class="center-msg"><div class="card" style="width:100%;max-width:380px">
      <div style="font-size:54px">🎲</div>
      <h1>ברוכים הבאים ל-BoredGames</h1>
      <button class="btn block google-btn" id="gBtn">${G_ICON}<span>התחברות עם Google</span></button>
      <p class="muted" style="font-size:13px;margin:6px 0 0">מומלץ: ככה החשבון והסטטיסטיקות נשמרים גם אם מחליפים טלפון</p>
      <div class="or"><span>או</span></div>
      <p class="muted" style="margin-top:0">כניסה מהירה עם שם כינוי בלבד</p>
      ${nickInput()}
      <button class="btn secondary block" id="nickGo" style="margin-top:12px">יאללה</button>
    </div></div>`;
  $('#gBtn').onclick = () => googleLogin($('#gBtn'));
  const go_ = async () => {
    const n = $('#nickIn').value.trim(), err = validNick(n);
    if (err) return toast(err);
    $('#nickGo').disabled = true; claiming = true;
    try {
      const taken = (await get(ref(db, `nicks/${nickKey(n)}`))).exists();
      if (taken) { toast('הכינוי הזה תפוס, נסה אחר'); return; }
      await signInAnonymously(auth); me.uid = auth.currentUser.uid;
      if (await claimNick(n)) startSession(); else toast('הכינוי הזה תפוס, נסה אחר');
    } catch (e) { toast('שגיאה: ' + (e.code || e.message)); }
    finally { claiming = false; if ($('#nickGo')) $('#nickGo').disabled = false; }
  };
  $('#nickGo').onclick = go_;
  $('#nickIn').onkeydown = e => e.key === 'Enter' && go_();
}

// signed in (e.g. new Google user) but no nickname yet
function showNickSetup(prefill) {
  if (loginShown === 'nick') return;
  loginShown = 'nick';
  view.innerHTML = `
    <div class="center-msg"><div class="card" style="width:100%;max-width:380px">
      <div style="font-size:54px">👋</div>
      <h1>בחר שם כינוי</h1>
      <p class="muted">החברים שלך ימצאו אותך לפיו, והסטטיסטיקות נשמרות עליו.</p>
      ${nickInput(prefill)}
      <button class="btn block" id="nickGo" style="margin-top:12px">יאללה</button>
      <button class="btn secondary block" id="nickOut" style="margin-top:8px">חזרה</button>
    </div></div>`;
  const go_ = async () => {
    const n = $('#nickIn').value.trim(), err = validNick(n);
    if (err) return toast(err);
    $('#nickGo').disabled = true; claiming = true;
    try { if (await claimNick(n)) startSession(); else toast('הכינוי הזה תפוס, נסה אחר'); }
    catch (e) { toast('שגיאה: ' + (e.code || e.message)); }
    finally { claiming = false; if ($('#nickGo')) $('#nickGo').disabled = false; }
  };
  $('#nickGo').onclick = go_;
  $('#nickIn').onkeydown = e => e.key === 'Enter' && go_();
  $('#nickOut').onclick = () => signOut(auth).then(() => location.reload());
}

// account items in the side menu
function updateAccountMenu() {
  const u = auth.currentUser;
  $('#linkGoogle').hidden = !u || !u.isAnonymous;
  $('#logoutBtn').hidden = !u || u.isAnonymous;
  $('#drawerMail').textContent = u && !u.isAnonymous ? (u.email || '') : '';
}
$('#linkGoogle').onclick = async () => {
  openDrawer(false);
  try {
    await linkWithPopup(auth.currentUser, gProvider);
    await auth.currentUser.reload(); updateAccountMenu();
    toast('החשבון חובר ל-Google ✓');
  } catch (e) {
    if (e.code === 'auth/credential-already-in-use') {
      const cred = GoogleAuthProvider.credentialFromError(e);
      modal(`<h3>חשבון ה-Google הזה כבר רשום</h3>
        <p class="muted">הוא שייך לכינוי אחר. לעבור אליו? הכינוי הנוכחי (${esc(me.nick)}) יישאר במכשיר הזה רק אם לא תעבור.</p>
        <button class="btn block" id="swY">עבור לחשבון ה-Google</button>
        <button class="btn secondary block" id="swN">ביטול</button>`);
      $('#swN').onclick = closeModal;
      $('#swY').onclick = async () => { await signInWithCredential(auth, cred); location.reload(); };
    } else if (e.code !== 'auth/popup-closed-by-user') toast('החיבור נכשל: ' + (e.code || e.message));
  }
};
$('#logoutBtn').onclick = () => {
  openDrawer(false);
  modal(`<h3>להתנתק?</h3><p class="muted">תוכל להתחבר שוב עם Google מכל טלפון.</p>
    <button class="btn danger block" id="loY">התנתק</button><button class="btn secondary block" id="loN">ביטול</button>`);
  $('#loN').onclick = closeModal;
  $('#loY').onclick = async () => { await remove(ref(db, `presence/${me.uid}`)).catch(() => {}); await signOut(auth); location.reload(); };
};

function startSession() {
  if (sessionStarted) return;
  sessionStarted = true; loginShown = '';
  $('#meNick').textContent = me.nick;
  $('#drawerNick').textContent = me.nick;
  onValue(ref(db, '.info/connected'), s => {
    if (s.val()) { const p = ref(db, `presence/${me.uid}`); onDisconnect(p).remove(); set(p, true); }
  });
  onValue(ref(db, 'presence'), s => { presence = s.val() || {}; if (current === 'friends') renderFriendsLists(); if (curGame?.status === 'lobby') renderLobby(curGame); });
  onValue(ref(db, `friends/${me.uid}`), s => { friends = s.val() || {}; if (current === 'friends') renderFriendsLists(); if (curGame?.status === 'lobby') renderLobby(curGame); });
  onValue(ref(db, `friendRequests/${me.uid}`), s => { requests = s.val() || {}; updateBadges(); if (current === 'friends') renderFriendsLists(); });
  onValue(ref(db, `invites/${me.uid}`), s => { invites = s.val() || {}; renderInvites(); });
  onValue(ref(db, `users/${me.uid}/activeGame`), s => { activeGame = s.val(); if (current === 'home') showHome(); });
  go('home');
}

function updateBadges() {
  const n = Object.keys(requests).length;
  for (const id of ['#menuBadge', '#friendsBadge']) { const b = $(id); b.hidden = !n; b.textContent = n; }
}

// ---------- invites ----------
function renderInvites() {
  const box = $('#invites');
  const fresh = Object.entries(invites).filter(([, v]) => Date.now() - (v.at || 0) < 15 * 60 * 1000);
  box.innerHTML = fresh.map(([gid, v]) => `
    <div class="invite">
      <div class="grow">🎮 <b>${esc(v.from)}</b> מזמין אותך ל${esc(gameById(v.game)?.name || 'משחק')}</div>
      <button class="btn small ok" data-acc="${gid}">הצטרף</button>
      <button class="btn small secondary" data-dec="${gid}">✕</button>
    </div>`).join('');
  box.querySelectorAll('[data-acc]').forEach(b => b.onclick = () => joinGame(b.dataset.acc));
  box.querySelectorAll('[data-dec]').forEach(b => b.onclick = () => remove(ref(db, `invites/${me.uid}/${b.dataset.dec}`)));
}

async function joinGame(gid) {
  await remove(ref(db, `invites/${me.uid}/${gid}`));
  const g = (await get(ref(db, `games/${gid}`))).val();
  if (!g) return toast('המשחק כבר לא קיים');
  if (g.status !== 'lobby' && !g.players?.[me.uid]) return toast('המשחק כבר התחיל');
  const cnt = Object.keys(g.players || {}).length;
  if (!g.players?.[me.uid] && cnt >= (gameById(g.type)?.max || 8)) return toast('המשחק מלא');
  await update(ref(db), {
    [`games/${gid}/players/${me.uid}`]: { nick: me.nick, at: Date.now() },
    [`users/${me.uid}/activeGame`]: gid
  });
  go('game', gid);
}

// ---------- home ----------
function showHome() {
  view.innerHTML = `
    ${activeGame ? `<button class="card resume btn block" id="resumeBtn" style="text-align:right">▶️ חזרה למשחק הפעיל</button>` : ''}
    <h1>שלום ${esc(me.nick)} 👋</h1>
    <div class="games">${GAMES.map(g => `
      <button class="game-tile ${g.ready ? '' : 'soon'}" data-g="${g.id}">
        ${g.ready ? '' : '<span class="tag">בקרוב</span>'}
        <span class="ico">${g.ico}</span><span class="nm">${esc(g.name)}</span>
      </button>`).join('')}
    </div>`;
  if (activeGame) $('#resumeBtn').onclick = () => go('game', activeGame);
  view.querySelectorAll('[data-g]').forEach(b => b.onclick = () => {
    const g = gameById(b.dataset.g);
    if (!g.ready) return toast(`${g.name} יגיע בקרוב 🔧`);
    gameMenu(g);
  });
}

function gameMenu(g) {
  modal(`
    <div style="font-size:48px">${g.ico}</div><h3>${esc(g.name)}</h3>
    <button class="btn block" id="mFriends">👥 משחק עם חברים</button>
    <div style="margin-top:14px" class="muted">או משחק מהיר נגד בוטים:</div>
    <div class="row" style="justify-content:center;margin-top:6px">
      ${[1, 2, 3, 4, 5].map(n => `<button class="btn secondary small" data-bots="${n}">${n} 🤖</button>`).join('')}
    </div>
    <button class="btn secondary block" id="mClose" style="margin-top:16px">ביטול</button>`);
  $('#mClose').onclick = closeModal;
  $('#mFriends').onclick = () => { closeModal(); createGame(g.id, 0); };
  document.querySelectorAll('[data-bots]').forEach(b => b.onclick = () => { closeModal(); createGame(g.id, +b.dataset.bots); });
}

const BOT_NAMES = ['רובי', 'ביפ', 'צ׳יפ', 'בוטי', 'מקס', 'נובה', 'זיגי'];
function botEntry(i) { return [`bot_${Date.now().toString(36)}_${i}`, { nick: `🤖 ${BOT_NAMES[i % BOT_NAMES.length]}`, bot: true, at: Date.now() + i + 1 }]; }

async function createGame(type, bots) {
  const gref = push(ref(db, 'games'));
  const players = { [me.uid]: { nick: me.nick, at: Date.now() } };
  for (let i = 0; i < bots; i++) { const [id, v] = botEntry(i); players[id] = v; }
  const g = { type, host: me.uid, status: 'lobby', players, createdAt: Date.now() };
  if (bots) { g.status = 'playing'; g.state = Taki.newGame(orderOf(players)); }
  await set(gref, g);
  await set(ref(db, `users/${me.uid}/activeGame`), gref.key);
  go('game', gref.key);
}
const orderOf = players => Object.entries(players).sort((a, b) => (a[1].at || 0) - (b[1].at || 0)).map(e => e[0]);

// ---------- game screen (lobby + table) ----------
function openGame(gid) {
  curGid = gid;
  view.innerHTML = '<div class="center-msg"><div class="spinner"></div></div>';
  const off = onValue(ref(db, `games/${gid}`), s => {
    const g = s.val();
    if (curGid !== gid) return;
    if (!g) { toast('המשחק נסגר'); set(ref(db, `users/${me.uid}/activeGame`), null); go('home'); return; }
    if (!g.players?.[me.uid]) { toast('יצאת מהמשחק'); go('home'); return; }
    curGame = g;
    if (g.status === 'lobby') renderLobby(g); else renderTaki(g);
    hostTick(g);
  });
  screenOff.push(off);
}

function renderLobby(g) {
  view.classList.remove('game-mode');
  const isHost = g.host === me.uid;
  const players = orderOf(g.players);
  const info = gameById(g.type);
  const friendIds = Object.keys(friends).filter(f => !g.players[f]);
  view.innerHTML = `
    <h1>${info.ico} ${esc(info.name)} – חדר המתנה</h1>
    <div class="card">
      <div class="muted">שחקנים (${players.length}/${info.max})</div>
      ${players.map(p => `<div class="list-item">
        <div class="avatar">${g.players[p].bot ? '🤖' : esc(g.players[p].nick[0])}</div>
        <div class="grow">${esc(g.players[p].nick)} ${p === g.host ? '<span class="pill">מארח</span>' : ''}</div>
        ${isHost && g.players[p].bot ? `<button class="btn small secondary" data-kick="${p}">הסר</button>` : ''}
      </div>`).join('')}
      ${isHost ? `<button class="btn secondary block" id="addBot" style="margin-top:10px">➕ הוסף בוט</button>` : ''}
    </div>
    ${isHost ? `<div class="card"><div class="muted">הזמן חברים</div>
      ${friendIds.length ? friendIds.map(f => `<div class="list-item">
        <span class="dot ${presence[f] ? 'on' : ''}"></span><div class="grow">${esc(friends[f])}</div>
        <button class="btn small" data-inv="${f}">הזמן</button></div>`).join('')
      : '<p class="muted">עוד אין לך חברים ברשימה. אפשר להוסיף בתפריט ← חברים.</p>'}
    </div>` : '<p class="muted center-msg" style="min-height:0">ממתינים שהמארח יתחיל את המשחק…</p>'}
    ${isHost ? `<button class="btn block" id="startBtn" ${players.length < info.min ? 'disabled' : ''}>🚀 התחל משחק</button>` : ''}
    <button class="btn danger block" id="leaveBtn" style="margin-top:10px">${isHost ? 'סגור חדר' : 'צא מהחדר'}</button>`;
  view.querySelectorAll('[data-inv]').forEach(b => b.onclick = async () => {
    await set(ref(db, `invites/${b.dataset.inv}/${curGid}`), { from: me.nick, game: g.type, at: Date.now() });
    b.disabled = true; b.textContent = 'נשלח ✓';
  });
  view.querySelectorAll('[data-kick]').forEach(b => b.onclick = () => remove(ref(db, `games/${curGid}/players/${b.dataset.kick}`)));
  if (isHost) {
    $('#addBot').onclick = () => {
      if (players.length >= info.max) return toast('החדר מלא');
      const [id, v] = botEntry(players.filter(p => g.players[p].bot).length);
      v.at = Date.now();
      set(ref(db, `games/${curGid}/players/${id}`), v);
    };
    $('#startBtn').onclick = () => update(ref(db, `games/${curGid}`), { status: 'playing', state: Taki.newGame(orderOf(g.players)) });
  }
  $('#leaveBtn').onclick = leaveGame;
}

async function leaveGame() {
  const gid = curGid, g = curGame;
  await set(ref(db, `users/${me.uid}/activeGame`), null);
  if (g && g.host === me.uid) await remove(ref(db, `games/${gid}`));
  else if (gid) await remove(ref(db, `games/${gid}/players/${me.uid}`));
  go('home');
}

// ---------- Taki UI ----------
// Real-card look: white face, coloured frame, big centre symbol, corner indices
const SYM = {
  stop: col => `<svg viewBox="0 0 60 60" class="sym"><polygon points="18,3 42,3 57,18 57,42 42,57 18,57 3,42 3,18" fill="${col}" stroke="#fff" stroke-width="3"/><text x="30" y="37" text-anchor="middle" font-size="16" font-weight="900" fill="#fff" font-family="Rubik,sans-serif">STOP</text></svg>`,
  dir: col => `<svg viewBox="0 0 60 60" class="sym"><g fill="none" stroke="${col}" stroke-width="7" stroke-linecap="round"><path d="M12 24 A18 18 0 0 1 46 18"/><path d="M48 36 A18 18 0 0 1 14 42"/></g><polygon points="40,8 54,19 38,26" fill="${col}"/><polygon points="20,52 6,41 22,34" fill="${col}"/></svg>`,
  color: () => `<svg viewBox="0 0 60 60" class="sym"><g stroke="#fff" stroke-width="2"><path d="M30 30 L30 4 A26 26 0 0 1 56 30 Z" fill="var(--red)"/><path d="M30 30 L56 30 A26 26 0 0 1 30 56 Z" fill="var(--yellow)"/><path d="M30 30 L30 56 A26 26 0 0 1 4 30 Z" fill="var(--green)"/><path d="M30 30 L4 30 A26 26 0 0 1 30 4 Z" fill="var(--blue)"/></g></svg>`,
  king: () => `<svg viewBox="0 0 60 60" class="sym"><path d="M8 44 L5 16 L19 28 L30 8 L41 28 L55 16 L52 44 Z" fill="#f4b400" stroke="#9a6b00" stroke-width="2.5" stroke-linejoin="round"/><rect x="8" y="46" width="44" height="7" rx="2" fill="#f4b400" stroke="#9a6b00" stroke-width="2.5"/><circle cx="30" cy="33" r="4" fill="#e53935"/><circle cx="18" cy="37" r="3" fill="#1e78e0"/><circle cx="42" cy="37" r="3" fill="#2e9e4f"/></svg>`,
};
const CORNER = { num: c => c.v, stop: () => 'S', dir: () => '⇄', plus2: () => '+2', plus: () => '+', taki: () => 'T', color: () => '◑', super: () => 'ST', king: () => '♚' };
function cardFace(c) {
  const col = c.c ? `var(--${c.c})` : '#222';
  switch (c.t) {
    case 'num': return `<span class="num">${c.v}</span>`;
    case 'plus2': return `<span class="num sm">+2</span>`;
    case 'plus': return `<span class="num">+</span>`;
    case 'taki': return `<span class="word">TAKI</span>`;
    case 'super': return `<span class="word super"><small>SUPER</small><span>T</span><span>A</span><span>K</span><span>I</span></span>`;
    default: return SYM[c.t](col);
  }
}
function cardHtml(c, extra = '', attrs = '') {
  const cls = c.c || (c.t === 'king' ? 'king' : 'wild');
  const k = CORNER[c.t](c);
  return `<div class="tk ${cls} t-${c.t} ${extra}" ${attrs}>
    <span class="ix ix1">${k}</span><div class="oval"></div><div class="face">${cardFace(c)}</div><span class="ix ix2">${k}</span></div>`;
}
const cardBack = (extra = '', inner = '') => `<div class="tk back ${extra}"><div class="back-in">${inner || '<b>BG</b>'}</div></div>`;
const COLOR_ORDER = { red: 0, yellow: 1, green: 2, blue: 3, undefined: 4 };
const TYPE_ORDER = ['num', 'plus2', 'plus', 'stop', 'dir', 'taki', 'color', 'super', 'king'];
const sortHand = h => [...h].sort((a, b) => (COLOR_ORDER[a.c] - COLOR_ORDER[b.c]) || (TYPE_ORDER.indexOf(a.t) - TYPE_ORDER.indexOf(b.t)) || ((a.v || 0) - (b.v || 0)));

// lay the hand out as a fan (arch)
function layoutFan() {
  const fan = $('.fan'); if (!fan) return;
  const cards = [...fan.children], n = cards.length;
  const W = fan.getBoundingClientRect().width || view.clientWidth - 16;
  const cw = n > 16 ? 54 : n > 10 ? 60 : 68, ch = cw * 1.46;
  const total = Math.min(5 * (n - 1), 44);
  const sway = cw * 1.46 * Math.sin(total / 2 * Math.PI / 180); // rotated corners stick out
  const spacing = n > 1 ? Math.min(cw * 0.7, (W - cw - 1.7 * sway - 12) / (n - 1)) : 0;
  const R = Math.max(W * 1.1, 380);
  let maxY = 0;
  cards.forEach((el, i) => {
    const t = n > 1 ? i / (n - 1) - 0.5 : 0;
    const ang = total * t, rad = ang * Math.PI / 180;
    const x = W / 2 + (i - (n - 1) / 2) * spacing - cw / 2;
    const y = R * (1 - Math.cos(rad));
    maxY = Math.max(maxY, y);
    el.style.setProperty('--w', cw + 'px');
    el.style.left = (x + 0) + "px";
    el.style.top = (18 + y) + 'px';
    el.style.setProperty('--a', ang + 'deg');
    el.style.zIndex = i + 1;
  });
  fan.style.height = (ch + maxY + 34) + 'px';
}
window.addEventListener('resize', layoutFan);
const colorChip = c => `<span class="color-chip" style="background:var(--${c})"></span>`;

function renderTaki(g) {
  view.classList.add('game-mode');
  const s = Taki.norm(structuredClone(g.state));
  const names = p => g.players[p]?.nick || 'שחקן שיצא';
  const myTurn = Taki.current(s) === me.uid && !s.winner;
  const myIdx = s.order.indexOf(me.uid);
  const others = [...s.order.slice(myIdx + 1), ...s.order.slice(0, myIdx)];
  const hand = s.hands[me.uid] || [];
  const t = Taki.top(s);

  let status;
  if (s.winner) status = `🏆 <b>${esc(names(s.winner))}</b> ניצח!`;
  else if (myTurn) {
    if (s.plus2) status = `<b>+${s.plus2}</b>: שים +2 או מלך, או קח ${s.plus2} קלפים`;
    else if (s.taki) status = `טאקי פתוח! שים עוד קלפים ${colorChip(s.color)} או סגור`;
    else if (s.free) status = 'מלך! אפשר לשים כל קלף';
    else if (s.again) status = 'פלוס! שים עוד קלף או קח מהקופה';
    else status = '<b>התור שלך</b>';
  } else status = `התור של <b>${esc(names(Taki.current(s)))}</b>${s.plus2 ? ` · +${s.plus2} מצטבר` : ''}`;

  let lastTxt = '';
  if (s.last && s.last.p) lastTxt = s.last.drew != null ? `${esc(names(s.last.p))} לקח ${s.last.drew} קלפים` : `${esc(names(s.last.p))} שם קלף`;

  view.innerHTML = `
    <div class="table">
      <div class="game-top"><button class="btn small" id="exitBtn">✕ יציאה</button>
        <div class="grow dir">${s.dir === 1 ? '↻' : '↺'} כיוון משחק · קופה: ${s.deck.length}</div></div>
      <div class="opps">${others.map(p => `
        <div class="opp ${Taki.current(s) === p && !s.winner ? 'turn' : ''}">
          <div class="n">${esc(names(p))}</div>
          <div class="mini-cards">${'<span></span>'.repeat(Math.min(s.hands[p].length, 12))}</div>
          <div class="c">${s.hands[p].length} קלפים</div>
        </div>`).join('')}</div>
      <div class="center">
        <div class="piles">
          <button class="deck-btn ${myTurn && !s.taki && !hand.some(c => Taki.canPlay(s, c)) ? 'hint' : ''}" id="deckBtn">
            ${cardBack('deckcard', `<b>BG</b><span>${s.plus2 ? `קח ${s.plus2}` : 'קופה'}</span>`)}</button>
          ${cardHtml(t, 'topcard')}
        </div>
        <div>צבע נוכחי: ${colorChip(s.color)} ${Taki.COLOR_HE[s.color]}</div>
        <div class="status">${status}</div>
        <div class="dir">${lastTxt}</div>
      </div>
      <div class="hand-wrap">
        <div class="hand-title">הקלפים שלך (${hand.length})</div>
        <div class="fan">${sortHand(hand).map(c => {
          const ok = myTurn && Taki.canPlay(s, c);
          return cardHtml(c, myTurn ? (ok ? 'playable' : 'dim') : '', `data-card="${c.id}"`);
        }).join('')}</div>
        ${myTurn && s.taki ? '<div class="hand-actions"><button class="btn" id="closeTaki">סגור טאקי</button></div>' : ''}
      </div>
    </div>`;
  layoutFan();

  $('#exitBtn').onclick = () => {
    modal(`<h3>לצאת מהמשחק?</h3>
      <p class="muted">${g.host === me.uid ? 'אתה המארח – יציאה תסגור את המשחק לכולם.' : 'תוכל לחזור מהמסך הראשי.'}</p>
      ${g.host === me.uid ? '' : '<button class="btn block" id="xHome">לך למסך הראשי (המשחק ממשיך)</button>'}
      <button class="btn danger block" id="xLeave">${g.host === me.uid ? 'סגור משחק' : 'עזוב את המשחק'}</button>
      <button class="btn secondary block" id="xNo">ביטול</button>`);
    $('#xNo').onclick = closeModal;
    $('#xLeave').onclick = () => { closeModal(); leaveGame(); };
    if ($('#xHome')) $('#xHome').onclick = () => { closeModal(); go('home'); };
  };
  $('#deckBtn').onclick = () => { if (myTurn) act({ type: s.taki ? 'close' : 'draw' }); };
  if ($('#closeTaki')) $('#closeTaki').onclick = () => act({ type: 'close' });
  view.querySelectorAll('[data-card]').forEach(el => el.onclick = () => {
    if (!myTurn) return toast('זה לא התור שלך');
    const card = hand.find(c => c.id === +el.dataset.card);
    if (!Taki.canPlay(s, card)) { el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); return; }
    if (card.t === 'color' && !s.taki) {
      modal(`<h3>בחר צבע</h3><div class="color-pick">${Taki.COLORS.map(c =>
        `<button style="background:var(--${c})" data-col="${c}">${Taki.COLOR_HE[c]}</button>`).join('')}</div>`);
      document.querySelectorAll('[data-col]').forEach(b => b.onclick = () => { closeModal(); act({ type: 'play', cardId: card.id, color: b.dataset.col }); });
    } else act({ type: 'play', cardId: card.id });
  });

  if (s.winner && !$('#modal').dataset.winShown) showWinner(g, s, names);
  if (!s.winner) delete $('#modal').dataset.winShown;
}

function showWinner(g, s, names) {
  $('#modal').dataset.winShown = '1';
  const isHost = g.host === me.uid;
  modal(`<div style="font-size:60px">${s.winner === me.uid ? '🏆' : '🎉'}</div>
    <h3>${s.winner === me.uid ? 'ניצחת!!' : `${esc(names(s.winner))} ניצח`}</h3>
    ${isHost ? '<button class="btn block" id="again">🔁 משחק נוסף</button>' : '<p class="muted">המארח יכול להתחיל משחק נוסף</p>'}
    <button class="btn secondary block" id="wHome">למסך הראשי</button>`);
  if (isHost) $('#again').onclick = () => {
    closeModal();
    const order = orderOf(g.players);
    if (order.length < 2) return toast('צריך לפחות 2 שחקנים');
    update(ref(db, `games/${curGid}`), { status: 'playing', state: Taki.newGame(order) });
  };
  $('#wHome').onclick = () => { closeModal(); isHost ? leaveGame() : go('home'); };
}

async function act(move, who = me.uid) {
  const gid = curGid;
  try {
    const r = await runTransaction(ref(db, `games/${gid}/state`), st => {
      if (!st) return st;
      st = Taki.norm(st);
      if (Taki.apply(st, who, move)) return; // illegal → abort
      return st;
    });
    if (!r.committed && who === me.uid) toast('המהלך לא התקבל, נסה שוב');
  } catch (e) { toast('שגיאת חיבור'); }
}

// host drives the bots and records results
let botBusy = false;
function hostTick(g) {
  if (!g || g.host !== me.uid || g.status !== 'playing' || !g.state) return;
  const s = Taki.norm(structuredClone(g.state));
  if (s.winner) { finishGame(g, s); return; }
  const cur = Taki.current(s);
  if (!g.players[cur]?.bot || botBusy) return;
  botBusy = true;
  const gid = curGid;
  setTimeout(async () => {
    try {
      if (curGid !== gid) return;
      await runTransaction(ref(db, `games/${gid}/state`), st => {
        if (!st) return st;
        st = Taki.norm(st);
        if (st.winner || Taki.current(st) !== cur) return;
        if (Taki.apply(st, cur, Taki.botMove(st, cur))) return;
        return st;
      });
    } catch {}
    finally { botBusy = false; if (curGid === gid && curGame) hostTick(curGame); }
  }, s.taki ? 550 : 1000);
}

async function finishGame(g, s) {
  const gid = curGid;
  const r = await runTransaction(ref(db, `games/${gid}/status`), st => st === 'playing' ? 'done' : undefined);
  if (!r.committed) return;
  const u = {};
  for (const p of s.order) {
    if (!g.players[p] || g.players[p].bot) continue;
    u[`users/${p}/stats/${g.type}/played`] = increment(1);
    if (p === s.winner) u[`users/${p}/stats/${g.type}/won`] = increment(1);
  }
  if (Object.keys(u).length) await update(ref(db), u);
}

// ---------- friends ----------
function showFriends() {
  view.innerHTML = `
    <h1>👥 חברים</h1>
    <div class="card">
      <div class="muted" style="margin-bottom:8px">הוסף חבר לפי שם הכינוי שלו</div>
      <div class="row"><input class="input grow" id="fNick" placeholder="שם כינוי" autocomplete="off">
        <button class="btn" id="fSend">שלח</button></div>
    </div>
    <div id="fLists"></div>`;
  const send = async () => {
    const n = $('#fNick').value.trim(); if (!n) return;
    const s = await get(ref(db, `nicks/${nickKey(n)}`));
    if (!s.exists()) return toast('לא נמצא שחקן בשם הזה');
    const uid = s.val();
    if (uid === me.uid) return toast('זה אתה 😄');
    if (friends[uid]) return toast('אתם כבר חברים');
    if (requests[uid]) return acceptReq(uid);
    await set(ref(db, `friendRequests/${uid}/${me.uid}`), { nick: me.nick, at: Date.now() });
    $('#fNick').value = ''; toast('בקשת חברות נשלחה ✓');
  };
  $('#fSend').onclick = send;
  $('#fNick').onkeydown = e => e.key === 'Enter' && send();
  renderFriendsLists();
}

function renderFriendsLists() {
  const box = $('#fLists'); if (!box) return;
  const reqs = Object.entries(requests);
  const fr = Object.entries(friends).sort((a, b) => (presence[b[0]] ? 1 : 0) - (presence[a[0]] ? 1 : 0));
  box.innerHTML = `
    ${reqs.length ? `<h2>בקשות חברות</h2><div class="card">${reqs.map(([u, v]) => `
      <div class="list-item"><div class="avatar">${esc(v.nick[0])}</div><div class="grow">${esc(v.nick)}</div>
        <button class="btn small ok" data-ok="${u}">אשר</button><button class="btn small secondary" data-no="${u}">דחה</button></div>`).join('')}</div>` : ''}
    <h2>החברים שלי (${fr.length})</h2>
    <div class="card">${fr.length ? fr.map(([u, n]) => `
      <div class="list-item"><span class="dot ${presence[u] ? 'on' : ''}"></span><div class="avatar">${esc(n[0])}</div>
        <div class="grow">${esc(n)}<div class="muted" style="font-size:13px">${presence[u] ? 'מחובר' : 'לא מחובר'}</div></div>
        <button class="btn small secondary" data-rm="${u}">הסר</button></div>`).join('')
      : '<p class="muted">עוד אין חברים. שלח בקשה למעלה!</p>'}</div>`;
  box.querySelectorAll('[data-ok]').forEach(b => b.onclick = () => acceptReq(b.dataset.ok));
  box.querySelectorAll('[data-no]').forEach(b => b.onclick = () => remove(ref(db, `friendRequests/${me.uid}/${b.dataset.no}`)));
  box.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => {
    const u = b.dataset.rm;
    modal(`<h3>להסיר את ${esc(friends[u])}?</h3><button class="btn danger block" id="rmY">הסר</button><button class="btn secondary block" id="rmN">ביטול</button>`);
    $('#rmN').onclick = closeModal;
    $('#rmY').onclick = () => { closeModal(); update(ref(db), { [`friends/${me.uid}/${u}`]: null, [`friends/${u}/${me.uid}`]: null }); };
  });
}

async function acceptReq(u) {
  const nick = requests[u]?.nick;
  await update(ref(db), {
    [`friends/${me.uid}/${u}`]: nick,
    [`friends/${u}/${me.uid}`]: me.nick,
    [`friendRequests/${me.uid}/${u}`]: null,
  });
  toast(`${nick} נוסף לחברים 🎉`);
}

// ---------- stats ----------
async function showStats() {
  view.innerHTML = '<h1>📊 הסטטיסטיקות שלי</h1><div class="card" id="statBox"><div class="spinner"></div></div>';
  const st = (await get(ref(db, `users/${me.uid}/stats`))).val() || {};
  const rows = GAMES.filter(g => st[g.id]);
  let tp = 0, tw = 0;
  rows.forEach(g => { tp += st[g.id].played || 0; tw += st[g.id].won || 0; });
  $('#statBox').innerHTML = rows.length ? `
    <div class="stat-row"><b>סה״כ</b><span class="pill">${tw} ניצחונות מתוך ${tp} משחקים</span></div>
    ${rows.map(g => {
      const p = st[g.id].played || 0, w = st[g.id].won || 0;
      return `<div class="stat-row"><span>${g.ico} ${esc(g.name)}</span><span class="pill">${w}/${p} · ${p ? Math.round(w / p * 100) : 0}%</span></div>`;
    }).join('')}`
    : '<p class="muted">עוד לא סיימת אף משחק. יאללה, לשחק!</p>';
}

// ---------- about ----------
function showAbout() {
  view.innerHTML = `
    <h1>ℹ️ אודות</h1>
    <div class="card">
      <p><b>BoredGames</b> – משחקים עם חברים, או מול בוטים כשאין עם מי.</p>
      <p class="muted">מוסיפים חברים לפי שם כינוי, מזמינים אותם לחדר, ומשחקים בזמן אמת. כל ניצחון נשמר בסטטיסטיקות שלך.</p>
      <p class="muted">טיפ: באייפון – שתף ← "הוסף למסך הבית". באנדרואיד – תפריט ⋮ ← "התקן אפליקציה".</p>
    </div>
    <div class="card"><b>חוקי טאקי באפליקציה</b>
      <ul class="muted" style="padding-inline-start:18px;line-height:1.7">
        <li>שמים קלף באותו צבע או באותו מספר/סימן.</li>
        <li>+2 מצטבר. אפשר להחזיר +2 או לבטל עם מלך.</li>
        <li>טאקי: שמים כמה קלפים שרוצים מאותו צבע ואז סוגרים. הקלף האחרון "עובד".</li>
        <li>פלוס: שמים עוד קלף. מלך: שמים כל קלף שרוצים.</li>
        <li>אי אפשר לסיים עם פלוס או מלך – לוקחים קלף.</li>
      </ul></div>`;
}
