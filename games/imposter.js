// BoredGames – The Imposter (המתחזה), around-the-table mode
// Everyone sees the secret word on their phone except the imposter(s).
// Clues and arguing happen out loud; the app handles roles, voting and results.

export const CATEGORIES = {
  food: { name: 'אוכל', ico: '🍕', words: ['פיצה', 'פלאפל', 'שקשוקה', 'סושי', 'המבורגר', 'חומוס', 'שווארמה', 'פסטה', 'גלידה', 'עוגת שוקולד', 'במבה', 'ביסלי', 'שניצל', 'מלוואח', 'ג׳חנון', 'בורקס', 'סלט ירקות', 'פופקורן', 'מרק עוף', 'צ׳יפס', 'טוסט', 'קרואסון', 'סביח', 'מקלובה'] },
  animals: { name: 'חיות', ico: '🦁', words: ['אריה', 'פיל', 'ג׳ירפה', 'כלב', 'חתול', 'דולפין', 'כריש', 'נחש', 'תנין', 'פינגווין', 'קוף', 'זברה', 'סוס', 'פרה', 'תרנגולת', 'ינשוף', 'דבורה', 'פרפר', 'צב', 'קנגורו', 'דוב', 'זאב', 'גמל', 'עכביש'] },
  places: { name: 'מקומות', ico: '📍', words: ['בית חולים', 'בית ספר', 'חוף ים', 'סופרמרקט', 'שדה תעופה', 'בית קולנוע', 'חדר כושר', 'מסעדה', 'ספרייה', 'גן חיות', 'תחנת דלק', 'בריכה', 'מספרה', 'בנק', 'תחנת משטרה', 'קניון', 'אצטדיון', 'מוזיאון', 'בית כנסת', 'מלון', 'רכבת', 'מחנה צבאי', 'חתונה', 'מרפאת שיניים'] },
  israel: { name: 'מקומות בארץ', ico: '🇮🇱', words: ['ים המלח', 'הכותל', 'אילת', 'החרמון', 'הכנרת', 'מצדה', 'עכו', 'צפת', 'נמל תל אביב', 'שוק מחנה יהודה', 'הגנים הבהאיים', 'ראש הנקרה', 'מכתש רמון', 'קיסריה', 'עין גדי', 'נתניה', 'שוק הכרמל', 'הטכניון', 'נחל עמוד', 'בית שאן', 'יפו', 'הר תבור', 'זכרון יעקב', 'באר שבע'] },
  jobs: { name: 'מקצועות', ico: '👩‍🚒', words: ['רופא', 'מורה', 'שוטר', 'כבאי', 'טבח', 'טייס', 'מתכנת', 'עורך דין', 'ספר', 'נהג אוטובוס', 'חשמלאי', 'אינסטלטור', 'צלם', 'זמר', 'שחקן', 'וטרינר', 'רוקח', 'מלצר', 'חקלאי', 'אסטרונאוט', 'גנן', 'דייג', 'מציל', 'שופט כדורגל'] },
  sports: { name: 'ספורט', ico: '⚽', words: ['כדורגל', 'כדורסל', 'טניס', 'שחייה', 'אופניים', 'ריצת מרתון', 'גלישה', 'סקי', 'כדורעף', 'איגרוף', 'ג׳ודו', 'באולינג', 'גולף', 'פינג פונג', 'הוקי קרח', 'התעמלות', 'טיפוס', 'יוגה', 'קרטה', 'פטאנק', 'בייסבול', 'רוגבי', 'סנובורד', 'חתירה'] },
  home: { name: 'חפצים בבית', ico: '🛋️', words: ['מקרר', 'ספה', 'טלוויזיה', 'מכונת כביסה', 'מיקרוגל', 'מברשת שיניים', 'כרית', 'שטיח', 'מראה', 'מנורה', 'מטריה', 'שעון מעורר', 'קומקום', 'מגהץ', 'שואב אבק', 'מזגן', 'מחבת', 'וילון', 'מפתחות', 'שלט', 'מגבת', 'עציץ', 'כיסא', 'מדיח כלים'] },
  countries: { name: 'מדינות', ico: '🌍', words: ['צרפת', 'יפן', 'ברזיל', 'מצרים', 'אוסטרליה', 'קנדה', 'איטליה', 'הודו', 'מקסיקו', 'יוון', 'תאילנד', 'ארגנטינה', 'רוסיה', 'סין', 'ספרד', 'גרמניה', 'אנגליה', 'טורקיה', 'קפריסין', 'אמריקה', 'הולנד', 'נורווגיה', 'קניה', 'וייטנאם'] },
  transport: { name: 'כלי תחבורה', ico: '🚗', words: ['מכונית', 'אוטובוס', 'רכבת', 'מטוס', 'אופניים', 'קורקינט', 'מסוק', 'סירה', 'אונייה', 'צוללת', 'אופנוע', 'מונית', 'טרקטור', 'רכבל', 'כדור פורח', 'משאית', 'חללית', 'סקייטבורד', 'רכבת קלה', 'אמבולנס', 'גמל', 'קיאק', 'טרקטורון', 'גונדולה'] },
};

export const DEFAULT_SETTINGS = { cats: { food: true, animals: true, places: true }, impCount: 1, showCat: true };

export const maxImposters = n => Math.max(1, Math.min(3, Math.floor((n - 1) / 2)));

function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
function shuffle(a) { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

export function newRound(order, settings, prevRound = 0) {
  const s = { ...DEFAULT_SETTINGS, ...(settings || {}) };
  let cats = Object.keys(s.cats || {}).filter(c => s.cats[c] && CATEGORIES[c]);
  if (!cats.length) cats = Object.keys(CATEGORIES);
  const cat = pick(cats);
  const word = pick(CATEGORIES[cat].words);
  const k = Math.min(s.impCount || 1, maxImposters(order.length));
  const imposters = {};
  for (const p of shuffle(order).slice(0, k)) imposters[p] = true;
  return {
    round: prevRound + 1, cat, word, imposters, showCat: !!s.showCat,
    first: pick(order), dir: Math.random() < 0.5 ? 1 : -1,
    phase: 'play', votes: {}, result: null,
  };
}

// Tally votes: returns { top, tie, counts }
export function tally(votes) {
  const counts = {};
  for (const t of Object.values(votes || {})) counts[t] = (counts[t] || 0) + 1;
  let max = 0, top = [];
  for (const [p, c] of Object.entries(counts)) {
    if (c > max) { max = c; top = [p]; } else if (c === max) top.push(p);
  }
  return { top: top.length === 1 ? top[0] : '', tie: top.length > 1, counts };
}
