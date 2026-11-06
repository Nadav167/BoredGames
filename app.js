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
import * as Imp from './games/imposter.js';
import * as Ck from './games/checkers.js';
import * as Bg from './games/backgammon.js';

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
  { id: 'imposter', name: 'המתחזה', ico: '🕵️', ready: true, min: 3, max: 16, bots: false, table: true },
  { id: 'checkers', name: 'דמקה', ico: '⚫', ready: true, min: 2, max: 2, botLevels: true },
  { id: 'backgammon', name: 'שש-בש', ico: '🎲', ready: true, min: 2, max: 2, oneBot: true },
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
  $('#nickIn').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); go_(); } };
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
  $('#nickIn').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); go_(); } };
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
    ${g.table ? '<p class="muted">משחק סביב השולחן: כל אחד מחזיק את הטלפון שלו, והדיבור קורה בקול.</p>' : ''}
    <button class="btn block" id="mFriends">👥 ${g.table ? 'פתח חדר והזמן את החברים' : 'משחק עם חברים'}</button>
    ${g.oneBot ? `<button class="btn secondary block" data-bots="1" style="margin-top:10px">🤖 משחק נגד בוט</button>` : g.botLevels ? `<div style="margin-top:14px" class="muted">או משחק נגד בוט:</div>
    <div class="row" style="justify-content:center;margin-top:6px">
      ${Object.entries(Ck.LEVELS).map(([k, n]) => `<button class="btn secondary small" data-level="${k}">🤖 ${n}</button>`).join('')}
    </div>` : g.bots === false ? '' : `<div style="margin-top:14px" class="muted">או משחק מהיר נגד בוטים:</div>
    <div class="row" style="justify-content:center;margin-top:6px">
      ${[1, 2, 3, 4, 5].map(n => `<button class="btn secondary small" data-bots="${n}">${n} 🤖</button>`).join('')}
    </div>`}
    <button class="btn secondary block" id="mClose" style="margin-top:16px">ביטול</button>`);
  $('#mClose').onclick = closeModal;
  $('#mFriends').onclick = () => { closeModal(); createGame(g.id, 0); };
  document.querySelectorAll('[data-bots]').forEach(b => b.onclick = () => { closeModal(); createGame(g.id, +b.dataset.bots); });
  document.querySelectorAll('[data-level]').forEach(b => b.onclick = () => { closeModal(); createGame(g.id, 1, b.dataset.level); });
}

const BOT_NAMES = ['רובי', 'ביפ', 'צ׳יפ', 'בוטי', 'מקס', 'נובה', 'זיגי'];
function botEntry(i) { return [`bot_${Date.now().toString(36)}_${i}`, { nick: `🤖 ${BOT_NAMES[i % BOT_NAMES.length]}`, bot: true, at: Date.now() + i + 1 }]; }

async function createGame(type, bots, level) {
  const gref = push(ref(db, 'games'));
  const players = { [me.uid]: { nick: me.nick, at: Date.now() } };
  for (let i = 0; i < bots; i++) { const [id, v] = botEntry(i); if (level) { v.level = level; v.nick = `🤖 בוט ${Ck.LEVELS[level]}`; } players[id] = v; }
  const g = { type, host: me.uid, status: 'lobby', players, createdAt: Date.now() };
  if (type === 'imposter') g.settings = Imp.DEFAULT_SETTINGS;
  if (type === 'checkers') g.settings = { rules: 'il' };
  if (bots) { g.status = 'playing'; g.state = type === 'checkers' ? startCheckersState(players, 'il') : type === 'backgammon' ? startBgState(players) : Taki.newGame(orderOf(players)); }
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
    if (g.status === 'lobby') renderLobby(g);
    else if (g.type === 'imposter') renderImposter(g);
    else if (g.type === 'checkers') { renderCheckers(g); checkersTick(g); }
    else if (g.type === 'backgammon') { renderBackgammon(g); bgTick(g); }
    else { renderTaki(g); hostTick(g); }
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
      ${isHost && info.bots !== false && !info.botLevels && !info.oneBot ? `<button class="btn secondary block" id="addBot" style="margin-top:10px">➕ הוסף בוט</button>` : ''}
    </div>
    ${g.type === 'imposter' ? imposterSettingsHtml(g, isHost) : ''}
    ${g.type === 'checkers' ? checkersSettingsHtml(g, isHost) : ''}
    ${isHost ? `<div class="card"><div class="muted">הזמן חברים</div>
      ${friendIds.length ? friendIds.map(f => `<div class="list-item">
        <span class="dot ${presence[f] ? 'on' : ''}"></span><div class="grow">${esc(friends[f])}</div>
        <button class="btn small" data-inv="${f}">הזמן</button></div>`).join('')
      : '<p class="muted">עוד אין לך חברים ברשימה. אפשר להוסיף בתפריט ← חברים.</p>'}
    </div>` : '<p class="muted center-msg" style="min-height:0">ממתינים שהמארח יתחיל את המשחק…</p>'}
    ${isHost ? `<button class="btn block" id="startBtn" ${players.length < info.min ? 'disabled' : ''}>🚀 ${g.state ? 'המשך' : 'התחל משחק'}</button>
      ${players.length < info.min ? `<p class="muted" style="text-align:center">צריך לפחות ${info.min} שחקנים</p>` : ''}` : ''}
    <button class="btn danger block" id="leaveBtn" style="margin-top:10px">${isHost ? 'סגור חדר' : 'צא מהחדר'}</button>`;
  view.querySelectorAll('[data-inv]').forEach(b => b.onclick = async () => {
    await set(ref(db, `invites/${b.dataset.inv}/${curGid}`), { from: me.nick, game: g.type, at: Date.now() });
    b.disabled = true; b.textContent = 'נשלח ✓';
  });
  view.querySelectorAll('[data-kick]').forEach(b => b.onclick = () => remove(ref(db, `games/${curGid}/players/${b.dataset.kick}`)));
  if (isHost) {
    if (g.type === 'imposter') bindImposterSettings(g);
    if (g.type === 'checkers') bindCheckersSettings();
    if ($('#addBot')) $('#addBot').onclick = () => {
      if (players.length >= info.max) return toast('החדר מלא');
      const [id, v] = botEntry(players.filter(p => g.players[p].bot).length);
      v.at = Date.now();
      set(ref(db, `games/${curGid}/players/${id}`), v);
    };
    $('#startBtn').onclick = () => g.type === 'imposter' ? startImposter(g, g.state?.round || 0)
      : g.type === 'checkers' ? startCheckers(g)
      : g.type === 'backgammon' ? startBg(g)
      : update(ref(db, `games/${curGid}`), { status: 'playing', state: Taki.newGame(orderOf(g.players)) });
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

// ---------- The Imposter UI (around the table) ----------
const impSettings = g => ({ ...Imp.DEFAULT_SETTINGS, ...(g.settings || {}) });

function imposterSettingsHtml(g, isHost) {
  const st = impSettings(g), n = Object.keys(g.players).length, maxK = Imp.maxImposters(Math.max(n, 3));
  const cats = Object.entries(Imp.CATEGORIES);
  if (!isHost) {
    return `<div class="card"><div class="muted">הגדרות</div>
      <p>${cats.filter(([k]) => st.cats[k]).map(([, c]) => `${c.ico} ${c.name}`).join(' · ') || 'כל הקטגוריות'}</p>
      <p class="muted">${st.impCount} מתחזים · ${st.showCat ? 'המתחזה רואה את הקטגוריה' : 'המתחזה לא רואה כלום'}</p></div>`;
  }
  return `<div class="card"><div class="muted" style="margin-bottom:8px">קטגוריות</div>
    <div class="chips">${cats.map(([k, c]) => `<button class="chip ${st.cats[k] ? 'on' : ''}" data-cat="${k}">${c.ico} ${c.name}</button>`).join('')}</div>
    <div class="stat-row"><span>מספר מתחזים</span><span class="row">${[1, 2, 3].map(k =>
      `<button class="btn small ${st.impCount === k ? '' : 'secondary'}" data-imp="${k}" ${k > maxK ? 'disabled' : ''}>${k}</button>`).join('')}</span></div>
    <label class="stat-row"><span>המתחזה רואה את הקטגוריה</span><input type="checkbox" id="showCat" ${st.showCat ? 'checked' : ''}></label>
    ${maxK < 3 ? `<div class="muted" style="font-size:13px">יותר מתחזים אפשר רק עם יותר שחקנים (${maxK < 2 ? '2 מתחזים מ-5 שחקנים, ' : ''}3 מתחזים מ-7)</div>` : ''}
  </div>`;
}
function bindImposterSettings(g) {
  const st = impSettings(g), sref = ref(db, `games/${curGid}/settings`);
  view.querySelectorAll('[data-cat]').forEach(b => b.onclick = () => {
    const cats = { ...st.cats, [b.dataset.cat]: !st.cats[b.dataset.cat] };
    if (!Object.values(cats).some(Boolean)) return toast('צריך לפחות קטגוריה אחת');
    update(sref, { ...st, cats });
  });
  view.querySelectorAll('[data-imp]').forEach(b => b.onclick = () => update(sref, { ...st, impCount: +b.dataset.imp }));
  const sc = $('#showCat'); if (sc) sc.onchange = () => update(sref, { ...st, showCat: sc.checked });
}
const startImposter = (g, prevRound = 0) =>
  update(ref(db, `games/${curGid}`), { status: 'playing', state: Imp.newRound(orderOf(g.players), impSettings(g), prevRound) });

let impRevealed = false, impRoundSeen = 0;
function renderImposter(g) {
  view.classList.remove('game-mode');
  const s = g.state, isHost = g.host === me.uid;
  const order = orderOf(g.players);
  const names = p => g.players[p]?.nick || 'שחקן שיצא';
  const imps = Object.keys(s.imposters || {});
  const amImp = !!s.imposters?.[me.uid];
  const cat = Imp.CATEGORIES[s.cat];
  if (impRoundSeen !== s.round) { impRevealed = false; impRoundSeen = s.round; }
  const votes = s.votes || {};
  const top = `<div class="row" style="margin-bottom:10px"><button class="btn small secondary" id="exitBtn">✕ יציאה</button>
    <div class="grow muted" style="text-align:center">🕵️ המתחזה · סיבוב ${s.round}</div>
    ${isHost ? '<button class="btn small secondary" id="setBtn">⚙️</button>' : '<span style="width:40px"></span>'}</div>`;

  let body = '';
  if (s.phase === 'play') {
    const i = order.indexOf(s.first);
    const seq = order.map((_, k) => order[((i + s.dir * k) % order.length + order.length) % order.length]);
    body = `
      <button class="secret ${impRevealed ? (amImp ? 'imp' : 'open') : ''}" id="secret">
        ${!impRevealed ? '<div class="big-ico">🤫</div><b>לחץ כדי לראות</b><span>בלי שאף אחד יציץ!</span>'
          : amImp ? `<div class="big-ico">🕵️</div><b>אתה המתחזה!</b>${s.showCat ? `<span>הקטגוריה: ${cat.ico} ${cat.name}</span>` : '<span>אין לך שום רמז. תקשיב טוב…</span>'}${imps.length > 1 ? `<span>יש ${imps.length} מתחזים</span>` : ''}<small>לחץ להסתיר</small>`
          : `<span>${cat.ico} ${cat.name}</span><div class="word">${esc(s.word)}</div><small>לחץ להסתיר</small>`}
      </button>
      <div class="card">
        <b>איך משחקים</b>
        <p class="muted" style="margin:6px 0">עוברים בסבב, וכל אחד אומר <b>מילה אחת</b> שקשורה למילה הסודית. לא ברור מדי, כדי שהמתחזה לא יבין, ולא מעורפל מדי, כדי שלא יחשדו בך.</p>
        <div class="muted">סדר הדיבור:</div>
        <div class="seq">${seq.map((p, k) => `<span class="pill ${p === me.uid ? 'me' : ''}">${k + 1}. ${esc(names(p))}</span>`).join('')}</div>
      </div>
      ${isHost ? `<button class="btn block" id="toVote">🗳️ להצבעה</button>
        <button class="btn secondary block" id="reveal" style="margin-top:8px">👀 חשוף בלי הצבעה</button>`
        : '<p class="muted" style="text-align:center">כשמסיימים לדבר, המארח יפתח הצבעה</p>'}`;
  } else if (s.phase === 'vote') {
    const n = Object.keys(votes).length;
    body = `
      <h1>🗳️ מי המתחזה?</h1>
      <p class="muted">${imps.length > 1 ? `יש ${imps.length} מתחזים. ` : ''}לחץ על מי שאתה חושד בו. אפשר לשנות עד שההצבעה נסגרת.</p>
      <div class="card">${order.filter(p => p !== me.uid).map(p => `
        <button class="vote-row ${votes[me.uid] === p ? 'on' : ''}" data-vote="${p}">
          <div class="avatar">${esc(names(p)[0])}</div><div class="grow">${esc(names(p))}</div>
          ${votes[p] ? '<span class="pill">הצביע ✓</span>' : ''}</button>`).join('')}</div>
      <p class="muted" style="text-align:center">${n} מתוך ${order.length} הצביעו</p>
      ${isHost ? '<button class="btn block" id="endVote">סגור הצבעה</button>' : ''}`;
  } else {
    const r = s.result || {}, t = Imp.tally(votes);
    const final = r.winner;
    body = `
      <div class="card result">
        ${r.voted ? (t.top ? `<div class="muted">הכי הרבה קולות קיבל</div><h2 style="margin:4px 0 0;color:var(--text)">${esc(names(t.top))}</h2>
          <div class="muted">${t.counts[t.top]} קולות</div>` : '<h2 style="color:var(--text)">תיקו בהצבעה!</h2>') : ''}
        <div class="reveal-imps">${imps.map(p => `<div><div class="big-ico">🕵️</div><b>${esc(names(p))}</b></div>`).join('')}</div>
        <div class="muted">${imps.length > 1 ? 'היו המתחזים' : 'היה המתחזה'}</div>
        <div style="margin-top:12px">המילה: <b style="font-size:22px">${esc(s.word)}</b> <span class="muted">(${cat.name})</span></div>
      </div>
      ${final ? `<div class="card win ${final}"><div class="big-ico">${final === 'group' ? '🎉' : '😈'}</div>
          <h2 style="color:inherit;margin:0">${final === 'group' ? 'הקבוצה ניצחה!' : (imps.length > 1 ? 'המתחזים ניצחו!' : 'המתחזה ניצח!')}</h2></div>
        ${isHost ? '<button class="btn block" id="nextRound">🔁 סיבוב חדש</button>' : '<p class="muted" style="text-align:center">המארח יתחיל סיבוב חדש</p>'}`
      : r.caught ? `<div class="card"><b>המתחזה נתפס!</b> <span class="muted">יש לו הזדמנות אחרונה: לנחש בקול את המילה.</span>
          ${isHost ? `<div class="row" style="margin-top:10px"><button class="btn ok grow" id="guessNo">טעה ❌</button><button class="btn danger grow" id="guessYes">ניחש נכון ✅</button></div>` : '<p class="muted">המארח יסמן אם הניחוש נכון</p>'}</div>`
      : ''}`;
  }
  view.innerHTML = top + body;

  $('#exitBtn').onclick = () => {
    modal(`<h3>לצאת מהמשחק?</h3><p class="muted">${isHost ? 'אתה המארח – יציאה תסגור את המשחק לכולם.' : ''}</p>
      <button class="btn danger block" id="xLeave">${isHost ? 'סגור משחק' : 'עזוב'}</button><button class="btn secondary block" id="xNo">ביטול</button>`);
    $('#xNo').onclick = closeModal; $('#xLeave').onclick = () => { closeModal(); leaveGame(); };
  };
  if ($('#setBtn')) $('#setBtn').onclick = () => update(ref(db, `games/${curGid}`), { status: 'lobby' });
  if ($('#secret')) $('#secret').onclick = () => { impRevealed = !impRevealed; renderImposter(curGame); };
  const st = ref(db, `games/${curGid}/state`);
  if ($('#toVote')) $('#toVote').onclick = () => update(st, { phase: 'vote', votes: null });
  if ($('#reveal')) $('#reveal').onclick = () => update(st, { phase: 'result', result: { voted: false, caught: true } });
  view.querySelectorAll('[data-vote]').forEach(b => b.onclick = () => set(ref(db, `games/${curGid}/state/votes/${me.uid}`), b.dataset.vote));
  if ($('#endVote')) $('#endVote').onclick = () => closeVote(g);
  if ($('#guessNo')) $('#guessNo').onclick = () => decideImposter(g, 'group');
  if ($('#guessYes')) $('#guessYes').onclick = () => decideImposter(g, 'imp');
  if ($('#nextRound')) $('#nextRound').onclick = () => startImposter(g, s.round);
  // host closes the vote automatically once everyone voted
  if (isHost && s.phase === 'vote' && order.every(p => votes[p])) closeVote(g);
}

async function closeVote(g) {
  const s = g.state, t = Imp.tally(s.votes);
  const caught = !!(t.top && s.imposters?.[t.top]);
  const r = await runTransaction(ref(db, `games/${curGid}/state/phase`), ph => ph === 'vote' ? 'result' : undefined);
  if (!r.committed) return;
  await update(ref(db, `games/${curGid}/state`), { result: { voted: true, caught } });
  if (!caught) decideImposter(g, 'imp');
}

async function decideImposter(g, winner) {
  const r = await runTransaction(ref(db, `games/${curGid}/state/result/winner`), w => w ? undefined : winner);
  if (!r.committed) return;
  const s = g.state, u = {};
  for (const p of orderOf(g.players)) {
    u[`users/${p}/stats/imposter/played`] = increment(1);
    if ((winner === 'imp') === !!s.imposters?.[p]) u[`users/${p}/stats/imposter/won`] = increment(1);
  }
  await update(ref(db), u);
}

// ---------- Checkers UI ----------
function startCheckersState(players, rules) {
  const ids = orderOf(players).slice(0, 2);
  if (Math.random() < 0.5) ids.reverse();
  return { ...Ck.newGame(rules || 'il'), colors: { w: ids[0], b: ids[1] } };
}
const startCheckers = (g, swap) => {
  let st = startCheckersState(g.players, g.settings?.rules);
  if (swap && g.state?.colors) st.colors = { w: g.state.colors.b, b: g.state.colors.w };
  return update(ref(db, `games/${curGid}`), { status: 'playing', state: st });
};

function checkersSettingsHtml(g, isHost) {
  const r = g.settings?.rules || 'il';
  if (!isHost) return `<div class="card"><div class="muted">חוקים</div><p><b>${Ck.RULES[r]}</b><br><span class="muted">${Ck.RULES_INFO[r]}</span></p></div>`;
  return `<div class="card"><div class="muted" style="margin-bottom:8px">חוקים</div>
    <div class="chips">${Object.entries(Ck.RULES).map(([k, n]) => `<button class="chip ${r === k ? 'on' : ''}" data-rules="${k}">${n}</button>`).join('')}</div>
    <div class="muted" style="font-size:14px">${Ck.RULES_INFO[r]}</div></div>`;
}
function bindCheckersSettings() {
  view.querySelectorAll('[data-rules]').forEach(b => b.onclick = () => update(ref(db, `games/${curGid}/settings`), { rules: b.dataset.rules }));
}

let ckSel = [], ckKey = '';
function renderCheckers(g) {
  view.classList.add('game-mode');
  const s = g.state, isHost = g.host === me.uid;
  const names = p => g.players[p]?.nick || 'שחקן שיצא';
  const myColor = s.colors.w === me.uid ? 'w' : s.colors.b === me.uid ? 'b' : '';
  const oppColor = myColor === 'b' ? 'w' : 'b';
  const myTurn = !s.winner && s.turn === myColor;
  if (ckKey !== s.board + s.turn) { ckSel = []; ckKey = s.board + s.turn; }
  const moves = myTurn ? Ck.legalMoves(s) : [];
  const fits = moves.filter(m => ckSel.every((x, i) => m.path[i] === x));
  const starts = new Set(moves.map(m => m.path[0]));
  const targets = new Set(ckSel.length ? fits.filter(m => m.path.length > ckSel.length).map(m => m.path[ckSel.length]) : []);
  const last = s.last ? s.last.split(',').map(Number) : [];
  const flip = myColor === 'b';
  const mustCap = moves.length && moves[0].taken.length;
  // mid-jump: show the piece on its current square and fade the pieces already jumped
  let board = s.board, fading = [];
  if (ckSel.length > 1 && fits.length) {
    const b = board.split(''); const pc = b[ckSel[0]]; b[ckSel[0]] = '.'; b[ckSel[ckSel.length - 1]] = pc;
    board = b.join(''); fading = fits[0].taken.slice(0, ckSel.length - 1);
  }

  let cells = '';
  for (let k = 0; k < 64; k++) {
    const i = flip ? 63 - k : k, r = i >> 3, c = i & 7, dark = (r + c) % 2 === 1;
    const p = board[i];
    const cls = ['sq', dark ? 'dark' : 'light', fading.includes(i) ? 'fade' : '',
      last.includes(i) ? 'last' : '', ckSel.includes(i) ? 'sel' : '',
      !ckSel.length && starts.has(i) ? 'can' : '', targets.has(i) ? 'target' : ''].join(' ');
    const piece = p === '.' ? '' : `<div class="pc ${p.toLowerCase() === 'w' ? 'pw' : 'pb'} ${p === 'W' || p === 'B' ? 'king' : ''}">${p === 'W' || p === 'B' ? '♛' : ''}</div>`;
    cells += `<div class="${cls}" data-sq="${i}">${piece}</div>`;
  }
  const lost = t => 12 - Ck.count(s.board, t);
  const who = t => `<div class="ck-player ${s.turn === t && !s.winner ? 'turn' : ''}">
      <div class="pc mini ${t === 'w' ? 'pw' : 'pb'}"></div><b>${esc(names(s.colors[t]))}</b>
      <span class="muted">אכל ${lost(t === 'w' ? 'b' : 'w')}</span></div>`;
  let status;
  if (s.winner === 'draw') status = '🤝 תיקו';
  else if (s.winner) status = s.winner === myColor ? '🏆 ניצחת!' : `🏆 ${esc(names(s.colors[s.winner]))} ניצח`;
  else if (myTurn) status = mustCap ? '<b>התור שלך</b> · חובה לאכול!' : '<b>התור שלך</b>';
  else status = `התור של ${esc(names(s.colors[s.turn]))}…`;

  view.innerHTML = `
    <div class="table ck">
      <div class="game-top"><button class="btn small" id="exitBtn">✕ יציאה</button>
        <div class="grow dir">${Ck.RULES[s.rules]}</div>
        ${!s.winner && myColor ? '<button class="btn small" id="resignBtn">🏳️ פרישה</button>' : ''}</div>
      ${who(oppColor)}
      <div class="board-wrap"><div class="board">${cells}</div></div>
      ${who(myColor || 'w')}
      <div class="status" style="margin:6px auto 12px">${status}</div>
    </div>`;

  view.querySelectorAll('[data-sq]').forEach(el => el.onclick = () => {
    if (!myTurn) return;
    const i = +el.dataset.sq;
    if (targets.has(i)) {
      ckSel = [...ckSel, i];
      const done = moves.find(m => Ck.samePath(m.path, ckSel));
      const longer = moves.some(m => m.path.length > ckSel.length && ckSel.every((x, j) => m.path[j] === x));
      if (done && !longer) { const path = ckSel; ckSel = []; ckAct(path); return; }
    } else if (starts.has(i)) {
      ckSel = ckSel[0] === i ? [] : [i];
      const only = moves.filter(m => m.path[0] === i);
      if (!only.length) ckSel = [];
    } else if (mustCap && owner2(s.board[i]) === myColor) { toast('חובה לאכול!'); return; }
    else ckSel = [];
    renderCheckers(curGame);
  });
  $('#exitBtn').onclick = () => {
    modal(`<h3>לצאת מהמשחק?</h3><p class="muted">${isHost ? 'אתה המארח – יציאה תסגור את המשחק.' : 'תוכל לחזור מהמסך הראשי.'}</p>
      ${isHost ? '' : '<button class="btn block" id="xHome">למסך הראשי (המשחק ממשיך)</button>'}
      <button class="btn danger block" id="xLeave">${isHost ? 'סגור משחק' : 'עזוב'}</button><button class="btn secondary block" id="xNo">ביטול</button>`);
    $('#xNo').onclick = closeModal; $('#xLeave').onclick = () => { closeModal(); leaveGame(); };
    if ($('#xHome')) $('#xHome').onclick = () => { closeModal(); go('home'); };
  };
  if ($('#resignBtn')) $('#resignBtn').onclick = () => {
    modal(`<h3>לפרוש מהמשחק?</h3><p class="muted">היריב ינצח.</p>
      <button class="btn danger block" id="rY">פרוש</button><button class="btn secondary block" id="rN">ביטול</button>`);
    $('#rN').onclick = closeModal;
    $('#rY').onclick = () => { closeModal(); update(ref(db, `games/${curGid}/state`), { winner: oppColor }); };
  };
  if (s.winner && !$('#modal').dataset.winShown) {
    $('#modal').dataset.winShown = '1';
    modal(`<div style="font-size:60px">${s.winner === 'draw' ? '🤝' : s.winner === myColor ? '🏆' : '😅'}</div>
      <h3>${status}</h3>
      ${isHost ? '<button class="btn block" id="again">🔁 משחק חוזר (מחליפים צבעים)</button>' : '<p class="muted">המארח יכול להתחיל משחק חוזר</p>'}
      <button class="btn secondary block" id="wHome">למסך הראשי</button>`);
    if (isHost) $('#again').onclick = () => { closeModal(); startCheckers(g, true); };
    $('#wHome').onclick = () => { closeModal(); isHost ? leaveGame() : go('home'); };
  }
  if (!s.winner) delete $('#modal').dataset.winShown;
}
const owner2 = p => (p === 'w' || p === 'W') ? 'w' : (p === 'b' || p === 'B') ? 'b' : '';

async function ckAct(path) {
  try {
    const r = await runTransaction(ref(db, `games/${curGid}/state`), st => {
      if (!st) return st;
      if (Ck.play(st, path)) return;
      return st;
    });
    if (!r.committed) toast('המהלך לא התקבל');
  } catch { toast('שגיאת חיבור'); }
}

let ckBotBusy = false;
function checkersTick(g) {
  if (!g || g.host !== me.uid || g.status !== 'playing' || !g.state) return;
  const s = g.state;
  if (s.winner) { finishTwoPlayer(g, s.winner === 'draw' ? '' : s.colors[s.winner], Object.values(s.colors)); return; }
  const cur = s.colors[s.turn];
  if (!g.players[cur]?.bot || ckBotBusy) return;
  ckBotBusy = true;
  const gid = curGid, before = s.board + s.turn;
  setTimeout(async () => {
    try {
      if (curGid !== gid) return;
      const m = Ck.botMove({ ...s }, g.players[cur].level || 'medium');
      if (m) await runTransaction(ref(db, `games/${gid}/state`), st => {
        if (!st || st.board + st.turn !== before) return;
        if (Ck.play(st, m.path)) return;
        return st;
      });
    } catch {}
    finally { ckBotBusy = false; if (curGid === gid && curGame) checkersTick(curGame); }
  }, 500);
}

async function finishTwoPlayer(g, winnerUid, uids) {
  const r = await runTransaction(ref(db, `games/${curGid}/status`), st => st === 'playing' ? 'done' : undefined);
  if (!r.committed) return;
  const u = {};
  for (const p of uids) {
    if (!g.players[p] || g.players[p].bot) continue;
    u[`users/${p}/stats/${g.type}/played`] = increment(1);
    if (p === winnerUid) u[`users/${p}/stats/${g.type}/won`] = increment(1);
  }
  if (Object.keys(u).length) await update(ref(db), u);
}

// ---------- Backgammon UI ----------
function startBgState(players) {
  const ids = orderOf(players).slice(0, 2);
  if (Math.random() < 0.5) ids.reverse();
  return { ...Bg.newGame(), colors: { w: ids[0], b: ids[1] } };
}
const startBg = (g, swap) => {
  const st = startBgState(g.players);
  if (swap && g.state?.colors) st.colors = { w: g.state.colors.b, b: g.state.colors.w };
  return update(ref(db, `games/${curGid}`), { status: 'playing', state: st });
};

let bgPending = [], bgSrc = null, bgKey = '', bgSeqCache = { key: '', seqs: [] };
const DIE = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
function dieHtml(n, used) {
  const spots = { 1: [5], 2: [1, 9], 3: [1, 5, 9], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] }[n] || [];
  return `<div class="die ${used ? 'used' : ''}">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(k => `<i class="${spots.includes(k) ? 'on' : ''}"></i>`).join('')}</div>`;
}

function renderBackgammon(g) {
  view.classList.add('game-mode');
  const s0 = Bg.norm(structuredClone(g.state)), isHost = g.host === me.uid;
  const names = p => g.players[p]?.nick || 'שחקן שיצא';
  const myColor = s0.colors.w === me.uid ? 'w' : s0.colors.b === me.uid ? 'b' : '';
  const V = myColor || 'w', O = V === 'w' ? 'b' : 'w';
  const myTurn = !s0.winner && s0.turn === myColor;
  const key = JSON.stringify([s0.pts, s0.bar, s0.dice, s0.turn]);
  if (bgKey !== key) { bgPending = []; bgSrc = null; bgKey = key; }
  let seqs = [];
  if (myTurn && s0.dice.length) {
    if (bgSeqCache.key !== key) bgSeqCache = { key, seqs: Bg.sequences(s0) };
    seqs = bgSeqCache.seqs;
  }
  const noMoves = myTurn && s0.dice.length && (!seqs.length || !seqs[0].length);
  // working position = server state + my pending steps
  const s = Bg.norm(structuredClone(g.state));
  for (const st of bgPending) Bg.applyStep(s, { ...st });
  const fits = seqs.filter(q => bgPending.every((x, i) => q[i] && Bg.sameStep(x, q[i])));
  const nextSteps = []; for (const q of fits) { const n = q[bgPending.length]; if (n && !nextSteps.some(x => Bg.sameStep(x, n))) nextSteps.push(n); }
  const sources = new Set(nextSteps.map(x => String(x.from)));
  const targets = bgSrc != null ? nextSteps.filter(x => String(x.from) === String(bgSrc)) : [];
  const targetSet = new Set(targets.map(x => String(x.to)));
  const lastTo = new Set((s0.last || '').split(',').filter(Boolean).map(x => x.split('>')[1]));

  const checkers = (n, color, top) => {
    const k = Math.min(n, 5);
    return `<div class="stack ${top ? 'top' : 'bot'}">${Array.from({ length: k }, (_, j) =>
      `<span class="ch ${color}">${j === k - 1 && n > 5 ? n : ''}</span>`).join('')}</div>`;
  };
  const pointCell = (i, top) => {
    const v = s.pts[i], n = Math.abs(v), color = v > 0 ? 'w' : 'b';
    const cls = ['pt', top ? 'top' : 'bot', (i % 2) ? 'odd' : 'even',
      sources.has(String(i)) && bgSrc == null ? 'can' : '', String(bgSrc) === String(i) ? 'sel' : '',
      targetSet.has(String(i)) ? 'target' : '', lastTo.has(String(i)) ? 'last' : ''].join(' ');
    return `<div class="${cls}" data-pt="${i}"><div class="tri"></div>${n ? checkers(n, color, top) : ''}</div>`;
  };
  const barCell = (color, top) => `<div class="barcell ${top ? 'top' : 'bot'} ${color === V && sources.has('bar') && bgSrc == null ? 'can' : ''} ${color === V && bgSrc === 'bar' ? 'sel' : ''}" ${color === V ? 'data-pt="bar"' : ''}>
      ${s.bar[color] ? checkers(s.bar[color], color, top) : ''}</div>`;
  const topIdx = V === 'w' ? [12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23] : [11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0];
  const botIdx = V === 'w' ? [11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0] : [12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];
  const row = (idx, top) => idx.slice(0, 6).map(i => pointCell(i, top)).join('') + barCell(top ? O : V, top) + idx.slice(6).map(i => pointCell(i, top)).join('');

  const usedCount = bgPending.length;
  const diceShown = s0.rolled ? (s0.rolled[0] === s0.rolled[1] ? [s0.rolled[0], s0.rolled[0], s0.rolled[0], s0.rolled[0]] : [...s0.rolled]) : [];
  const remaining = [...s.dice];
  const diceHtml = diceShown.map(d => { const k = remaining.indexOf(d); if (k >= 0) { remaining.splice(k, 1); return dieHtml(d, false); } return dieHtml(d, true); }).join('');

  let status, action = '';
  if (s0.winner) status = s0.winner === myColor ? `🏆 ניצחת!${s0.mars ? ' מרס!' : ''}` : `🏆 ${esc(names(s0.colors[s0.winner]))} ניצח${s0.mars ? ' (מרס)' : ''}`;
  else if (myTurn && !s0.dice.length) { status = '<b>התור שלך</b>'; action = '<button class="btn" id="rollBtn">🎲 הטל קוביות</button>'; }
  else if (noMoves) { status = 'אין לך מהלכים חוקיים'; action = '<button class="btn" id="passBtn">העבר תור</button>'; }
  else if (myTurn) { status = bgSrc == null ? 'בחר כלי להזיז' : 'בחר לאן'; if (bgPending.length) action = '<button class="btn small secondary" id="undoBtn">↩️ בטל</button>'; }
  else status = `התור של ${esc(names(s0.colors[s0.turn]))}…`;

  const tray = color => `<div class="tray ${color === V && targetSet.has('off') ? 'target' : ''}" ${color === V ? 'data-pt="off"' : ''}>
      <div class="ch ${color}"></div><b>${s.off[color]}</b></div>`;
  view.innerHTML = `
    <div class="table bg">
      <div class="game-top"><button class="btn small" id="exitBtn">✕ יציאה</button>
        <div class="grow dir">פיפס: אתה ${Bg.pips(s, V)} · יריב ${Bg.pips(s, O)}</div>
        ${!s0.winner && myColor ? '<button class="btn small" id="resignBtn">🏳️</button>' : ''}</div>
      <div class="ck-player ${s0.turn === O && !s0.winner ? 'turn' : ''}"><span class="ch ${O}"></span><b>${esc(names(s0.colors[O]))}</b></div>
      <div class="bg-wrap">
        <div class="bg-board">
          <div class="bg-row">${row(topIdx, true)}</div>
          <div class="bg-mid"><div class="dice">${diceHtml}</div></div>
          <div class="bg-row">${row(botIdx, false)}</div>
        </div>
        <div class="trays">${tray(O)}<div class="grow"></div>${tray(V)}</div>
      </div>
      <div class="ck-player ${s0.turn === V && !s0.winner ? 'turn' : ''}"><span class="ch ${V}"></span><b>${esc(names(s0.colors[V]))}</b></div>
      <div class="bg-actions"><div class="status">${status}</div>${action}</div>
    </div>`;

  view.querySelectorAll('[data-pt]').forEach(el => el.onclick = () => {
    if (!myTurn || !s0.dice.length) return;
    const id = el.dataset.pt;
    if (bgSrc != null && targetSet.has(id)) {
      const step = targets.filter(x => String(x.to) === id).sort((a, b) => a.die - b.die)[0];
      bgPending = [...bgPending, step]; bgSrc = null;
      const rest = seqs.filter(q => bgPending.every((x, i) => q[i] && Bg.sameStep(x, q[i])));
      if (rest.length && rest.every(q => q.length === bgPending.length)) { const steps = bgPending; bgSubmit(steps); return; }
      // auto-select if only one checker can move next
      const nx = new Set(); for (const q of rest) if (q[bgPending.length]) nx.add(String(q[bgPending.length].from));
      if (nx.size === 1) bgSrc = [...nx][0] === 'bar' ? 'bar' : +[...nx][0];
    } else if (sources.has(id)) bgSrc = bgSrc != null && String(bgSrc) === id ? null : (id === 'bar' ? 'bar' : +id);
    else bgSrc = null;
    renderBackgammon(curGame);
  });
  if ($('#rollBtn')) $('#rollBtn').onclick = () => runTransaction(ref(db, `games/${curGid}/state`), st => {
    if (!st) return st; st = Bg.norm(st);
    if (st.turn !== myColor || st.dice.length || st.winner) return;
    return Bg.roll(st);
  });
  if ($('#passBtn')) $('#passBtn').onclick = () => runTransaction(ref(db, `games/${curGid}/state`), st => {
    if (!st) return st; st = Bg.norm(st);
    if (st.turn !== myColor) return;
    const q = Bg.sequences(st); if (q.length && q[0].length) return;
    Bg.endTurn(st); st.last = ''; return st;
  });
  if ($('#undoBtn')) $('#undoBtn').onclick = () => { bgPending = []; bgSrc = null; renderBackgammon(curGame); };
  // auto-select when there is only one checker that can move
  if (myTurn && bgSrc == null && sources.size === 1 && !bgPending.length) { const only = [...sources][0]; bgSrc = only === 'bar' ? 'bar' : +only; renderBackgammon(curGame); return; }

  $('#exitBtn').onclick = () => {
    modal(`<h3>לצאת מהמשחק?</h3><p class="muted">${isHost ? 'אתה המארח – יציאה תסגור את המשחק.' : 'תוכל לחזור מהמסך הראשי.'}</p>
      ${isHost ? '' : '<button class="btn block" id="xHome">למסך הראשי (המשחק ממשיך)</button>'}
      <button class="btn danger block" id="xLeave">${isHost ? 'סגור משחק' : 'עזוב'}</button><button class="btn secondary block" id="xNo">ביטול</button>`);
    $('#xNo').onclick = closeModal; $('#xLeave').onclick = () => { closeModal(); leaveGame(); };
    if ($('#xHome')) $('#xHome').onclick = () => { closeModal(); go('home'); };
  };
  if ($('#resignBtn')) $('#resignBtn').onclick = () => {
    modal(`<h3>לפרוש מהמשחק?</h3><p class="muted">היריב ינצח.</p>
      <button class="btn danger block" id="rY">פרוש</button><button class="btn secondary block" id="rN">ביטול</button>`);
    $('#rN').onclick = closeModal;
    $('#rY').onclick = () => { closeModal(); update(ref(db, `games/${curGid}/state`), { winner: O }); };
  };
  if (s0.winner && !$('#modal').dataset.winShown) {
    $('#modal').dataset.winShown = '1';
    modal(`<div style="font-size:60px">${s0.winner === myColor ? '🏆' : '😅'}</div><h3>${status}</h3>
      ${isHost ? '<button class="btn block" id="again">🔁 משחק חוזר (מחליפים צבעים)</button>' : '<p class="muted">המארח יכול להתחיל משחק חוזר</p>'}
      <button class="btn secondary block" id="wHome">למסך הראשי</button>`);
    if (isHost) $('#again').onclick = () => { closeModal(); startBg(g, true); };
    $('#wHome').onclick = () => { closeModal(); isHost ? leaveGame() : go('home'); };
  }
  if (!s0.winner) delete $('#modal').dataset.winShown;
}

async function bgSubmit(steps) {
  try {
    const r = await runTransaction(ref(db, `games/${curGid}/state`), st => {
      if (!st) return st; st = Bg.norm(st);
      if (Bg.play(st, steps)) return;
      return st;
    });
    if (!r.committed) { toast('המהלך לא התקבל'); bgPending = []; renderBackgammon(curGame); }
  } catch { toast('שגיאת חיבור'); }
}

let bgBotBusy = false;
function bgTick(g) {
  if (!g || g.host !== me.uid || g.status !== 'playing' || !g.state) return;
  const s = Bg.norm(structuredClone(g.state));
  if (s.winner) { finishTwoPlayer(g, s.colors[s.winner], Object.values(s.colors)); return; }
  const cur = s.colors[s.turn];
  if (!g.players[cur]?.bot || bgBotBusy) return;
  bgBotBusy = true;
  const gid = curGid, before = JSON.stringify([s.pts, s.bar, s.dice, s.turn]);
  setTimeout(async () => {
    try {
      if (curGid !== gid) return;
      await runTransaction(ref(db, `games/${gid}/state`), st => {
        if (!st) return st; st = Bg.norm(st);
        if (JSON.stringify([st.pts, st.bar, st.dice, st.turn]) !== before) return;
        if (!st.dice.length) return Bg.roll(st);
        const steps = Bg.botSteps(st);
        if (!steps.length) { Bg.endTurn(st); st.last = ''; return st; }
        if (Bg.play(st, steps)) return;
        return st;
      });
    } catch {}
    finally { bgBotBusy = false; if (curGid === gid && curGame) bgTick(curGame); }
  }, s.dice.length ? 1300 : 700);
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
  $('#fNick').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); send(); } };
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
