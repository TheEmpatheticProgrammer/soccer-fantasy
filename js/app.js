const WORLD_CUP_START_FALLBACK = new Date('2026-06-11T16:00:00-06:00');
// Derive the opener kickoff from loaded match data when available so the
// countdown banner reflects reality even if the hardcoded constant drifts.
function getWorldCupStart() {
  const earliest = state.matches?.reduce((min, m) => {
    const t = new Date(m.utcDate).getTime();
    return Number.isFinite(t) && (min === null || t < min) ? t : min;
  }, null);
  return earliest !== null && earliest !== undefined
    ? new Date(earliest)
    : WORLD_CUP_START_FALLBACK;
}
// Predictions are hard-locked for the group stage — set to epoch so
// arePredictionsLocked() is always true there. Knockout leagues bypass the
// lock entirely so members can edit their bracket predictions until each
// match kicks off (per-match locking is a future enhancement).
const PREDICTIONS_LOCK_DATE = new Date(0);
const arePredictionsLocked = () => {
  if (state?.leagueType === 'knockout') return false;
  return Date.now() >= PREDICTIONS_LOCK_DATE.getTime();
};

const Storage = {
  keys: {
    apiKey: 'wc2026_api_key',
    lastLeagueId: 'wc2026_last_league_id',
    lastView: 'wc2026_last_view',
    predictionsSort: 'wc2026_predictions_sort',
    knockoutDemo: 'wc2026_knockout_demo',
  },
  getApiKey()         { return localStorage.getItem(this.keys.apiKey) || ''; },
  setApiKey(k)        { localStorage.setItem(this.keys.apiKey, k); },
  getLastLeagueId()   { return localStorage.getItem(this.keys.lastLeagueId) || ''; },
  setLastLeagueId(id) { localStorage.setItem(this.keys.lastLeagueId, id); },
  clearLastLeagueId() { localStorage.removeItem(this.keys.lastLeagueId); },
  getLastView()       { return localStorage.getItem(this.keys.lastView) || ''; },
  setLastView(v)      { localStorage.setItem(this.keys.lastView, v); },
  getPredictionsSort(){ return localStorage.getItem(this.keys.predictionsSort) || 'group'; },
  setPredictionsSort(v){ localStorage.setItem(this.keys.predictionsSort, v); },
  // Default ON — the real football-data fixtures won't return team names
  // Demo mode defaults OFF — real API data is now used. Toggle in Settings.
  getKnockoutDemo()   { return localStorage.getItem(this.keys.knockoutDemo) === '1'; },
  setKnockoutDemo(v)  { localStorage.setItem(this.keys.knockoutDemo, v ? '1' : '0'); },
};

// Spanish team names as they appear in the import template → canonical
// English name (or one English alias; TEAM_ALIASES expands to all forms).
const SPANISH_TEAM_TO_ENGLISH = {
  'MEXICO': 'Mexico', 'SUDAFRICA': 'South Africa',
  'KOREA SUR': 'Korea Republic', 'KOREA': 'Korea Republic', 'COREA DEL SUR': 'Korea Republic',
  'REP. CHECA': 'Czech Republic', 'REPUBLICA CHECA': 'Czech Republic',
  'CANADA': 'Canada', 'BOSNIA': 'Bosnia and Herzegovina',
  'QATAR': 'Qatar', 'CATAR': 'Qatar', 'SUIZA': 'Switzerland',
  'BRASIL': 'Brazil', 'MARRUECOS': 'Morocco', 'HAITI': 'Haiti', 'ESCOCIA': 'Scotland',
  'EEUU': 'United States', 'EE.UU.': 'United States', 'ESTADOS UNIDOS': 'United States',
  'PARAGUAY': 'Paraguay', 'AUSTRALIA': 'Australia', 'TURQUIA': 'Turkey',
  'ALEMANIA': 'Germany', 'CURAZAO': 'Curaçao',
  'C. MARFIL': 'Ivory Coast', 'COSTA DE MARFIL': 'Ivory Coast',
  'ECUADOR': 'Ecuador', 'HOLANDA': 'Netherlands', 'PAISES BAJOS': 'Netherlands',
  'JAPON': 'Japan', 'SUECIA': 'Sweden', 'TUNEZ': 'Tunisia',
  'BELGICA': 'Belgium', 'EGYPTO': 'Egypt', 'EGIPTO': 'Egypt',
  'IRAN': 'Iran', 'N. ZELANDA': 'New Zealand', 'N.ZELANDA': 'New Zealand', 'NUEVA ZELANDA': 'New Zealand',
  'ESPANA': 'Spain',
  'ARABIA S.': 'Saudi Arabia', 'ARABIA SAUDI': 'Saudi Arabia', 'ARABIA SAUDITA': 'Saudi Arabia',
  'URUGUAY': 'Uruguay', 'CABO VERDE': 'Cape Verde',
  'FRANCIA': 'France', 'SENEGAL': 'Senegal', 'IRAK': 'Iraq', 'NORUEGA': 'Norway',
  'ARGENTINA': 'Argentina', 'ARGELIA': 'Algeria', 'AUSTRIA': 'Austria', 'JORDANIA': 'Jordan',
  'PORTUGAL': 'Portugal', 'CONGO': 'DR Congo', 'RD CONGO': 'DR Congo', 'RD DEL CONGO': 'DR Congo',
  'UZBEKISTAN': 'Uzbekistan', 'COLOMBIA': 'Colombia',
  'INGLATERRA': 'England', 'CROACIA': 'Croatia', 'GHANA': 'Ghana', 'PANAMA': 'Panama',
};

// API may return any of these forms; cluster them so import matching is robust.
const TEAM_ALIASES = [
  ['Czech Republic', 'Czechia'],
  ['Turkey', 'Türkiye', 'Turkiye'],
  ['Korea Republic', 'South Korea', 'Republic of Korea', 'Korea'],
  ['Korea DPR', 'North Korea', 'DPR Korea'],
  ['Iran', 'Islamic Republic of Iran', 'IR Iran'],
  ['Cape Verde', 'Cabo Verde', 'Cape Verde Islands'],
  ['Ivory Coast', "Côte d'Ivoire", 'Cote d Ivoire', "Cote d'Ivoire"],
  ['Bosnia and Herzegovina', 'Bosnia-Herzegovina', 'Bosnia', 'Bosnia & Herzegovina'],
  ['Curaçao', 'Curacao'],
  ['DR Congo', 'Democratic Republic of the Congo', 'Congo DR', 'Congo', 'Congo-Kinshasa'],
  ['United States', 'USA', 'United States of America', 'US', 'U.S.A.'],
  ['Saudi Arabia', 'KSA'],
  ['Netherlands', 'Holland', 'The Netherlands'],
  ['Russia', 'Russian Federation'],
  ['China PR', 'China', 'PR China'],
  ['North Macedonia', 'Macedonia', 'FYR Macedonia', 'Republic of North Macedonia'],
  ['Guinea-Bissau', 'Guinea Bissau'],
  ['Trinidad and Tobago', 'Trinidad & Tobago', 'Trinidad'],
  ['Antigua and Barbuda', 'Antigua & Barbuda'],
  ['Saint Kitts and Nevis', 'St. Kitts and Nevis', 'St Kitts and Nevis'],
  ['Saint Lucia', 'St. Lucia', 'St Lucia'],
  ['Saint Vincent and the Grenadines', 'St. Vincent and the Grenadines', 'St Vincent and the Grenadines'],
  ['São Tomé and Príncipe', 'Sao Tome and Principe', 'Sao Tome & Principe'],
  ['Equatorial Guinea', 'Eq. Guinea'],
  ['Central African Republic', 'CAR'],
  ['United Arab Emirates', 'UAE'],
  ['Republic of Ireland', 'Ireland', 'Eire'],
  ['Northern Ireland', 'N. Ireland'],
  ['New Zealand', 'NZ'],
  ['Saint Martin', 'Sint Maarten'],
  ['East Timor', 'Timor-Leste', 'Timor Leste'],
  ['Vietnam', 'Viet Nam'],
  ['Brunei', 'Brunei Darussalam'],
  ['Hong Kong', 'Hong Kong, China'],
  ['Chinese Taipei', 'Taiwan'],
  ['Eswatini', 'Swaziland'],
  ['Myanmar', 'Burma'],
];

const DEFAULT_LEAGUE_NAME = 'Polla World Cup 2026';
const LEGACY_DEFAULT_LEAGUE_NAME = 'World Cup 2026 League';
const LEAGUE_NAME_I18N = {
  'Polla World Cup 2026': { en: 'Polla World Cup 2026', es: 'Polla Mundial 2026' },
  'Polla Mundial 2026':   { en: 'Polla World Cup 2026', es: 'Polla Mundial 2026' },
  'World Cup 2026 League': { en: 'Polla World Cup 2026', es: 'Polla Mundial 2026' },
};

const WC2026_VENUES = {
  'Estadio Azteca':            { en: 'Mexico City, Mexico',     es: 'Ciudad de México, México' },
  'Estadio Akron':             { en: 'Guadalajara, Mexico',     es: 'Guadalajara, México' },
  'Estadio BBVA':              { en: 'Monterrey, Mexico',       es: 'Monterrey, México' },
  'BMO Field':                 { en: 'Toronto, Canada',         es: 'Toronto, Canadá' },
  'BC Place':                  { en: 'Vancouver, Canada',       es: 'Vancouver, Canadá' },
  'MetLife Stadium':           { en: 'New York/New Jersey, USA', es: 'Nueva York/Nueva Jersey, EE.UU.' },
  'SoFi Stadium':              { en: 'Los Angeles, USA',        es: 'Los Ángeles, EE.UU.' },
  'AT&T Stadium':              { en: 'Dallas, USA',             es: 'Dallas, EE.UU.' },
  'NRG Stadium':               { en: 'Houston, USA',            es: 'Houston, EE.UU.' },
  'Arrowhead Stadium':         { en: 'Kansas City, USA',        es: 'Kansas City, EE.UU.' },
  'GEHA Field at Arrowhead Stadium': { en: 'Kansas City, USA',  es: 'Kansas City, EE.UU.' },
  'Mercedes-Benz Stadium':     { en: 'Atlanta, USA',            es: 'Atlanta, EE.UU.' },
  'Hard Rock Stadium':         { en: 'Miami, USA',              es: 'Miami, EE.UU.' },
  'Levi\'s Stadium':           { en: 'San Francisco Bay, USA',  es: 'Bahía de San Francisco, EE.UU.' },
  'Lincoln Financial Field':   { en: 'Philadelphia, USA',       es: 'Filadelfia, EE.UU.' },
  'Lumen Field':               { en: 'Seattle, USA',            es: 'Seattle, EE.UU.' },
  'Gillette Stadium':          { en: 'Boston, USA',             es: 'Boston, EE.UU.' },
};

const WC2026_MATCH_VENUE_BY_ID = {
  '537327': 'Estadio Azteca',          '537328': 'Estadio Akron',
  '537329': 'Mercedes-Benz Stadium',   '537330': 'Estadio Akron',
  '537331': 'Estadio Azteca',          '537332': 'Estadio BBVA',
  '537333': 'BMO Field',               '537334': "Levi's Stadium",
  '537335': 'SoFi Stadium',            '537336': 'BC Place',
  '537337': 'BC Place',                '537338': 'Lumen Field',
  '537339': 'MetLife Stadium',         '537340': 'Gillette Stadium',
  '537341': 'Lincoln Financial Field', '537342': 'Gillette Stadium',
  '537343': 'Hard Rock Stadium',       '537344': 'Mercedes-Benz Stadium',
  '537345': 'SoFi Stadium',            '537346': 'BC Place',
  '537347': "Levi's Stadium",          '537348': 'Lumen Field',
  '537349': 'SoFi Stadium',            '537350': "Levi's Stadium",
  '537351': 'NRG Stadium',             '537352': 'Lincoln Financial Field',
  '537353': 'BMO Field',               '537354': 'Arrowhead Stadium',
  '537355': 'MetLife Stadium',         '537356': 'Lincoln Financial Field',
  '537357': 'AT&T Stadium',            '537358': 'Estadio BBVA',
  '537359': 'NRG Stadium',             '537360': 'Estadio BBVA',
  '537361': 'Arrowhead Stadium',       '537362': 'AT&T Stadium',
  '537363': 'Lumen Field',             '537364': 'SoFi Stadium',
  '537365': 'SoFi Stadium',            '537366': 'BC Place',
  '537367': 'BC Place',                '537368': 'Lumen Field',
  '537369': 'Mercedes-Benz Stadium',   '537370': 'Hard Rock Stadium',
  '537371': 'Mercedes-Benz Stadium',   '537372': 'Hard Rock Stadium',
  '537373': 'Estadio Akron',           '537374': 'NRG Stadium',
  '537391': 'MetLife Stadium',         '537392': 'Gillette Stadium',
  '537393': 'Lincoln Financial Field', '537394': 'MetLife Stadium',
  '537395': 'Gillette Stadium',        '537396': 'BMO Field',
  '537397': 'Arrowhead Stadium',       '537398': "Levi's Stadium",
  '537399': 'AT&T Stadium',            '537400': "Levi's Stadium",
  '537401': 'AT&T Stadium',            '537402': 'Arrowhead Stadium',
  '537403': 'NRG Stadium',             '537404': 'Estadio Azteca',
  '537405': 'NRG Stadium',             '537406': 'Estadio Akron',
  '537407': 'Hard Rock Stadium',       '537408': 'Mercedes-Benz Stadium',
  '537409': 'AT&T Stadium',            '537410': 'BMO Field',
  '537411': 'Gillette Stadium',        '537412': 'BMO Field',
  '537413': 'MetLife Stadium',         '537414': 'Lincoln Financial Field',
};

function venueForMatch(match) {
  return match?.venue || WC2026_MATCH_VENUE_BY_ID[String(match?.id)] || null;
}
function displayVenue(venueName) {
  if (!venueName) return '';
  const entry = WC2026_VENUES[venueName];
  if (!entry) return venueName;
  const lang = getLanguage?.() || 'en';
  return entry[lang] || entry.en;
}
function displayLeagueName(name) {
  const entry = LEAGUE_NAME_I18N[name];
  return entry ? (entry[getLanguage?.()] || entry.en || name) : (name || '');
}

function leagueDocRef(leagueId) {
  return firebase.firestore().collection('leagues').doc(leagueId);
}
function leaguePredictionsCol(leagueId) {
  return leagueDocRef(leagueId).collection('predictions');
}
function isLeagueOwner(league = state.currentLeague) {
  return !!league && firebase.auth().currentUser?.uid === league.ownerUid;
}

const hasApiAccess = () => !!(state.apiKey || window.LOCAL_CONFIG?.apiBaseUrl);

const state = {
  uid: null,
  currentPlayer: '',
  leagueId: null,
  currentLeague: null,
  leagueType: 'groups',
  myLeagues: [],
  publicLeagues: [],
  predictionDocs: {},
  results: {},
  matchStatus: {},
  groups:  { ...GROUPS },
  matches: [...ALL_MATCHES],
  crests: {},
  apiKey: '',
  view: null,
  predictionsSort: Storage.getPredictionsSort(),
  knockout: {
    matches: [],
    results: {},
    predictionDocs: {},
    predVersion: 0,
    resultsVersion: 0,
    crests: {},
  },
};

function teamLabel(name, flagPos = 'left') {
  const crest = state.crests[name];
  const flag = crest
    ? `<img class="team-flag" src="${crest}" alt="" loading="lazy" decoding="async">`
    : '';
  const nameSpan = `<span class="team-name">${tCountry(name)}</span>`;
  return flagPos === 'right' ? `${nameSpan}${flag}` : `${flag}${nameSpan}`;
}

function teamFlag(name) {
  const crest = state.crests[name];
  return crest
    ? `<img class="team-flag" src="${crest}" alt="" loading="lazy" decoding="async">`
    : '<span class="team-flag team-flag-empty"></span>';
}

function formatMatchDateTime(utcDate) {
  if (!utcDate) return t('app.dateTBD');
  const d = new Date(utcDate);
  if (isNaN(d.getTime())) return t('app.dateTBD');
  const locale = getLanguage() === 'es' ? 'es-MX' : 'en-US';
  return new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(d);
}

function formatMatchDateParts(utcDate) {
  if (!utcDate) return { day: t('app.dateTBD'), time: '' };
  const d = new Date(utcDate);
  if (isNaN(d.getTime())) return { day: t('app.dateTBD'), time: '' };
  const locale = getLanguage() === 'es' ? 'es-MX' : 'en-US';
  return {
    day: new Intl.DateTimeFormat(locale, { weekday: 'short', month: 'short', day: 'numeric' }).format(d),
    time: new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' }).format(d),
  };
}

function dateKey(utcDate) {
  const d = new Date(utcDate);
  if (isNaN(d.getTime())) return 'tbd';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function dateSectionLabel(utcDate) {
  const d = new Date(utcDate);
  if (isNaN(d.getTime())) return t('app.dateTBD');
  const locale = getLanguage() === 'es' ? 'es-MX' : 'en-US';
  return new Intl.DateTimeFormat(locale, { weekday: 'long', month: 'short', day: 'numeric' }).format(d);
}

function predictionSections() {
  if (state.predictionsSort === 'date') {
    const byDate = new Map();
    for (const m of state.matches) {
      const k = dateKey(m.utcDate);
      if (!byDate.has(k)) byDate.set(k, { key: k, title: dateSectionLabel(m.utcDate), letter: null, teams: [], matches: [] });
      const section = byDate.get(k);
      section.matches.push(m);
      if (m.home && m.home !== 'TBD' && !section.teams.includes(m.home)) section.teams.push(m.home);
      if (m.away && m.away !== 'TBD' && !section.teams.includes(m.away)) section.teams.push(m.away);
    }
    return Array.from(byDate.values()).sort((a, b) => a.key.localeCompare(b.key));
  }
  return Object.entries(state.groups).map(([letter, teams]) => ({
    key: letter,
    title: t('match.group', { letter }),
    letter,
    teams,
    matches: state.matches.filter(m => m.group === letter),
  }));
}

function isMobileViewport() {
  return typeof window !== 'undefined' && window.matchMedia('(max-width: 600px)').matches;
}

function defaultOpenSectionKey(sections) {
  if (state.predictionsSort === 'date') {
    const today = dateKey(new Date().toISOString());
    if (sections.some(s => s.key === today)) return today;
    const now = Date.now();
    for (const s of sections) {
      const first = s.matches[0];
      if (first && new Date(first.utcDate).getTime() >= now) return s.key;
    }
    return sections[sections.length - 1]?.key;
  }
  return currentGroup() || Object.keys(state.groups)[0];
}

let unsubPredictions = null;
let unsubResults = null;
let unsubLeague = null;
let lastApiStatus = null;
let lastRefreshTs = null;
let autosaveTimer = null;
let autosaveStatusTimer = null;
let isSaving = false;

function init() {
  initLanguageToggle();
  initAuthForm();
  bindEvents();
  renderAdminMatches();
  renderLeaderboard();
  startCountdownInterval();
  initHeaderHeightTracking();

  document.addEventListener('visibilitychange', maybeAdjustLivePolling);

  firebase.auth().onAuthStateChanged(user => {
    if (user) onSignedIn(user);
    else      onSignedOut();
  });
}

function initHeaderHeightTracking() {
  const header = document.querySelector('.app-header');
  if (!header) return;
  const update = () => {
    const h = header.offsetHeight;
    if (h > 0) document.documentElement.style.setProperty('--app-header-h', h + 'px');
  };
  update();
  window.addEventListener('resize', update);
  if (typeof ResizeObserver === 'function') {
    new ResizeObserver(update).observe(header);
  }
}

async function onSignedIn(user) {
  state.uid = user.uid;
  state.currentPlayer = user.displayName || user.email;

  document.getElementById('auth-screen').classList.add('hidden');
  try { localStorage.setItem('wc2026_signed_in', '1'); } catch (e) {}
  document.getElementById('player-display').textContent = state.currentPlayer;
  renderProfile();
  document.querySelectorAll('.admin-only').forEach(el => el.classList.toggle('hidden', !isAdmin()));

  state.apiKey = Storage.getApiKey() || window.LOCAL_CONFIG?.apiKey || '';
  document.getElementById('api-key-input').value = state.apiKey;
  document.getElementById('btn-refresh').disabled = !hasApiAccess();

  // Results are global; subscribe once regardless of league
  subscribeToResults();

  if (hasApiAccess()) {
    await loadFromApi(false);
  } else {
    showApiStatus('settings.enterKey', 'warn');
  }

  // Admin one-time migration: if old /predictions exist and no leagues yet, build a default league
  if (isAdmin()) {
    await maybeRunMigration();
    await maybeRenameLegacyLeague();
  }

  await loadMyLeagues();
  await routeAfterSignIn();
}

async function loadMyLeagues() {
  try {
    const snap = await firebase.firestore().collection('leagues')
      .where('memberUids', 'array-contains', state.uid)
      .get();
    state.myLeagues = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    state.myLeagues = [];
    console.error('Could not load leagues', err);
  }
}

async function loadPublicLeagues() {
  try {
    const snap = await firebase.firestore().collection('leagues').get();
    state.publicLeagues = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    state.publicLeagues = [];
    console.error('Could not load leagues', err);
  }
}

async function routeAfterSignIn() {
  if (state.myLeagues.length === 0) {
    await enterLeaguesView();
    return;
  }
  const lastId = Storage.getLastLeagueId();
  const chosen = state.myLeagues.find(l => l.id === lastId) || state.myLeagues[0];
  await enterLeague(chosen.id);
  const lastView = Storage.getLastView();
  const allowed = new Set(['predictions', 'leaderboard', 'leagues', 'profile', 'rules', 'knockout']);
  const defaultView = state.leagueType === 'knockout' ? 'knockout' : 'predictions';
  // If user's last view doesn't apply to the league type they're entering,
  // fall through to the type-appropriate default.
  const isKnockoutView = lastView === 'knockout';
  const isGroupView = lastView === 'predictions' || lastView === 'leaderboard';
  let target = defaultView;
  if (allowed.has(lastView)) {
    if (state.leagueType === 'knockout' && !isGroupView) target = lastView;
    else if (state.leagueType !== 'knockout' && !isKnockoutView) target = lastView;
  }
  switchView(target);
}

async function enterLeague(leagueId) {
  if (unsubPredictions) { unsubPredictions(); unsubPredictions = null; }
  if (unsubLeague)      { unsubLeague();      unsubLeague = null; }
  if (typeof unsubscribeKnockout === 'function') unsubscribeKnockout();

  state.leagueId = leagueId;
  state.predictionsRendered = false;
  state.everyoneRendered = false;
  state._everyoneSeenMatches = new Set();
  Storage.setLastLeagueId(leagueId);

  const doc = await leagueDocRef(leagueId).get();
  if (!doc.exists) {
    state.leagueId = null;
    state.currentLeague = null;
    Storage.clearLastLeagueId();
    await enterLeaguesView();
    return;
  }
  state.currentLeague = { id: doc.id, ...doc.data() };
  state.leagueType = state.currentLeague.type === 'knockout' ? 'knockout' : 'groups';
  document.body.classList.toggle('league-type-knockout', state.leagueType === 'knockout');

  document.querySelectorAll('.league-owner-only').forEach(el =>
    el.classList.toggle('hidden', !isLeagueOwner())
  );

  document.getElementById('admin-panel').classList.toggle('hidden', !isAdmin());

  updateCurrentLeagueBadge();
  if (state.leagueType === 'knockout') {
    state.knockout.matches = buildKnockoutDemoMatches();
    state.knockout.crests = {};
    if (typeof subscribeToKnockoutPredictions === 'function') subscribeToKnockoutPredictions();
    if (typeof subscribeToKnockoutResults === 'function') subscribeToKnockoutResults();
    refreshKnockoutMatches();
  } else {
    subscribeToPredictions();
  }
  subscribeToLeague();
  renderProfileLeagues();
}

// Reassign R32 match slots by matching resolved team names against the
// template's expected aliases. The API returns matches in date order which
// doesn't correspond to the bracket slot numbering — this step ensures each
// match ends up in the correct bracket position.
function reassignR32Slots(matches, aliasMap) {
  if (typeof KNOCKOUT_TEMPLATE === 'undefined') return;
  const r32Template = KNOCKOUT_TEMPLATE.LAST_32 || [];
  const r32Matches = matches.filter(m => m.stage === 'LAST_32');
  if (!r32Matches.length || !r32Template.length) return;

  // Build expected home/away for each template slot
  const slotExpectations = r32Template.map(s => ({
    slot: s.slot,
    homeAlias: s.homeAlias,
    awayAlias: s.awayAlias,
    expectedHome: aliasMap[s.homeAlias] || null,
    expectedAway: aliasMap[s.awayAlias] || null,
    feedsIntoSlot: s.feedsIntoSlot,
  }));

  const assigned = new Set();
  const matchToSlot = new Map();

  // Pass 1: match on BOTH home AND away
  for (const m of r32Matches) {
    for (const s of slotExpectations) {
      if (assigned.has(s.slot)) continue;
      const homeOk = m.home !== 'TBD' && s.expectedHome && m.home === s.expectedHome;
      const awayOk = m.away !== 'TBD' && s.expectedAway && m.away === s.expectedAway;
      if (homeOk && awayOk) {
        matchToSlot.set(m.id, s);
        assigned.add(s.slot);
        break;
      }
    }
  }

  // Pass 2: match on home only
  for (const m of r32Matches) {
    if (matchToSlot.has(m.id)) continue;
    for (const s of slotExpectations) {
      if (assigned.has(s.slot)) continue;
      if (m.home !== 'TBD' && s.expectedHome && m.home === s.expectedHome) {
        matchToSlot.set(m.id, s);
        assigned.add(s.slot);
        break;
      }
    }
  }

  // Pass 3: match on away only
  for (const m of r32Matches) {
    if (matchToSlot.has(m.id)) continue;
    for (const s of slotExpectations) {
      if (assigned.has(s.slot)) continue;
      if (m.away !== 'TBD' && s.expectedAway && m.away === s.expectedAway) {
        matchToSlot.set(m.id, s);
        assigned.add(s.slot);
        break;
      }
    }
  }

  // Pass 4: remaining unmatched get leftover slots in order
  const remainingSlots = slotExpectations.filter(s => !assigned.has(s.slot));
  let ri = 0;
  for (const m of r32Matches) {
    if (matchToSlot.has(m.id)) continue;
    if (ri < remainingSlots.length) {
      matchToSlot.set(m.id, remainingSlots[ri++]);
    }
  }

  // Apply slot reassignments
  for (const m of r32Matches) {
    const s = matchToSlot.get(m.id);
    if (s) {
      m.slot = s.slot;
      m.homeAlias = s.homeAlias;
      m.awayAlias = s.awayAlias;
    }
  }
}

async function refreshKnockoutMatches() {
  try {
    if (typeof loadKnockoutData !== 'function') return;
    const { matches, crests } = await loadKnockoutData(state.apiKey, false);
    if (matches && matches.length) {
      // Use standings to get Winner/Runner-up mappings for correct slot assignment.
      // The API already provides real team names — no solver needed.
      if (typeof loadGroupStandings === 'function') {
        try {
          const aliasMap = await loadGroupStandings(state.apiKey);
          if (Object.keys(aliasMap).length) {
            reassignR32Slots(matches, aliasMap);
          }
        } catch (e) { console.warn('[knockout] standings fetch failed:', e.message); }
      }

      // Preserve previously resolved team names if the API/standings still
      // return TBD — prevents losing names on transient API failures.
      const prev = new Map((state.knockout.matches || []).map(m => [m.id, m]));
      for (const m of matches) {
        const old = prev.get(m.id);
        if (!old) continue;
        if (m.home === 'TBD' && old.home !== 'TBD') m.home = old.home;
        if (m.away === 'TBD' && old.away !== 'TBD') m.away = old.away;
      }

      state.knockout.matches = matches;
      state.knockout.crests = { ...state.knockout.crests, ...crests };

      // Fan out any API-reported final results to Firestore (admin only)
      if (isAdmin()) {
        const existing = state.knockout.results || {};
        let newResults = false;
        const merged = { ...existing };
        for (const m of matches) {
          if (m.result && !existing[m.id]) {
            merged[m.id] = m.result;
            newResults = true;
          }
        }
        if (newResults) {
          state.knockout.results = merged;
          state.knockout.resultsVersion = (state.knockout.resultsVersion || 0) + 1;
          firebase.firestore().collection('knockoutResults').doc('all').set({
            results: merged,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          }, { merge: true }).catch(err => console.warn('[knockout] results fanout failed:', err.message));
        }
      }

      scheduleRenderAll();
    }
  } catch (err) {
    console.warn('[knockout] load failed, using demo bracket', err);
  }
}

function subscribeToLeague() {
  if (!state.leagueId) return;
  unsubLeague = leagueDocRef(state.leagueId).onSnapshot(
    doc => {
      if (!doc.exists) return;
      state.currentLeague = { id: doc.id, ...doc.data() };
      updateCurrentLeagueBadge();
      document.querySelectorAll('.league-owner-only').forEach(el =>
        el.classList.toggle('hidden', !isLeagueOwner())
      );
      scheduleRenderAll();
    },
    err => console.error('league subscription error', err)
  );
}

async function enterLeaguesView() {
  state.leagueId = null;
  state.currentLeague = null;
  state.predictionDocs = {};
  state.leagueType = 'groups';
  document.body.classList.remove('league-type-knockout');
  if (unsubPredictions) { unsubPredictions(); unsubPredictions = null; }
  if (typeof unsubscribeKnockout === 'function') unsubscribeKnockout();
  updateCurrentLeagueBadge();
  await loadPublicLeagues();
  switchView('leagues');
  renderLeagues();
}

function updateCurrentLeagueBadge() {
  const badge = document.getElementById('current-league-badge');
  if (!badge) return;
  const nameEl = badge.querySelector('.current-league-badge-name');
  if (state.currentLeague) {
    (nameEl || badge).textContent = displayLeagueName(state.currentLeague.name);
    badge.classList.remove('hidden');
  } else {
    if (nameEl) nameEl.textContent = ''; else badge.textContent = '';
    badge.classList.add('hidden');
  }
  renderHeaderStats();
}

function formatCountdown(targetMs) {
  const diff = targetMs - Date.now();
  if (diff <= 0) return null;
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function computeMyRank() {
  if (!state.uid) return null;
  const players = Object.entries(state.predictionDocs);
  if (players.length === 0) return null;

  const standings = players.map(([uid, doc]) => {
    const preds = doc.predictions || {};
    let points = 0;
    for (const [matchId, pred] of Object.entries(preds)) {
      const actual = state.results[matchId];
      if (!actual) continue;
      points += calcPoints(pred, actual);
    }
    return { uid, points, predicted: Object.keys(preds).length };
  }).sort((a, b) => b.points - a.points || b.predicted - a.predicted);

  const myIndex = standings.findIndex(s => s.uid === state.uid);
  if (myIndex === -1) return null;

  return {
    rank: myIndex + 1,
    points: standings[myIndex].points,
    totalPlayers: standings.length,
  };
}

function renderHeaderStats() {
  const rankEl = document.getElementById('rank-pill');
  if (!rankEl) return;

  if (!state.currentLeague) {
    rankEl.classList.add('hidden');
    return;
  }

  const myRank = computeMyRank();
  if (myRank) {
    rankEl.textContent = `${t('header.rank')} #${myRank.rank} · ${myRank.points} ${t('header.points')}`;
    rankEl.classList.remove('hidden');
  } else {
    rankEl.classList.add('hidden');
  }
}

function startCountdownInterval() {}

function onSignedOut() {
  state.uid = null;
  state.currentPlayer = '';
  state.leagueId = null;
  state.currentLeague = null;
  state.myLeagues = [];
  state.publicLeagues = [];
  state.predictionDocs = {};
  state.results = {};

  if (unsubPredictions) { unsubPredictions(); unsubPredictions = null; }
  if (unsubResults)     { unsubResults();     unsubResults = null; }
  if (unsubLeague)      { unsubLeague();      unsubLeague = null; }

  document.documentElement.classList.remove('auth-prepaint-signed-in');
  document.getElementById('auth-screen').classList.remove('hidden');
  try { localStorage.removeItem('wc2026_lb_html'); } catch (e) {}
  try { localStorage.removeItem('wc2026_lb_html_v2'); } catch (e) {}
  try { localStorage.removeItem('wc2026_signed_in'); } catch (e) {}
  document.getElementById('settings-panel').classList.add('hidden');
  updateCurrentLeagueBadge();
  maybeAdjustLivePolling();
}

function renderProfile() {
  const user = firebase.auth().currentUser;
  if (!user) return;
  document.getElementById('profile-email').textContent = user.email;
  document.getElementById('profile-name-input').value = user.displayName || '';
  renderProfileLeagues();
}

async function updateDisplayName() {
  const input = document.getElementById('profile-name-input');
  const newName = input.value.trim();
  const statusEl = document.getElementById('profile-name-status');
  const btn = document.getElementById('btn-update-name');

  if (newName.length < 2) {
    statusEl.textContent = t('profile.nameTooShort');
    statusEl.className = 'profile-status status-error';
    return;
  }

  btn.disabled = true;
  statusEl.textContent = t('profile.saving');
  statusEl.className = 'profile-status';

  try {
    const user = firebase.auth().currentUser;
    await user.updateProfile({ displayName: newName });
    await user.reload();

    state.currentPlayer = newName;
    document.getElementById('player-display').textContent = newName;

    if (state.leagueId) {
      const docRef = leaguePredictionsCol(state.leagueId).doc(state.uid);
      const snap = await docRef.get();
      if (snap.exists) {
        await docRef.update({ displayName: newName });
      }
    }

    statusEl.textContent = `✓ ${t('profile.nameUpdated')}`;
    statusEl.className = 'profile-status status-ok';
    refreshDynamicContent();
  } catch (err) {
    statusEl.textContent = err.message;
    statusEl.className = 'profile-status status-error';
  } finally {
    btn.disabled = false;
  }
}

async function changePassword() {
  const currentInput = document.getElementById('profile-current-password');
  const newInput = document.getElementById('profile-new-password');
  const statusEl = document.getElementById('profile-password-status');
  const btn = document.getElementById('btn-change-password');

  const current = currentInput.value;
  const next = newInput.value;

  if (!current || next.length < 6) {
    statusEl.textContent = t('profile.passwordTooShort');
    statusEl.className = 'profile-status status-error';
    return;
  }

  btn.disabled = true;
  statusEl.textContent = t('profile.saving');
  statusEl.className = 'profile-status';

  try {
    const user = firebase.auth().currentUser;
    const cred = firebase.auth.EmailAuthProvider.credential(user.email, current);
    await user.reauthenticateWithCredential(cred);
    await user.updatePassword(next);
    currentInput.value = '';
    newInput.value = '';
    statusEl.textContent = `✓ ${t('profile.passwordUpdated')}`;
    statusEl.className = 'profile-status status-ok';
  } catch (err) {
    const code = err.code || '';
    let msg;
    if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') msg = t('profile.passwordWrongCurrent');
    else if (code === 'auth/weak-password') msg = t('auth.err.weakPassword');
    else if (code === 'auth/requires-recent-login') msg = t('profile.passwordReauth');
    else msg = err.message;
    statusEl.textContent = msg;
    statusEl.className = 'profile-status status-error';
  } finally {
    btn.disabled = false;
  }
}

function subscribeToPredictions() {
  if (!state.leagueId) return;
  const leagueId = state.leagueId;
  unsubPredictions = leaguePredictionsCol(leagueId).onSnapshot(
    snap => {
      state.predictionDocs = {};
      snap.forEach(doc => { state.predictionDocs[doc.id] = doc.data(); });
      state.predVersion = (state.predVersion || 0) + 1;

      const myDoc = state.predictionDocs[state.uid];
      const user = firebase.auth().currentUser;
      const myEmail = user?.email || '';
      const nameMismatch = myDoc && state.currentPlayer && myDoc.displayName !== state.currentPlayer;
      const emailMissing = myDoc && myEmail && !myDoc.email;
      if (nameMismatch || emailMissing) {
        const patch = {};
        if (nameMismatch) patch.displayName = state.currentPlayer;
        if (emailMissing) patch.email = myEmail;
        leaguePredictionsCol(leagueId).doc(state.uid).set(patch, { merge: true });
      }

      renderPlayerCard();
      scheduleRenderAll();
    },
    err => showToast(t('toast.predLoadFail', { msg: err.message }))
  );
}

function subscribeToResults() {
  unsubResults = firebase.firestore().collection('results').doc('all').onSnapshot(
    doc => {
      state.results = doc.exists ? (doc.data().results || {}) : {};
      state.resultsVersion = (state.resultsVersion || 0) + 1;
      scheduleRenderAll();
    },
    err => showToast(t('toast.resultsLoadFail', { msg: err.message }))
  );
}

function onProfileUpdated() {
  const user = firebase.auth().currentUser;
  if (!user) return;
  state.currentPlayer = user.displayName || user.email;
  document.getElementById('player-display').textContent = state.currentPlayer;
  renderPlayerCard();
}

function renderPlayerCard() {
  const name = state.currentPlayer || '';
  const initial = getInitials(name);
  const avatar = document.getElementById('player-avatar');
  if (avatar) avatar.textContent = initial;
  const display = document.getElementById('player-display');
  if (display) display.textContent = name;
  const myDoc = state.predictionDocs?.[state.uid] || {};
  const preds = myDoc.predictions || {};
  const total = state.matches.length || 0;
  let exact = 0;
  for (const [id, pred] of Object.entries(preds)) {
    if (pred?.home === undefined || pred?.away === undefined) continue;
    const actual = state.results[id];
    if (!actual) continue;
    if (pred.home === actual.home && pred.away === actual.away) exact++;
  }
  const countEl = document.getElementById('picks-count');
  const totalEl = document.getElementById('picks-total');
  if (countEl) countEl.textContent = exact;
  if (totalEl) totalEl.textContent = total;
}

function renderKnockoutPlayerCard() {
  const view = document.getElementById('view-knockout');
  if (!view || view.classList.contains('hidden')) return;
  const name = state.currentPlayer || '';
  const avatar = document.getElementById('knockout-player-avatar');
  if (avatar) avatar.textContent = getInitials(name);
  const display = document.getElementById('knockout-player-display');
  if (display) display.textContent = name;

  const myDoc = state.knockout.predictionDocs?.[state.uid] || {};
  const preds = myDoc.predictions || {};
  const matches = state.knockout.matches || [];
  let exact = 0;
  for (const m of matches) {
    const pred = preds[m.id];
    const actual = state.knockout.results?.[m.id];
    if (!pred || !actual) continue;
    if (pred.home === actual.home && pred.away === actual.away) exact++;
  }
  const cEl = document.getElementById('knockout-picks-count');
  const tEl = document.getElementById('knockout-picks-total');
  if (cEl) cEl.textContent = exact;
  if (tEl) tEl.textContent = matches.length;
}

let _renderRafId = null;
function scheduleRenderAll() {
  if (_renderRafId) return;
  _renderRafId = requestAnimationFrame(() => {
    _renderRafId = null;
    renderAdminMatches();
    renderLeaderboard();
    renderPredictions();
    renderEveryone();
    if (typeof renderKnockoutBracket === 'function') renderKnockoutBracket();
    renderKnockoutPlayerCard();
    renderHeaderStats();
    renderRules();
  });
}

function refreshDynamicContent() {
  refreshAuthLabels?.();
  _standingsCache = null;
  renderAdminMatches();
  renderLeaderboard();
  renderPredictions();
  renderEveryone();
  if (state.leagueId === null) renderLeagues();
  refreshApiStatus();
  refreshSaveStatus();
  renderHeaderStats();
  renderRules();
  if (typeof renderKnockoutBracket === 'function') renderKnockoutBracket();
  renderKnockoutPlayerCard();
  updateCurrentLeagueBadge();
  renderPlayerCard();
  document.querySelectorAll('.nav-btn.requires-league').forEach(btn => {
    btn.classList.toggle('hidden', !state.leagueId);
  });
}

function bindEvents() {
  initLeaderboardDelegation();
  initPlayerPredModal();

  document.querySelectorAll('.nav-btn[data-view]').forEach(btn =>
    btn.addEventListener('click', () => switchView(btn.dataset.view))
  );

  const leagueBadge = document.getElementById('current-league-badge');
  if (leagueBadge) leagueBadge.addEventListener('click', () => switchView('leagues'));

  document.querySelectorAll('.sub-tab').forEach(btn =>
    btn.addEventListener('click', () => switchSubview(btn.dataset.subtab))
  );

  document.querySelectorAll('.sort-btn').forEach(btn =>
    btn.addEventListener('click', () => setPredictionsSort(btn.dataset.sort))
  );
  document.querySelectorAll('.sort-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.sort === state.predictionsSort);
  });

  document.getElementById('everyone-container')?.addEventListener('click', e => {
    const btn = e.target.closest('[data-expand-players]');
    if (!btn) return;
    const card = btn.closest('.everyone-match-card-grid');
    if (!card) return;
    const expanded = card.classList.toggle('expanded');
    btn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    btn.textContent = expanded ? t('predictions.showFewerPlayers') : (btn.dataset.fullLabel || btn.textContent);
  });

  bindEveryoneSearch();

  document.getElementById('btn-settings').addEventListener('click', () => {
    document.getElementById('settings-panel').classList.toggle('hidden');
  });

  document.getElementById('btn-toggle-key').addEventListener('click', () => {
    const input = document.getElementById('api-key-input');
    input.type = input.type === 'password' ? 'text' : 'password';
  });

  document.getElementById('btn-save-key').addEventListener('click', async () => {
    const key = document.getElementById('api-key-input').value.trim();
    if (!key) return;
    state.apiKey = key;
    Storage.setApiKey(key);
    ApiCache.clear();
    document.getElementById('btn-refresh').disabled = false;
    document.getElementById('settings-panel').classList.add('hidden');
    await loadFromApi(true);
  });

  document.getElementById('btn-refresh').addEventListener('click', () => loadFromApi(true));
  document.getElementById('btn-save-results').addEventListener('click', saveResults);

  const demoToggle = document.getElementById('knockout-demo-toggle');
  if (demoToggle) {
    demoToggle.checked = Storage.getKnockoutDemo();
    demoToggle.addEventListener('change', async () => {
      Storage.setKnockoutDemo(demoToggle.checked);
      if (typeof KnockoutApiCache !== 'undefined') KnockoutApiCache.clear();
      if (state.leagueType === 'knockout') {
        await refreshKnockoutMatches();
        if (typeof renderKnockoutBracket === 'function') renderKnockoutBracket();
      }
      showToast(t(demoToggle.checked ? 'knockout.demoOn' : 'knockout.demoOff'));
    });
  }

  if (typeof bindKnockoutEvents === 'function') bindKnockoutEvents();
  document.getElementById('btn-update-name').addEventListener('click', updateDisplayName);
  document.getElementById('btn-change-password').addEventListener('click', changePassword);
  document.querySelectorAll('.password-eye[data-toggle-target]').forEach(btn => {
    btn.addEventListener('click', () => togglePasswordVisibility(btn.dataset.toggleTarget));
  });
  document.getElementById('btn-profile-signout').addEventListener('click', () => firebase.auth().signOut());
  document.getElementById('btn-header-signout').addEventListener('click', () => firebase.auth().signOut());
  document.getElementById('profile-name-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') updateDisplayName();
  });

  document.getElementById('matches-container').addEventListener('input', e => {
    if (!e.target.classList.contains('score-input')) return;
    if (arePredictionsLocked()) return;
    scheduleAutosave();
  });

  const importBtn = document.getElementById('btn-import-predictions');
  const importInput = document.getElementById('import-file-input');
  if (importBtn && importInput) {
    importBtn.addEventListener('click', () => {
      if (arePredictionsLocked()) { showToast(t('predictions.importLocked')); return; }
      importInput.click();
    });
    importInput.addEventListener('change', e => {
      const file = e.target.files && e.target.files[0];
      if (file) handleImportFile(file);
      e.target.value = '';
    });
  }

  document.getElementById('matches-container').addEventListener('click', e => {
    const btn = e.target.closest('.group-reset-btn');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    if (arePredictionsLocked()) return;
    const group = btn.dataset.resetGroup;
    if (!group) return;
    const confirmMsg = t('predictions.resetGroupConfirm', { letter: group });
    if (!window.confirm(confirmMsg)) return;
    const groupMatchIds = new Set(state.matches.filter(m => m.group === group).map(m => m.id));
    document.querySelectorAll('#view-predictions .score-input').forEach(input => {
      if (groupMatchIds.has(input.dataset.match)) input.value = '';
    });
    scheduleAutosave();
  });
}

function scheduleAutosave() {
  if (autosaveTimer) clearTimeout(autosaveTimer);
  setAutosaveStatus('editing');
  autosaveTimer = setTimeout(runAutosave, 600);
}

let autosaveRetries = 0;
const AUTOSAVE_MAX_RETRIES = 10;

async function runAutosave() {
  if (!state.uid || !state.leagueId || isSaving) return;

  // League doc still loading after sign-in — retry briefly before giving up
  // so users typing immediately after sign-in don't lose their input.
  if (!state.currentLeague) {
    if (autosaveRetries++ < AUTOSAVE_MAX_RETRIES) {
      autosaveTimer = setTimeout(runAutosave, 500);
      return;
    }
    autosaveRetries = 0;
    setAutosaveStatus('error', t('predictions.saveLeagueMissing'));
    return;
  }
  autosaveRetries = 0;

  if (arePredictionsLocked()) {
    setAutosaveStatus('error', t('predictions.saveLocked'));
    return;
  }

  const preds = {};
  document.querySelectorAll('#view-predictions .score-input').forEach(input => {
    const { match, side } = input.dataset;
    if (!preds[match]) preds[match] = {};
    if (input.value !== '') {
      const val = parseInt(input.value, 10);
      if (!isNaN(val) && val >= 0) preds[match][side] = val;
    }
  });

  const cleaned = Object.fromEntries(
    Object.entries(preds).filter(([, p]) => p.home !== undefined && p.away !== undefined)
  );

  // Defensive: if the matches DOM hasn't rendered yet, cleaned will be empty.
  // A full overwrite would wipe the user's saved predictions — bail instead.
  const expectedInputs = (state.matches?.length || 0) * 2;
  const actualInputs = document.querySelectorAll('#view-predictions .score-input').length;
  if (expectedInputs > 0 && actualInputs < expectedInputs) {
    console.warn('[autosave] DOM not fully rendered, skipping to avoid wiping data',
      { expected: expectedInputs, actual: actualInputs });
    return;
  }

  const user = firebase.auth().currentUser;
  const displayName = user?.displayName || user?.email || state.currentPlayer;
  const email = user?.email || '';

  isSaving = true;
  setAutosaveStatus('saving');
  try {
    await leaguePredictionsCol(state.leagueId).doc(state.uid).set({
      displayName,
      email,
      predictions: cleaned,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    setAutosaveStatus('saved');
  } catch (err) {
    console.error('[autosave] save failed:', err);
    setAutosaveStatus('error', err.message);
  } finally {
    isSaving = false;
  }
}

function setAutosaveStatus(stateName, errMsg) {
  const el = document.getElementById('autosave-indicator');
  if (!el) return;
  if (autosaveStatusTimer) { clearTimeout(autosaveStatusTimer); autosaveStatusTimer = null; }
  el.classList.remove('status-editing', 'status-saving', 'status-saved', 'status-error');
  el.dataset.state = stateName;
  switch (stateName) {
    case 'editing':
      el.classList.add('status-editing');
      el.innerHTML = `<span class="autosave-dot"></span> ${t('predictions.editing')}`;
      break;
    case 'saving':
      el.classList.add('status-saving');
      el.innerHTML = `<span class="autosave-spinner"></span> ${t('predictions.saving')}`;
      break;
    case 'saved':
      el.classList.add('status-saved');
      el.innerHTML = `<span class="autosave-check">✓</span> ${t('predictions.allSaved')}`;
      autosaveStatusTimer = setTimeout(() => {
        if (el.dataset.state === 'saved') { el.textContent = ''; el.classList.remove('status-saved'); }
      }, 2500);
      break;
    case 'error':
      el.classList.add('status-error');
      el.textContent = '⚠ ' + t('predictions.saveFailed', { msg: errMsg || '' });
      break;
    default:
      el.textContent = '';
  }
}

async function loadFromApi(force = false, maxAgeMs) {
  if (!hasApiAccess()) { showApiStatus('settings.noKey', 'warn'); return; }

  setRefreshing(true);
  showApiStatus('settings.loading', 'info');

  try {
    const data = await loadWorldCupData(state.apiKey, force, maxAgeMs);

    state.groups  = data.groups;
    state.matches = data.matches;
    state.crests  = data.crests || {};

    const apiResults = {};
    for (const m of data.matches) {
      if (m.result) apiResults[m.id] = m.result;
    }
    if (Object.keys(apiResults).length > 0) {
      // Merge into local state so every user sees fresh scores without
      // waiting for admin to push to Firestore.
      state.results = { ...state.results, ...apiResults };
      state.resultsVersion = (state.resultsVersion || 0) + 1;

      // Admin propagates to Firestore as the canonical source for the league.
      if (isAdmin()) {
        await firebase.firestore().collection('results').doc('all').set({
          results: state.results,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
      }
    }

    lastRefreshTs = ApiCache.timestamp() || Date.now();
    showLastRefreshed();

    renderAdminMatches();
    renderLeaderboard();
    renderPredictions();
    renderEveryone();

    maybeAdjustLivePolling();

  } catch (err) {
    showApiStatus('settings.error', 'error', { msg: err.message });
  } finally {
    setRefreshing(false);
  }
}

// Poll ESPN's public WC scoreboard every LIVE_POLL_MS while any match is in
// its live window AND the user is on predictions/leaderboard AND the tab is
// visible. football-data's free tier doesn't flip IN_PLAY reliably, so we
// gate on the match's scheduled time and pull live scores from ESPN.
// football-data still owns schedule + final scores. 15s keeps updates feeling
// real-time without hammering ESPN (admin tabs additionally fan out via
// Firestore, so most clients see changes through the snapshot listener).
const LIVE_POLL_MS = 15 * 1000;
const LIVE_WINDOW_MS = 3 * 60 * 60 * 1000; // ~3h after kickoff covers extra time + delays
let livePollTimer = null;

function isAnyMatchInLiveWindow() {
  const allMatches = [...(state.matches || []), ...(state.knockout?.matches || [])];
  if (!allMatches.length) return false;
  const now = Date.now();
  return allMatches.some(m => {
    if (m.status === 'FINISHED') return false;
    const start = new Date(m.utcDate).getTime();
    return Number.isFinite(start) && start <= now && now <= start + LIVE_WINDOW_MS;
  });
}

function findMatchByLiveTeams(home, away) {
  const h = normTeamName(home);
  const a = normTeamName(away);
  if (!h || !a) return null;
  const finder = m => {
    const mh = new Set(expandTeamAliases(m.home).map(normTeamName));
    const ma = new Set(expandTeamAliases(m.away).map(normTeamName));
    return (mh.has(h) && ma.has(a)) || (mh.has(a) && ma.has(h));
  };
  const groupMatch = (state.matches || []).find(finder);
  if (groupMatch) return { match: groupMatch, knockout: false };
  const koMatch = (state.knockout?.matches || []).find(finder);
  if (koMatch) return { match: koMatch, knockout: true };
  return null;
}

async function pollLiveScores() {
  let live;
  try {
    live = await loadLiveScores();
  } catch (err) {
    console.warn('[live] ESPN fetch failed:', err.message);
    return;
  }
  if (!live.length) return;
  let changed = false;
  let koChanged = false;
  for (const ev of live) {
    const found = findMatchByLiveTeams(ev.home, ev.away);
    if (!found) { console.warn('[live] no match for', ev.home, 'vs', ev.away); continue; }
    const { match, knockout } = found;
    const start = new Date(match.utcDate).getTime();
    if (!Number.isFinite(start) || Date.now() < start - 10 * 60 * 1000 || Date.now() > start + LIVE_WINDOW_MS) {
      console.warn('[live] ignoring out-of-window event for', match.home, 'vs', match.away);
      continue;
    }
    const matchHomeKeys = new Set(expandTeamAliases(match.home).map(normTeamName));
    const swap = !matchHomeKeys.has(normTeamName(ev.home));
    const home = swap ? ev.awayScore : ev.homeScore;
    const away = swap ? ev.homeScore : ev.awayScore;

    if (knockout) {
      const koResults = state.knockout.results || {};
      const cur = koResults[match.id];
      if (!cur || cur.home !== home || cur.away !== away) {
        state.knockout.results = { ...koResults, [match.id]: { home, away } };
        koChanged = true;
      }
    } else {
      const cur = state.results[match.id];
      if (!cur || cur.home !== home || cur.away !== away) {
        state.results[match.id] = { home, away };
        changed = true;
      }
    }
    if (state.matchStatus[match.id] !== ev.state) {
      state.matchStatus[match.id] = ev.state;
      changed = true;
      if (knockout) koChanged = true;
    }
  }
  if (changed) {
    state.resultsVersion = (state.resultsVersion || 0) + 1;
    scheduleRenderAll();
    if (isAdmin()) {
      firebase.firestore().collection('results').doc('all').set({
        results: state.results,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      }, { merge: true }).catch(err => console.warn('[live] fanout failed:', err.message));
    }
  }
  if (koChanged) {
    state.knockout.resultsVersion = (state.knockout.resultsVersion || 0) + 1;
    scheduleRenderAll();
    if (isAdmin()) {
      firebase.firestore().collection('knockoutResults').doc('all').set({
        results: state.knockout.results,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      }, { merge: true }).catch(err => console.warn('[live] ko fanout failed:', err.message));
    }
    // When a knockout match finishes, refresh from football-data for official data
    const anyFinished = live.some(ev => ev.state === 'post' && findMatchByLiveTeams(ev.home, ev.away)?.knockout);
    if (anyFinished) setTimeout(refreshKnockoutMatches, 30_000);
  }
}

function maybeAdjustLivePolling() {
  const viewActive = state.view === 'predictions' || state.view === 'leaderboard' || state.view === 'knockout';
  const visible = document.visibilityState === 'visible';
  const shouldPoll = isAnyMatchInLiveWindow() && viewActive && visible && !!state.uid;
  if (shouldPoll && !livePollTimer) {
    pollLiveScores(); // fire immediately so users don't wait 60s for first tick
    livePollTimer = setInterval(pollLiveScores, LIVE_POLL_MS);
  } else if (!shouldPoll && livePollTimer) {
    clearInterval(livePollTimer);
    livePollTimer = null;
  }
  maybeAdjustKnockoutRefresh();
}

// Periodically refresh knockout fixtures from football-data (every 5 min)
// to pick up newly resolved team names and official final results.
const KO_REFRESH_MS = 5 * 60 * 1000;
let koRefreshTimer = null;

function maybeAdjustKnockoutRefresh() {
  const shouldRefresh = state.leagueType === 'knockout' &&
    document.visibilityState === 'visible' && !!state.uid;
  if (shouldRefresh && !koRefreshTimer) {
    koRefreshTimer = setInterval(refreshKnockoutMatches, KO_REFRESH_MS);
  } else if (!shouldRefresh && koRefreshTimer) {
    clearInterval(koRefreshTimer);
    koRefreshTimer = null;
  }
}

function setRefreshing(loading) {
  const btn = document.getElementById('btn-refresh');
  btn.disabled = loading;
  btn.textContent = loading ? t('settings.refreshing') : t('settings.refresh');
}

function showApiStatus(key, type, vars) {
  lastApiStatus = { key, type, vars };
  const el = document.getElementById('api-status');
  el.textContent = key ? t(key, vars) : '';
  el.className = `api-status status-${type}`;
}

function showLastRefreshed() {
  if (!lastRefreshTs) return;
  showApiStatus('settings.lastRefreshed', 'ok', { time: formatTimeAgo(lastRefreshTs) });
}

function refreshApiStatus() {
  if (!lastApiStatus) return;
  if (lastApiStatus.key === 'settings.lastRefreshed' && lastRefreshTs) {
    showLastRefreshed();
  } else {
    showApiStatus(lastApiStatus.key, lastApiStatus.type, lastApiStatus.vars);
  }
}

function isViewActive(viewId) {
  const el = document.getElementById(viewId);
  return !!el && !el.classList.contains('hidden');
}

function isSubviewActive(subviewId) {
  const el = document.getElementById(subviewId);
  return !!el && !el.classList.contains('hidden');
}

function formatTimeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60)   return t('time.justNow');
  if (s < 3600) return t('time.minutes', { n: Math.floor(s / 60) });
  return t('time.hours', { n: Math.floor(s / 3600) });
}

function switchView(view) {
  if ((view === 'predictions' || view === 'leaderboard' || view === 'knockout') && !state.leagueId) {
    view = 'leagues';
  }
  if (view === 'knockout' && state.leagueType !== 'knockout') view = 'predictions';
  if (view === 'predictions' && state.leagueType === 'knockout') view = 'knockout';
  closePlayerPredictionsModal();
  state.view = view;
  Storage.setLastView(view);
  const htmlEl = document.documentElement;
  const wasPrepainted = htmlEl.classList.contains('preview-view-' + view);

  // Add hidden to all views BEFORE dropping the prepaint shield. Otherwise
  // we expose a microframe where the default CSS shows whichever view is
  // not marked hidden in index.html, producing a visible flash on refresh.
  document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
  const target = document.getElementById(`view-${view}`);
  target.classList.remove('hidden');

  htmlEl.classList.remove('auth-prepaint-signed-in');
  htmlEl.className = htmlEl.className.replace(/\bpreview-view-\S+/g, '').trim();

  if (!wasPrepainted) playEnterAnimation(target);
  document.querySelectorAll('.nav-btn[data-view]').forEach(btn =>
    btn.classList.toggle('active', btn.dataset.view === view)
  );
  if (view === 'leaderboard') { state._leaderboardScrollPending = true; renderLeaderboard(); }
  if (view === 'predictions') { state._predictionsScrollPending = true; renderPredictions(); renderEveryone(); }
  if (view === 'knockout') {
    if (typeof renderKnockoutBracket === 'function') renderKnockoutBracket();
    renderKnockoutPlayerCard();
  }
  if (view === 'leagues') { loadPublicLeagues().then(renderLeagues); }
  if (view === 'profile') renderProfileLeagues();

  // Auto-refresh API data when entering predictions/leaderboard. ApiCache
  // (5min TTL) prevents hammering; admin's call additionally fans out to
  // Firestore so others' onSnapshot picks up the new results.
  if ((view === 'predictions' || view === 'leaderboard') && hasApiAccess()) {
    const lastTs = ApiCache.timestamp();
    const cacheFresh = lastTs && (Date.now() - lastTs < ApiCache.ttl);
    if (!cacheFresh) loadFromApi(false).catch(() => { /* errors surface via api-status pill */ });
  }

  maybeAdjustLivePolling();
}

function switchSubview(name) {
  document.querySelectorAll('.sub-tab').forEach(tab =>
    tab.classList.toggle('active', tab.dataset.subtab === name)
  );
  document.querySelectorAll('.subview').forEach(s => {
    const shouldShow = s.id === `subview-${name}`;
    s.classList.toggle('hidden', !shouldShow);
    if (shouldShow) playEnterAnimation(s);
  });
  const stickyHeader = document.querySelector('.predictions-sticky-header');
  if (stickyHeader) stickyHeader.dataset.subtab = name;
  if (name === 'everyone') { state._predictionsScrollPending = true; renderEveryone(); }
  if (name === 'mine')     { state._predictionsScrollPending = true; renderPredictions(); }
}

function setPredictionsSort(sort) {
  if (sort !== 'group' && sort !== 'date') return;
  if (state.predictionsSort === sort) return;
  state.predictionsSort = sort;
  Storage.setPredictionsSort(sort);
  document.querySelectorAll('.sort-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.sort === sort);
  });
  state.predictionsRendered = false;
  state.everyoneRendered = false;
  state._predictionsScrollPending = true;
  renderPredictions();
  renderEveryone();
}

function currentMatchId() {
  if (!state.matches || state.matches.length === 0) return null;
  for (const m of state.matches) {
    if (matchLiveState(m) === 'live') return m.id;
  }
  const now = Date.now();
  let next = null, nextT = Infinity;
  for (const m of state.matches) {
    const t = new Date(m.utcDate).getTime();
    if (!isFinite(t)) continue;
    if (t >= now && t < nextT) { next = m; nextT = t; }
  }
  if (next) return next.id;
  let last = null, lastT = -Infinity;
  for (const m of state.matches) {
    const t = new Date(m.utcDate).getTime();
    if (!isFinite(t)) continue;
    if (t > lastT) { last = m; lastT = t; }
  }
  return last ? last.id : null;
}

function scrollToCurrentMatch(containerId) {
  const mid = currentMatchId();
  if (!mid) return;
  requestAnimationFrame(() => {
    const root = document.getElementById(containerId);
    if (!root) return;
    const card = root.querySelector(`[data-match-id="${mid}"]`);
    if (!card) return;
    const group = card.closest('details[data-group]');
    if (group && !group.open) group.open = true;
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
}

function playEnterAnimation(el) {
  el.classList.remove('view-enter');
  void el.offsetWidth;
  el.classList.add('view-enter');
}

function skeletonMatchCards(n = 4) {
  const card = `
    <div class="match-card skeleton">
      <div class="match-card-header">
        <span class="match-card-teams">
          <span class="skel-bar skel-team"></span>
          <span class="skel-bar skel-team"></span>
        </span>
        <span class="match-card-meta">
          <span class="skel-bar skel-badge"></span>
        </span>
      </div>
      <div class="match-card-body">
        <div class="score-row">
          <span class="skel-bar skel-label"></span>
          <span class="skel-bar skel-score"></span>
          <span class="vs">−</span>
          <span class="skel-bar skel-score"></span>
        </div>
      </div>
    </div>`;
  return Array(n).fill(card).join('');
}

function renderRules() {
  const groupsEl = document.getElementById('rules-groups');
  const knockoutEl = document.getElementById('rules-knockout');
  if (!groupsEl || !knockoutEl) return;
  const isKO = state.leagueType === 'knockout';
  groupsEl.classList.toggle('hidden', isKO);
  knockoutEl.classList.toggle('hidden', !isKO);
}

function renderPredictions() {
  if (!state.uid) return;
  if (!isViewActive('view-predictions') || !isSubviewActive('subview-mine')) return;
  const container = document.getElementById('matches-container');
  if (!container) return;

  if (state.matches.length === 0) {
    container.innerHTML = skeletonMatchCards(4);
    return;
  }

  const draft = captureCurrentInputDraft();
  const focused = document.activeElement;
  const focusInfo = (focused && focused.classList.contains('score-input'))
    ? { match: focused.dataset.match, side: focused.dataset.side }
    : null;

  const myDoc = state.predictionDocs[state.uid] || {};
  const preds = myDoc.predictions || {};

  const sections = predictionSections();
  const openPredictionGroups = captureOpenGroups('matches-container');
  const predictionsFirstRender = !state.predictionsRendered;
  state.predictionsRendered = true;
  const defaultOpenKey = defaultOpenSectionKey(sections);
  const defaultShifted = state._predictionsLastDefaultKey !== defaultOpenKey;
  state._predictionsLastDefaultKey = defaultOpenKey;

  container.innerHTML = sections.map(section => {
    const matches = section.matches;
    const isOpen = isMobileViewport()
      ? section.key === defaultOpenKey
      : (predictionsFirstRender
          ? section.key === defaultOpenKey
          : (openPredictionGroups.has(section.key) || (defaultShifted && section.key === defaultOpenKey)));
    const resetBtn = (section.letter && !arePredictionsLocked())
      ? `<button type="button" class="group-reset-btn" data-reset-group="${section.letter}" title="${t('predictions.resetGroup')}">${t('predictions.resetGroup')}</button>`
      : '';
    let sectionPts = 0;
    let sectionPredicted = 0;
    for (const m of matches) {
      const p = preds[m.id];
      if (p && p.home !== undefined && p.away !== undefined) {
        sectionPredicted++;
        const actual = state.results[m.id];
        if (actual) sectionPts += calcPoints(p, actual);
      }
    }
    const headerInner = section.letter
      ? `<span class="group-letter-badge">${section.letter}</span>
         <span class="group-letter-text">${section.title}</span>
         <span class="group-teams">${section.teams.map(name => `<span class="group-team-chip">${teamFlag(name)}<span>${tCountry(name)}</span></span>`).join('<span class="group-team-sep">·</span>')}</span>`
      : `<span class="date-section-title">${section.title}</span>
         <span class="group-teams date-teams">${(section.teams || []).map(name => `<span class="group-team-chip" title="${escapeHtml(tCountry(name))}">${teamFlag(name)}</span>`).join('')}</span>`;
    return `
      <details class="prediction-group" data-group="${section.key}"${isOpen ? ' open' : ''}>
        <summary class="prediction-group-title">
          ${headerInner}
          <span class="group-stats">
            <span class="group-stats-pts">${sectionPts} ${t('header.points')}</span>
            <span class="group-stats-sep">·</span>
            <span class="group-stats-predicted">${sectionPredicted}/${matches.length}</span>
          </span>
          <svg class="group-chevron" viewBox="0 0 12 12" aria-hidden="true">
            <path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </summary>
        <div class="prediction-group-rows">
          ${matches.map(m => matchCard(m, preds[m.id], state.results[m.id])).join('')}
        </div>
        ${resetBtn ? `<div class="prediction-group-footer">${resetBtn}</div>` : ''}
      </details>`;
  }).join('');

  snapshotStateRender();
  restoreInputDraft(draft);
  if (focusInfo) {
    const sel = `.score-input[data-match="${focusInfo.match}"][data-side="${focusInfo.side}"]`;
    document.querySelector(sel)?.focus();
  }

  if (state._predictionsScrollPending && isSubviewActive('subview-mine')) {
    state._predictionsScrollPending = false;
    scrollToCurrentMatch('matches-container');
  }

  refreshSaveStatus();
}

function refreshSaveStatus() {
  const el = document.getElementById('save-status');
  if (!el) return;
  if (!state.uid) { el.textContent = ''; return; }
  const myDoc = state.predictionDocs[state.uid] || {};
  const preds = myDoc.predictions || {};
  const count = Object.keys(preds).length;
  el.textContent = count > 0
    ? t('predictions.count', { count, total: state.matches.length })
    : '';
}

function matchLiveState(match) {
  const live = state.matchStatus[match.id];
  if (live === 'in') return 'live';
  if (live === 'post' || match.status === 'FINISHED') return 'ft';
  if (match.status === 'IN_PLAY' || match.status === 'PAUSED') return 'live';
  return null;
}

function matchCard(match, pred = {}, result) {
  const hasPred = pred.home !== undefined && pred.away !== undefined;
  const pts = (result && hasPred) ? calcPoints(pred, result) : null;

  const lockAttr = arePredictionsLocked() ? 'disabled' : '';
  const { day, time } = formatMatchDateParts(match.utcDate);
  const venue = displayVenue(venueForMatch(match));
  const playerInitial = getInitials(state.currentPlayer);

  const rowClass = pts >= 3 ? 'predict-row pts-exact'
                 : pts === 1 ? 'predict-row pts-partial'
                 : pts === 0 ? 'predict-row pts-miss'
                 : 'predict-row';

  const liveState = matchLiveState(match);
  const statusLabel = liveState === 'live' ? t('match.live')
                    : liveState === 'ft'   ? t('match.ft')
                    : t('match.actual');
  const liveClass = liveState === 'live' ? ' status-live' : '';

  const isLive = liveState === 'live';
  const liveMetaPill = isLive
    ? `<span class="meta-sep">·</span><span class="meta-live-pill"><span class="meta-live-dot" aria-hidden="true"></span>${t('match.live')}</span>`
    : '';
  const statusIcon = result === undefined || result === null
    ? `<span class="actual-status status-tbd">${t('match.tbd')}</span>`
    : isLive
      ? ''
      : pts >= 3
        ? `<span class="actual-status status-label status-exact${liveClass}">${statusLabel}</span>`
        : pts === 1
          ? `<span class="actual-status status-label status-partial${liveClass}">${statusLabel}</span>`
          : pts === 0
            ? `<span class="actual-status status-label status-miss${liveClass}">${statusLabel}</span>`
            : `<span class="actual-status status-label status-neutral${liveClass}">${statusLabel}</span>`;

  const actualNumsHtml = result
    ? `<span class="actual-num">${result.home}</span>
       <span class="actual-dash">−</span>
       <span class="actual-num">${result.away}</span>`
    : `<span class="actual-num actual-empty">?</span>
       <span class="actual-dash">−</span>
       <span class="actual-num actual-empty">?</span>`;

  const ptsBadge = pts !== null
    ? `<span class="pts-badge pts-badge-${pts}">+${pts}</span>`
    : '';

  return `
    <div class="${rowClass}" data-match-id="${match.id}">
      <div class="match-meta-line">
        <span class="meta-day">${day}</span>
        <span class="meta-sep">·</span>
        <span class="meta-time">${time}</span>
        ${venue ? `<span class="meta-sep">·</span><span class="meta-venue">${escapeHtml(venue)}</span>` : ''}
        ${liveMetaPill}
      </div>

      <div class="match-teams">
        <span class="team home">${teamLabel(match.home, 'left')}</span>
        <span class="team-vs">${t('match.vs')}</span>
        <span class="team away">${teamLabel(match.away, 'right')}</span>
      </div>

      <div class="match-scoreboard">
        <div class="my-pick">
          <span class="my-pick-avatar">${escapeHtml(playerInitial)}</span>
          <input class="score-input" type="number" min="0" max="30" inputmode="numeric"
                 data-match="${match.id}" data-side="home" value="${pred.home ?? ''}" ${lockAttr}>
          <span class="vs">−</span>
          <input class="score-input" type="number" min="0" max="30" inputmode="numeric"
                 data-match="${match.id}" data-side="away" value="${pred.away ?? ''}" ${lockAttr}>
        </div>
        <div class="actual-side${isLive ? ' is-live' : ''}">
          ${statusIcon}
          ${actualNumsHtml}
          ${ptsBadge}
        </div>
      </div>
    </div>`;
}

function formatStatus(status) {
  if (status === 'FINISHED') return 'FT';
  if (status === 'IN_PLAY')  return 'LIVE';
  if (status === 'PAUSED')   return 'HT';
  return status;
}

function renderEveryone() {
  const container = document.getElementById('everyone-container');
  if (!container) return;
  if (!isViewActive('view-predictions') || !isSubviewActive('subview-everyone')) return;

  if (state.matches.length === 0) {
    container.innerHTML = skeletonMatchCards(4);
    return;
  }

  const participants = Object.entries(state.predictionDocs);
  if (participants.length === 0) {
    container.innerHTML = `<div class="empty-state">${t('predictions.noOthers')}</div>`;
    return;
  }

  const filterRaw = (state.everyoneFilter || '').trim();
  const filterLc = filterRaw.toLowerCase();
  const filterActive = filterLc.length > 0;

  // Pre-index participants by match: avoids re-filtering all participants
  // for each of the 72 group-stage matches inside everyoneMatchBlock.
  const participantsByMatch = {};
  for (const entry of participants) {
    const preds = entry[1].predictions || {};
    const name = (entry[1].displayName || '').toLowerCase();
    const matchesFilter = !filterActive || name.includes(filterLc);
    if (filterActive && !matchesFilter) continue;
    for (const mid of Object.keys(preds)) {
      (participantsByMatch[mid] ||= []).push(entry);
    }
  }

  if (filterActive && Object.keys(participantsByMatch).length === 0) {
    container.innerHTML = `<div class="empty-state">${t('predictions.searchNoMatches', { q: escapeHtml(filterRaw) })}</div>`;
    return;
  }

  const sections = predictionSections();
  const openEveryoneGroups = captureOpenGroups('everyone-container');
  const openMatchCards = captureOpenMatchCards('everyone-container');
  const everyoneFirstRender = !state.everyoneRendered;
  state.everyoneRendered = true;
  const seenMatches = state._everyoneSeenMatches ||= new Set();
  const defaultOpenKey = defaultOpenSectionKey(sections);
  const everyoneShifted = state._everyoneLastDefaultKey !== defaultOpenKey;
  state._everyoneLastDefaultKey = defaultOpenKey;

  const topUids = computeStandings().slice(0, 3).map(s => s.uid);

  container.innerHTML = sections.map(section => {
    const matches = section.matches;
    const sectionMatches = filterActive
      ? matches.filter(m => (participantsByMatch[m.id] || []).length > 0)
      : matches;
    if (filterActive && sectionMatches.length === 0) return '';
    const isOpen = filterActive
      ? true
      : (isMobileViewport()
          ? section.key === defaultOpenKey
          : (everyoneFirstRender
              ? section.key === defaultOpenKey
              : (openEveryoneGroups.has(section.key) || (everyoneShifted && section.key === defaultOpenKey))));
    const headerInner = section.letter
      ? `<h2>${section.title}</h2>
         <span class="group-teams">${section.teams.map(name => `<span class="group-team-chip">${teamFlag(name)}<span>${tCountry(name)}</span></span>`).join('<span class="group-team-sep">·</span>')}</span>`
      : `<h2>${section.title}</h2>
         <span class="group-teams date-teams">${(section.teams || []).map(name => `<span class="group-team-chip" title="${escapeHtml(tCountry(name))}">${teamFlag(name)}</span>`).join('')}</span>`;
    return `
      <details class="group-section" data-group="${section.key}"${isOpen ? ' open' : ''}>
        <summary class="group-header">
          ${headerInner}
          <svg class="group-chevron" viewBox="0 0 12 12" aria-hidden="true">
            <path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </summary>
        <div class="group-section-rows">
          ${sectionMatches.map(m => everyoneMatchBlock(m, participantsByMatch[m.id] || [], { filterActive, openMatchCards, seenMatches, topUids })).join('')}
        </div>
      </details>`;
  }).join('');

  // Mark every rendered match as seen so subsequent renders honor user toggles
  // instead of re-applying the FT auto-collapse rule.
  for (const m of state.matches) seenMatches.add(m.id);

  centerSelfInPlayersScrolls('everyone-container');

  if (state._predictionsScrollPending && isSubviewActive('subview-everyone')) {
    state._predictionsScrollPending = false;
    scrollToCurrentMatch('everyone-container');
  }
}

function centerSelfInPlayersScrolls(containerId) {
  const root = document.getElementById(containerId);
  if (!root) return;
  requestAnimationFrame(() => {
    root.querySelectorAll('.match-players-scroll').forEach(scroller => {
      const self = scroller.querySelector('.everyone-player-row.is-self');
      if (!self) return;
      const sRect = scroller.getBoundingClientRect();
      const tRect = self.getBoundingClientRect();
      const offsetWithin = (tRect.top - sRect.top) + scroller.scrollTop;
      const target = offsetWithin - (scroller.clientHeight / 2) + (self.clientHeight / 2);
      scroller.scrollTop = Math.max(0, target);
    });
  });
}

function captureOpenGroups(containerId) {
  const open = new Set();
  document.querySelectorAll(`#${containerId} details[data-group]`).forEach(el => {
    if (el.open) open.add(el.dataset.group);
  });
  return open;
}

function captureOpenMatchCards(containerId) {
  const open = new Set();
  document.querySelectorAll(`#${containerId} details[data-match-id]`).forEach(el => {
    if (el.open) open.add(el.dataset.matchId);
  });
  return open;
}

let _everyoneSearchDebounce = null;
function bindEveryoneSearch() {
  const input = document.getElementById('everyone-search-input');
  const clearBtn = document.getElementById('everyone-search-clear');
  if (!input || !clearBtn) return;

  const apply = (raw) => {
    const next = (raw || '').trim();
    state.everyoneFilter = next;
    clearBtn.classList.toggle('hidden', next.length === 0);
    renderEveryone();
  };

  input.addEventListener('input', (e) => {
    const v = e.target.value;
    if (_everyoneSearchDebounce) clearTimeout(_everyoneSearchDebounce);
    _everyoneSearchDebounce = setTimeout(() => apply(v), 120);
  });

  clearBtn.addEventListener('click', () => {
    input.value = '';
    if (_everyoneSearchDebounce) clearTimeout(_everyoneSearchDebounce);
    apply('');
    input.focus();
  });
}

function everyoneMatchBlock(match, participants, ctx) {
  const result = state.results[match.id];
  const liveState = matchLiveState(match);

  const headerRight = result
    ? `<span class="everyone-ft-pill${liveState === 'live' ? ' is-live' : ''}"><span class="ft-label">${liveState === 'live' ? t('match.live') : t('match.ft')}</span> <span class="ft-score">${result.home}<span class="ft-dash">−</span>${result.away}</span></span>`
    : (liveState === 'live'
        ? `<span class="match-status status-in_play">${t('match.live')}</span>`
        : '');

  const topUids = (ctx && ctx.topUids) || [];
  const topSet = new Set(topUids);
  const sortedParticipants = [...participants].sort((a, b) => {
    if (result) {
      const aPts = calcPoints(a[1].predictions[match.id], result) ?? 0;
      const bPts = calcPoints(b[1].predictions[match.id], result) ?? 0;
      if (aPts !== bPts) return bPts - aPts;
    }
    const aTopIdx = topUids.indexOf(a[0]);
    const bTopIdx = topUids.indexOf(b[0]);
    if (aTopIdx !== -1 || bTopIdx !== -1) {
      if (aTopIdx === -1) return 1;
      if (bTopIdx === -1) return -1;
      return aTopIdx - bTopIdx;
    }
    if (a[0] === state.uid) return -1;
    if (b[0] === state.uid) return 1;
    return 0;
  });

  const rows = sortedParticipants.map(([uid, doc]) => {
    const pred = doc.predictions[match.id];
    const pts = result ? calcPoints(pred, result) : null;
    const isSelf = uid === state.uid;
    const isTop = topSet.has(uid);
    const isScorer = pts !== null && pts > 0;
    const isPriority = isSelf || isTop || isScorer;
    const name = doc.displayName || t('toast.unknown');
    const initials = getInitials(name);
    const avatarHue = isSelf ? 145 : hashHue(uid);
    const ptsBadge = pts !== null
      ? `<span class="everyone-pts-badge pts-badge-${pts}">${pts > 0 ? '+' : ''}${pts}</span>`
      : '';
    return `
      <div class="everyone-player-row${isSelf ? ' is-self' : ''}${isPriority ? ' is-priority' : ''}">
        <span class="everyone-avatar" style="--avatar-hue:${avatarHue}">${escapeHtml(initials)}</span>
        <span class="everyone-player-info">
          <span class="everyone-player-name">${escapeHtml(name)}</span>
          ${isSelf ? `<span class="everyone-you-tag">${t('match.you')}</span>` : ''}
        </span>
        <span class="everyone-prediction">${pred.home}<span class="ft-dash">−</span>${pred.away}</span>
        ${ptsBadge}
      </div>`;
  });

  const { day, time } = formatMatchDateParts(match.utcDate);
  const venue = displayVenue(venueForMatch(match));

  return `
    <div class="everyone-match-card-grid" data-match-id="${match.id}">
      <div class="everyone-match-header">
        <span class="everyone-match-teams">
          ${teamFlag(match.home)}
          <span class="everyone-team-name">${tCountry(match.home)}</span>
          <span class="everyone-vs">${t('match.vs')}</span>
          <span class="everyone-team-name">${tCountry(match.away)}</span>
          ${teamFlag(match.away)}
        </span>
        ${headerRight ? `<span class="everyone-match-meta-right">${headerRight}</span>` : ''}
      </div>
      <div class="everyone-match-meta">
        <span class="meta-day">${day}</span>
        <span class="meta-sep">·</span>
        <span class="meta-time">${time}</span>
        ${venue ? `<span class="meta-sep">·</span><span class="meta-venue">${escapeHtml(venue)}</span>` : ''}
      </div>
      <div class="match-players-scroll">
        ${rows.length > 0
          ? rows.join('')
          : `<div class="empty-state-small">${t('predictions.noPredsForMatch')}</div>`}
      </div>
      ${sortedParticipants.some(([uid]) => uid !== state.uid && !topSet.has(uid))
        ? `<button type="button" class="show-all-players" data-expand-players data-full-label="${escapeHtml(t('predictions.showAllPlayers', { count: rows.length }))}" aria-expanded="false">${t('predictions.showAllPlayers', { count: rows.length })}</button>`
        : ''}
    </div>`;
}

function hashHue(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0xffff;
  return h % 360;
}

function renderAdminMatches() {
  document.getElementById('admin-matches').innerHTML = Object.entries(state.groups).map(([group]) => {
    const matches = state.matches.filter(m => m.group === group);
    return `
      <div class="admin-group">
        <h3>${t('match.group', { letter: group })}</h3>
        ${matches.map(match => {
          const result = state.results[match.id] || {};
          return `
            <div class="match-row">
              <span class="team home">${teamLabel(match.home)}</span>
              <input class="score-input admin-score" type="number" min="0" max="30"
                     data-match="${match.id}" data-side="home" value="${result.home ?? ''}">
              <span class="vs">−</span>
              <input class="score-input admin-score" type="number" min="0" max="30"
                     data-match="${match.id}" data-side="away" value="${result.away ?? ''}">
              <span class="team away">${teamLabel(match.away)}</span>
              <span class="match-points points-none"></span>
            </div>`;
        }).join('')}
      </div>`;
  }).join('');
}

async function saveResults() {
  const next = { ...state.results };

  document.querySelectorAll('.admin-score').forEach(input => {
    const { match, side } = input.dataset;
    if (!next[match]) next[match] = {};
    if (input.value !== '') {
      const val = parseInt(input.value, 10);
      if (!isNaN(val) && val >= 0) next[match][side] = val;
    } else {
      delete next[match][side];
    }
  });

  const cleaned = Object.fromEntries(
    Object.entries(next).filter(([, r]) => r.home !== undefined && r.away !== undefined)
  );

  try {
    await firebase.firestore().collection('results').doc('all').set({
      results: cleaned,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    showToast(t('leaderboard.resultsSaved'));
  } catch (err) {
    showToast(t('predictions.saveFailed', { msg: err.message }));
  }
}

function calcPoints(pred, actual) {
  if (pred.home === actual.home && pred.away === actual.away) return 4;
  const predOutcome   = Math.sign(pred.home   - pred.away);
  const actualOutcome = Math.sign(actual.home - actual.away);
  return predOutcome === actualOutcome ? 1 : 0;
}

let _standingsCache = null;
let _standingsCacheKey = '';

function computeStandings(resultsOverride) {
  const isKnockout = state.leagueType === 'knockout';
  const useCustom = !!resultsOverride;
  if (!useCustom) {
    const vKey = isKnockout
      ? `ko:${state.knockout?.predVersion || 0}:${state.knockout?.resultsVersion || 0}`
      : `${state.predVersion || 0}:${state.resultsVersion || 0}`;
    if (_standingsCache && _standingsCacheKey === vKey) return _standingsCache;
  }

  const results = resultsOverride || (isKnockout ? (typeof getKnockoutResults === 'function' ? getKnockoutResults() : {}) : state.results);
  const players = Object.entries(isKnockout ? (state.knockout?.predictionDocs || {}) : state.predictionDocs);
  const pointsFn = isKnockout && typeof calcKnockoutPoints === 'function' ? calcKnockoutPoints : calcPoints;

  const standings = players.map(([uid, doc]) => {
    const preds = doc.predictions || {};
    let points = 0, scored = 0;
    for (const [matchId, pred] of Object.entries(preds)) {
      const actual = results[matchId];
      if (!actual) continue;
      const pts = pointsFn(pred, actual);
      if (pts == null) continue;
      points += pts;
      if (pts >= 3) scored++;
    }
    return {
      uid,
      name: doc.displayName || '',
      points,
      scored,
      predicted: Object.keys(preds).length,
    };
  }).filter(p => p.name).sort((a, b) => b.points - a.points || b.predicted - a.predicted);

  if (!useCustom) {
    const vKey = isKnockout
      ? `ko:${state.knockout?.predVersion || 0}:${state.knockout?.resultsVersion || 0}`
      : `${state.predVersion || 0}:${state.resultsVersion || 0}`;
    _standingsCacheKey = vKey;
    _standingsCache = standings;
  }
  return standings;
}

function currentMatch() {
  const matches = state.matches;
  if (!matches.length) return null;

  // 1. A match currently in play (live state from poller or canonical status).
  for (const m of matches) {
    if (matchLiveState(m) === 'live') return m;
  }

  // 2. The next upcoming match (earliest kickoff in the future).
  const now = Date.now();
  let next = null;
  for (const m of matches) {
    const t = new Date(m.utcDate).getTime();
    if (!Number.isFinite(t) || t < now) continue;
    if (!next || t < new Date(next.utcDate).getTime()) next = m;
  }
  if (next) return next;

  // 3. The most recently played match (latest kickoff in the past, with a result).
  let recent = null;
  for (const m of matches) {
    const t = new Date(m.utcDate).getTime();
    if (!Number.isFinite(t)) continue;
    if (!recent || t > new Date(recent.utcDate).getTime()) recent = m;
  }
  return recent;
}

function currentGroup() {
  const m = currentMatch();
  return m ? m.group : null;
}

function latestScoredMatch() {
  if (state.leagueType === 'knockout') {
    const results = typeof getKnockoutResults === 'function' ? getKnockoutResults() : {};
    const matches = state.knockout?.matches || [];
    let latest = null;
    for (const m of matches) {
      if (!results[m.id]) continue;
      if (!latest || new Date(m.utcDate) > new Date(latest.utcDate)) latest = m;
    }
    return latest;
  }
  let latest = null;
  for (const m of state.matches) {
    if (!state.results[m.id]) continue;
    if (!latest || new Date(m.utcDate) > new Date(latest.utcDate)) latest = m;
  }
  return latest;
}

function renderLeaderboard() {
  if (!isViewActive('view-leaderboard')) return;
  const container = document.getElementById('leaderboard-container');
  const isKnockout = state.leagueType === 'knockout';
  const total = isKnockout ? (state.knockout?.matches || []).length : state.matches.length;
  const players = Object.entries(isKnockout ? (state.knockout?.predictionDocs || {}) : state.predictionDocs);

  const oldRowTops = new Map();
  container.querySelectorAll('.leaderboard-row[data-uid]').forEach(row => {
    oldRowTops.set(row.dataset.uid, row.getBoundingClientRect().top);
  });

  if (players.length === 0) {
    container.innerHTML = `<div class="empty-state">${t('leaderboard.empty')}</div>`;
    return;
  }

  const standings = computeStandings();

  const previous = (() => {
    const latest = latestScoredMatch();
    if (!latest) return null;
    const currentResults = isKnockout ? (typeof getKnockoutResults === 'function' ? getKnockoutResults() : {}) : state.results;
    const prevResults = { ...currentResults };
    delete prevResults[latest.id];
    if (Object.keys(prevResults).length === 0) return null;
    const prev = computeStandings(prevResults);
    const ranks = {}, points = {};
    prev.forEach((p, i) => { ranks[p.uid] = i; points[p.uid] = p.points; });
    const live = matchLiveState(latest) === 'live';
    const label = `${tCountry(latest.home)} v ${tCountry(latest.away)}`;
    return { ranks, points, live, latest, label };
  })();

  const ownerCanRemove = isLeagueOwner() || isAdmin();
  const adminOnly = isAdmin();
  // Hide the per-row trash button in the leaderboard table for now —
  // the same action remains available in the admin tools members panel.
  const showLeaderboardRemove = false;

  const memberUids = state.currentLeague?.memberUids || [];
  const predDocs = isKnockout ? (state.knockout?.predictionDocs || {}) : (state.predictionDocs || {});
  const allMemberUids = Array.from(new Set([
    ...memberUids,
    ...Object.keys(predDocs),
  ]));
  const membersListHtml = adminOnly && allMemberUids.length > 0 ? allMemberUids.map(uid => {
    const doc = predDocs[uid] || {};
    const name = doc.displayName || t('leaderboard.memberNoName');
    const email = doc.email || '';
    const picks = doc.predictions ? Object.keys(doc.predictions).length : 0;
    const initial = getInitials(name);
    const isSelf = uid === state.uid;
    const removeBtn = isSelf ? '' : `
      <button class="member-remove btn-remove-player" data-remove-uid="${uid}" data-remove-name="${escapeHtml(name)}"
              title="${t('leaderboard.removePlayer')}" aria-label="${t('leaderboard.removePlayer')}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
        </svg>
      </button>`;
    return `
      <li class="member-item">
        <span class="member-avatar">${escapeHtml(initial)}</span>
        <div class="member-info">
          <span class="member-name">${escapeHtml(name)}</span>
          ${email ? `<span class="member-email">${escapeHtml(email)}</span>` : ''}
        </div>
        <span class="member-picks">${t('leaderboard.memberPicksCount', { count: picks })}</span>
        ${removeBtn}
      </li>`;
  }).join('') : '';

  const adminMembersHtml = adminOnly ? `
    <div class="league-owner-tools admin-members-card">
      <div class="owner-tool-card">
        <div class="owner-tool-text">
          <div class="owner-tool-title">${t('leaderboard.membersTitle', { count: allMemberUids.length })}</div>
          <div class="owner-tool-hint">${t('leaderboard.membersHint')}</div>
        </div>
        <ul class="member-list">${membersListHtml}</ul>
      </div>
    </div>
  ` : '';

  const ownerToolsHtml = ownerCanRemove ? `
    <div class="league-owner-tools">
      <div class="owner-tool-card">
        <div class="owner-tool-text">
          <div class="owner-tool-title">${t('leaderboard.exportTitle')}</div>
          <div class="owner-tool-hint">${t('leaderboard.exportHint')}</div>
        </div>
        <button id="btn-export-predictions" class="btn btn-secondary export-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          <span>${t('leaderboard.exportButton')}</span>
        </button>
      </div>
      <div class="owner-tool-card">
        <div class="owner-tool-text">
          <div class="owner-tool-title">${t('leaderboard.resetTitle')}</div>
          <div class="owner-tool-hint">${t('leaderboard.resetHint')}</div>
        </div>
        <button id="btn-reset-league" class="btn btn-secondary export-btn reset-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
          <span>${t('leaderboard.resetButton')}</span>
        </button>
      </div>
    </div>
  ` : '';

  const adminPanelHtml = (ownerCanRemove || adminOnly) ? `
    <details class="admin-settings-panel">
      <summary class="admin-settings-summary">
        <span class="admin-settings-icon" aria-hidden="true">⚙️</span>
        <span class="admin-settings-label">${t('leaderboard.adminSettings')}</span>
        <span class="admin-settings-chevron" aria-hidden="true">▾</span>
      </summary>
      <div class="admin-settings-body">
        ${ownerToolsHtml}
        ${adminMembersHtml}
      </div>
    </details>
  ` : '';

  container.innerHTML = `
    ${adminPanelHtml}
    <table class="leaderboard-table">
      <thead>
        <tr>
          <th>#</th>
          <th>${t('leaderboard.player')}</th>
          <th>${t('leaderboard.points')}</th>
          <th class="col-info-th">
            <span class="col-info-th-label">${t('leaderboard.matchesScored')}</span>
            <button type="button" class="col-info-btn" id="matches-scored-info-btn"
                    aria-expanded="false"
                    aria-controls="matches-scored-info-pop"
                    aria-label="${t('leaderboard.matchesScoredInfoTitle')}"
                    title="${t('leaderboard.matchesScoredInfoTitle')}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="9"/>
                <line x1="12" y1="11" x2="12" y2="17"/>
                <line x1="12" y1="7.5" x2="12" y2="7.6"/>
              </svg>
            </button>
            <div id="matches-scored-info-pop" class="col-info-pop hidden" role="tooltip">
              <div class="col-info-pop-title">${t('leaderboard.matchesScoredInfoTitle')}</div>
              <div class="col-info-pop-body">${t('leaderboard.matchesScoredInfoBody')}</div>
            </div>
          </th>
          ${previous ? `<th class="this-match-th col-info-th${previous.live ? ' is-live' : ''}">
            <span class="col-info-th-label">${t('leaderboard.lastMatch')}</span>
            ${previous.live ? `<span class="last-match-live-pill" title="${escapeHtml(t('leaderboard.lastMatchLiveTooltip', { match: previous.label }))}">
              <span class="last-match-live-dot" aria-hidden="true"></span>${t('match.live')}
            </span>` : ''}
            <button type="button" class="col-info-btn" id="last-match-info-btn"
                    aria-expanded="false"
                    aria-controls="last-match-info-pop"
                    aria-label="${t('leaderboard.lastMatchInfoTitle')}"
                    title="${t('leaderboard.lastMatchInfoTitle')}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="9"/>
                <line x1="12" y1="11" x2="12" y2="17"/>
                <line x1="12" y1="7.5" x2="12" y2="7.6"/>
              </svg>
            </button>
            <div id="last-match-info-pop" class="col-info-pop hidden" role="tooltip">
              <div class="col-info-pop-title">${t('leaderboard.lastMatchInfoTitle')}</div>
              <div class="col-info-pop-body">${t('leaderboard.lastMatchInfoBody')}</div>
              ${previous.live ? `<div class="last-match-info-live">${t('leaderboard.lastMatchLiveNote', { match: previous.label })}</div>` : ''}
            </div>
          </th>
          <th class="rank-move-th col-info-th${previous.live ? ' is-live' : ''}">
            <span class="col-info-th-label">${t('leaderboard.rankMove')}</span>
            <button type="button" class="col-info-btn" id="rank-move-info-btn"
                    aria-expanded="false"
                    aria-controls="rank-move-info-pop"
                    aria-label="${t('leaderboard.rankMoveInfoTitle')}"
                    title="${t('leaderboard.rankMoveInfoTitle')}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="9"/>
                <line x1="12" y1="11" x2="12" y2="17"/>
                <line x1="12" y1="7.5" x2="12" y2="7.6"/>
              </svg>
            </button>
            <div id="rank-move-info-pop" class="col-info-pop hidden" role="tooltip">
              <div class="col-info-pop-title">${t('leaderboard.rankMoveInfoTitle')}</div>
              <div class="col-info-pop-body">${t('leaderboard.rankMoveInfoBody')}</div>
            </div>
          </th>` : ''}
          ${showLeaderboardRemove ? '<th></th>' : ''}
        </tr>
      </thead>
      <tbody>
        ${(() => {
          const out = [];
          standings.forEach((player, i) => {
            const rank = i + 1;
            const rankClass = rank <= 3 ? `rank-${rank}` : 'rank-other';
            const tierClass = rank <= 3 ? 'tier-podium' : (rank <= 10 ? 'tier-contenders' : 'tier-rest');
          const removeCell = showLeaderboardRemove && player.uid !== state.uid
            ? `<td><button class="btn-remove-player" data-remove-uid="${player.uid}" data-remove-name="${escapeHtml(player.name)}" title="${t('leaderboard.removePlayer')}" aria-label="${t('leaderboard.removePlayer')}">
                 <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                   <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                 </svg>
               </button></td>`
            : (showLeaderboardRemove ? '<td></td>' : '');
          let lastMatchCell = '';
          if (previous) {
            const prevRank = previous.ranks[player.uid];
            const prevPts = previous.points[player.uid] ?? 0;
            const ptsGained = player.points - prevPts;
            let ptsHtml;
            if (ptsGained > 0) {
              const ptsTitle = t('leaderboard.ptsDeltaGained', { n: ptsGained });
              ptsHtml = `<span class="pts-delta pts-delta-pos" title="${escapeHtml(ptsTitle)}">+${ptsGained}</span>`;
            } else {
              ptsHtml = `<span class="pts-delta pts-delta-zero" title="${escapeHtml(t('leaderboard.ptsDeltaZero'))}">—</span>`;
            }
            let rankHtml = `<span class="rank-delta rank-delta-flat" title="${escapeHtml(t('leaderboard.rankDeltaFlat'))}">—</span>`;
            if (prevRank !== undefined) {
              const delta = prevRank - i;
              if (delta !== 0) {
                const up = delta > 0;
                const baseTitle = t(up ? 'leaderboard.rankDeltaUp' : 'leaderboard.rankDeltaDown', { n: Math.abs(delta) });
                rankHtml = `<span class="rank-delta ${up ? 'rank-delta-up' : 'rank-delta-down'}" title="${escapeHtml(baseTitle)}">${up ? '▲' : '▼'}${Math.abs(delta)}</span>`;
              }
            }
            lastMatchCell = `<td class="this-match-cell${previous.live ? ' is-live' : ''}">${previous.live ? `<span class="row-live-dot" aria-hidden="true" title="${escapeHtml(t('leaderboard.lastMatchLiveTooltip', { match: previous.label }))}"></span>` : ''}${ptsHtml}</td><td class="rank-move-cell${previous.live ? ' is-live' : ''}">${rankHtml}</td>`;
          }
          const rowClasses = ['leaderboard-row', tierClass];
          if (rank <= 3) rowClasses.push(`lb-rank-${rank}`);
          if (player.uid === state.uid) rowClasses.push('current-player');
          out.push(`
            <tr class="${rowClasses.join(' ')}" data-uid="${player.uid}">
              <td><span class="rank-badge ${rankClass}">${rank}</span></td>
              <td><button type="button" class="player-name-pill" data-player-uid="${player.uid}" data-player-rank="${rank}" aria-label="${t('leaderboard.viewPlayer', { name: player.name })}" title="${t('leaderboard.viewPlayer', { name: player.name })}">
                <span class="player-name-pill-text">${player.name}</span>
                <svg class="player-name-pill-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M9 18l6-6-6-6"/>
                </svg>
              </button></td>
              <td><span class="points-display">${player.points}</span></td>
              <td>${player.scored} / ${total}</td>
              ${lastMatchCell}
              ${removeCell}
            </tr>`);
          });
          return out.join('');
        })()}
      </tbody>
    </table>`;

  try {
    if (state.uid && state.leagueId) {
      localStorage.setItem('wc2026_lb_html_v2', JSON.stringify({
        uid: state.uid, leagueId: state.leagueId, html: container.innerHTML, ts: Date.now(),
      }));
      localStorage.removeItem('wc2026_lb_html');
    }
  } catch (e) { /* quota or storage disabled — skip cache */ }

  // Attach click handlers directly to each pill as a mobile-Safari-safe
  // fallback for event delegation.
  container.querySelectorAll('.player-name-pill[data-player-uid]').forEach((pill) => {
    if (pill._directClickBound) return;
    pill._directClickBound = true;
    pill.addEventListener('click', (e) => {
      e.stopPropagation();
      const uid = pill.dataset.playerUid;
      const rank = parseInt(pill.dataset.playerRank, 10) || 0;
      openPlayerPredictionsModal(uid, rank);
    });
  });

  applyLeaderboardFlip(oldRowTops);

  if (state._leaderboardScrollPending) {
    state._leaderboardScrollPending = false;
    const me = container.querySelector('.leaderboard-row.current-player');
    if (me) {
      requestAnimationFrame(() => {
        me.scrollIntoView({ block: 'center', behavior: 'smooth' });
      });
    }
  }
}

function applyLeaderboardFlip(oldRowTops) {
  if (!oldRowTops || oldRowTops.size === 0) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const rows = document.querySelectorAll('.leaderboard-row[data-uid]');
  rows.forEach(row => {
    const uid = row.dataset.uid;
    const oldTop = oldRowTops.get(uid);
    if (oldTop === undefined) return;
    const newTop = row.getBoundingClientRect().top;
    const delta = oldTop - newTop;
    if (Math.abs(delta) < 1) return;
    row.style.transition = 'none';
    row.style.transform = `translateY(${delta}px)`;
    row.classList.add('rank-shifting');
    requestAnimationFrame(() => {
      row.style.transition = 'transform 480ms cubic-bezier(0.22, 0.61, 0.36, 1)';
      row.style.transform = '';
      const onEnd = () => {
        row.style.transition = '';
        row.style.transform = '';
        row.classList.remove('rank-shifting');
        row.removeEventListener('transitionend', onEnd);
      };
      row.addEventListener('transitionend', onEnd);
    });
  });
}

function initLeaderboardDelegation() {
  const container = document.getElementById('leaderboard-container');
  if (!container || container._delegated) return;
  container._delegated = true;

  container.addEventListener('click', async (e) => {
    const removeBtn = e.target.closest('.btn-remove-player');
    if (removeBtn) {
      const uid = removeBtn.dataset.removeUid;
      const name = removeBtn.dataset.removeName;
      const leagueName = displayLeagueName(state.currentLeague?.name) || '';
      if (!confirm(t('leaderboard.removeConfirm', { name, league: leagueName }))) return;
      try {
        await removePlayerFromLeague(uid);
        showToast(t('leaderboard.removed', { name }));
      } catch (err) {
        showToast(err.message);
      }
      return;
    }

    if (e.target.closest('#btn-export-predictions')) {
      exportPredictionsCSV();
      return;
    }

    const infoBtn = e.target.closest('#last-match-info-btn, .col-info-btn');
    if (infoBtn) {
      e.stopPropagation();
      const popId = infoBtn.getAttribute('aria-controls')
        || (infoBtn.id === 'last-match-info-btn' ? 'last-match-info-pop' : null);
      const pop = popId ? document.getElementById(popId) : null;
      if (pop) {
        const open = pop.classList.toggle('hidden');
        infoBtn.setAttribute('aria-expanded', String(!open));
      }
      return;
    }

    const resetBtn = e.target.closest('#btn-reset-league');
    if (resetBtn) {
      if (!state.leagueId || (!isLeagueOwner() && !isAdmin())) return;
      const leagueName = displayLeagueName(state.currentLeague?.name) || '';
      if (!confirm(t('leaderboard.resetConfirm', { name: leagueName }))) return;
      resetBtn.disabled = true;
      try {
        await resetLeague();
        showToast(t('leaderboard.resetDone'));
      } catch (err) {
        showToast(err.message);
      } finally {
        resetBtn.disabled = false;
      }
      return;
    }

    const playerPill = e.target.closest('.player-name-pill[data-player-uid]');
    if (playerPill) {
      const uid = playerPill.dataset.playerUid;
      const rank = parseInt(playerPill.dataset.playerRank, 10) || 0;
      openPlayerPredictionsModal(uid, rank);
    }
  });

  container.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const playerPill = e.target.closest('.player-name-pill[data-player-uid]');
    if (!playerPill) return;
    e.preventDefault();
    const uid = playerPill.dataset.playerUid;
    const rank = parseInt(playerPill.dataset.playerRank, 10) || 0;
    openPlayerPredictionsModal(uid, rank);
  });

  // Dismiss any column info popover when clicking outside it
  document.addEventListener('click', (e) => {
    const pops = document.querySelectorAll('#last-match-info-pop:not(.hidden), .col-info-pop:not(.hidden)');
    if (!pops.length) return;
    if (e.target.closest('#last-match-info-btn, .col-info-btn, #last-match-info-pop, .col-info-pop')) return;
    pops.forEach((pop) => {
      pop.classList.add('hidden');
      const btn = document.querySelector(`[aria-controls="${pop.id}"]`)
        || (pop.id === 'last-match-info-pop' ? document.getElementById('last-match-info-btn') : null);
      if (btn) btn.setAttribute('aria-expanded', 'false');
    });
  });
}

let _playerPredModalInited = false;
let _playerPredModalOpenedAt = 0;
function initPlayerPredModal() {
  if (_playerPredModalInited) return;
  const modal = document.getElementById('player-pred-modal');
  if (!modal) return;
  _playerPredModalInited = true;

  // Only close on a real press-and-release on the backdrop. This prevents
  // the synthesized mobile click that comes from the tap that *opened* the
  // modal from immediately closing it (the tap point on the leaderboard
  // ends up over the freshly-rendered backdrop).
  let backdropPressed = false;
  const markPress = (e) => {
    backdropPressed = !!(e.target && e.target.closest && e.target.closest('[data-close="1"]'));
  };
  modal.addEventListener('mousedown', markPress);
  modal.addEventListener('touchstart', markPress, { passive: true });

  modal.addEventListener('click', (e) => {
    // Ignore the click that originated from the same tap that opened us.
    if (Date.now() - _playerPredModalOpenedAt < 400) {
      backdropPressed = false;
      return;
    }
    if (!e.target.closest('[data-close="1"]')) return;
    // For backdrop clicks, require press+release on the backdrop. The close
    // button still works because it has data-close="1" on itself.
    const isCloseButton = !!e.target.closest('#player-pred-modal-close');
    if (isCloseButton || backdropPressed) {
      closePlayerPredictionsModal();
    }
    backdropPressed = false;
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
      closePlayerPredictionsModal();
    }
  });
}

function openPlayerPredictionsModal(uid, rank) {
  initPlayerPredModal();
  const modal = document.getElementById('player-pred-modal');
  if (!modal) return;

  const isKnockout = state.leagueType === 'knockout';
  const doc = isKnockout
    ? (state.knockout?.predictionDocs || {})[uid]
    : state.predictionDocs[uid];
  const standings = computeStandings();
  const standing = standings.find(s => s.uid === uid);
  const name = (doc && doc.displayName) || (standing && standing.name) || t('toast.unknown');
  const points = standing ? standing.points : 0;
  const scored = standing ? standing.scored : 0;
  const total = isKnockout ? (state.knockout?.matches || []).length : state.matches.length;
  const isSelf = uid === state.uid;

  document.getElementById('player-pred-modal-title').textContent = name;
  const avatarEl = document.getElementById('player-pred-modal-avatar');
  avatarEl.textContent = getInitials(name);
  avatarEl.style.setProperty('--avatar-hue', String(isSelf ? 145 : hashHue(uid)));
  document.getElementById('player-pred-modal-rank').textContent = t('playerModal.rank', { rank });
  document.getElementById('player-pred-modal-points').textContent =
    t('playerModal.points', { points, scored, total });

  const body = document.getElementById('player-pred-modal-body');
  const preds = (doc && doc.predictions) || {};

  if (!Object.keys(preds).length) {
    body.innerHTML = `<div class="empty-state">${t('playerModal.noPicks')}</div>`;
  } else if (isKnockout) {
    const hint = isSelf ? '' : `<div class="player-pred-modal-hint">${t('playerModal.readOnlyHint')}</div>`;
    const matches = state.knockout?.matches || [];
    const results = typeof getKnockoutResults === 'function' ? getKnockoutResults() : {};
    const byStage = {};
    for (const m of matches) { (byStage[m.stage] ||= []).push(m); }
    const stageOrder = typeof KNOCKOUT_STAGES !== 'undefined' ? KNOCKOUT_STAGES : Object.keys(byStage);
    body.innerHTML = hint + stageOrder.filter(s => byStage[s]?.length).map((stage, idx) => {
      const stageMatches = byStage[stage].sort((a, b) => a.slot - b.slot);
      let stagePts = 0, stagePicked = 0;
      for (const m of stageMatches) {
        const p = preds[m.id];
        if (p && p.home != null && p.away != null) {
          stagePicked++;
          const actual = results[m.id];
          if (actual && typeof calcKnockoutPoints === 'function') {
            const pts = calcKnockoutPoints(p, actual);
            if (pts !== null) stagePts += pts;
          }
        }
      }
      const label = typeof knockoutRoundLabel === 'function' ? knockoutRoundLabel(stage) : stage;
      return `
        <details class="prediction-group player-pred-group"${idx === 0 ? ' open' : ''}>
          <summary class="prediction-group-title">
            <span class="player-pred-ko-stage-badge">${label}</span>
            <span class="group-stats">
              <span class="group-stats-pts">${stagePts} ${t('header.points')}</span>
              <span class="group-stats-sep">·</span>
              <span class="group-stats-predicted">${stagePicked}/${stageMatches.length}</span>
            </span>
            <svg class="group-chevron" viewBox="0 0 12 12" aria-hidden="true">
              <path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </summary>
          <div class="prediction-group-rows">
            ${stageMatches.map(m => {
              const p = preds[m.id];
              const actual = results[m.id];
              const pts = (p && actual && typeof calcKnockoutPoints === 'function')
                ? calcKnockoutPoints(p, actual) : null;
              const ptsBadge = pts !== null
                ? `<span class="everyone-pts-badge pts-badge-${pts}">${pts > 0 ? '+' : ''}${pts}</span>`
                : '';
              const predStr = (p && p.home != null && p.away != null)
                ? `${p.home} - ${p.away}` : `<span class="text-muted">—</span>`;
              const resultStr = actual
                ? `<span class="bracket-result-score">${actual.home} - ${actual.away}</span>` : '';
              const homeName = typeof tCountry === 'function' ? tCountry(m.home) : m.home;
              const awayName = typeof tCountry === 'function' ? tCountry(m.away) : m.away;
              const homeFlag = typeof knockoutTeamFlag === 'function' ? knockoutTeamFlag(m.home) : '';
              const awayFlag = typeof knockoutTeamFlag === 'function' ? knockoutTeamFlag(m.away) : '';
              return `<div class="player-pred-ko-row">
                <span class="player-pred-ko-teams">
                  ${homeFlag}
                  <span class="player-pred-ko-home">${escapeHtml(homeName)}</span>
                  <span class="player-pred-ko-vs">v</span>
                  ${awayFlag}
                  <span class="player-pred-ko-away">${escapeHtml(awayName)}</span>
                </span>
                <span class="player-pred-ko-pick">${predStr}</span>
                ${resultStr ? `<span class="player-pred-ko-result">${actual.home} - ${actual.away}</span>` : ''}
                ${ptsBadge}
              </div>`;
            }).join('')}
          </div>
        </details>`;
    }).join('');
  } else {
    const hint = isSelf ? '' : `<div class="player-pred-modal-hint">${t('playerModal.readOnlyHint')}</div>`;
    const defaultOpenGroup = currentGroup() || Object.keys(state.groups)[0];
    body.innerHTML = hint + Object.entries(state.groups).map(([group, teams]) => {
      const matches = state.matches.filter(m => m.group === group);
      let groupPts = 0;
      let groupPicked = 0;
      for (const m of matches) {
        const p = preds[m.id];
        if (p && p.home !== undefined && p.away !== undefined) {
          groupPicked++;
          const actual = state.results[m.id];
          if (actual) groupPts += calcPoints(p, actual);
        }
      }
      const isOpen = group === defaultOpenGroup;
      return `
        <details class="prediction-group player-pred-group"${isOpen ? ' open' : ''}>
          <summary class="prediction-group-title">
            <span class="group-letter-badge">${group}</span>
            <span class="group-letter-text">${t('match.group', { letter: group })}</span>
            <span class="group-stats">
              <span class="group-stats-pts">${groupPts} ${t('header.points')}</span>
              <span class="group-stats-sep">·</span>
              <span class="group-stats-predicted">${groupPicked}/${matches.length}</span>
            </span>
            <svg class="group-chevron" viewBox="0 0 12 12" aria-hidden="true">
              <path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </summary>
          <div class="prediction-group-rows">
            ${matches.map(m => playerPredictionCard(m, preds[m.id], state.results[m.id], name, uid)).join('')}
          </div>
        </details>`;
    }).join('');
  }

  modal.classList.remove('hidden');
  _playerPredModalOpenedAt = Date.now();
  document.body.classList.add('modal-open');
  setTimeout(() => {
    document.getElementById('player-pred-modal-close')?.focus({ preventScroll: true });
  }, 0);
}

function closePlayerPredictionsModal() {
  const modal = document.getElementById('player-pred-modal');
  if (!modal) return;
  modal.classList.add('hidden');
  document.body.classList.remove('modal-open');
}

function playerPredictionCard(match, pred, result, ownerName, ownerUid) {
  const hasPred = pred && pred.home !== undefined && pred.away !== undefined;
  const pts = (result && hasPred) ? calcPoints(pred, result) : null;

  const { day, time } = formatMatchDateParts(match.utcDate);
  const venue = displayVenue(venueForMatch(match));
  const ownerInitial = getInitials(ownerName);
  const isSelf = ownerUid === state.uid;
  const avatarHue = isSelf ? 145 : hashHue(ownerUid);

  const rowClass = pts >= 3 ? 'predict-row pts-exact'
                 : pts === 1 ? 'predict-row pts-partial'
                 : pts === 0 ? 'predict-row pts-miss'
                 : 'predict-row';

  const liveState = matchLiveState(match);
  const statusLabel = liveState === 'live' ? t('match.live')
                    : liveState === 'ft'   ? t('match.ft')
                    : t('match.actual');
  const liveClass = liveState === 'live' ? ' status-live' : '';

  const isLive = liveState === 'live';
  const liveMetaPill = isLive
    ? `<span class="meta-sep">·</span><span class="meta-live-pill"><span class="meta-live-dot" aria-hidden="true"></span>${t('match.live')}</span>`
    : '';
  const statusIcon = result === undefined || result === null
    ? `<span class="actual-status status-tbd">${t('match.tbd')}</span>`
    : isLive
      ? ''
      : pts >= 3
        ? `<span class="actual-status status-label status-exact${liveClass}">${statusLabel}</span>`
        : pts === 1
          ? `<span class="actual-status status-label status-partial${liveClass}">${statusLabel}</span>`
          : pts === 0
            ? `<span class="actual-status status-label status-miss${liveClass}">${statusLabel}</span>`
            : `<span class="actual-status status-label status-neutral${liveClass}">${statusLabel}</span>`;

  const actualNumsHtml = result
    ? `<span class="actual-num">${result.home}</span>
       <span class="actual-dash">−</span>
       <span class="actual-num">${result.away}</span>`
    : `<span class="actual-num actual-empty">?</span>
       <span class="actual-dash">−</span>
       <span class="actual-num actual-empty">?</span>`;

  const ptsBadge = pts !== null
    ? `<span class="pts-badge pts-badge-${pts}">+${pts}</span>`
    : '';

  const pickHome = hasPred ? pred.home : '—';
  const pickAway = hasPred ? pred.away : '—';

  return `
    <div class="${rowClass}">
      <div class="match-meta-line">
        <span class="meta-day">${day}</span>
        <span class="meta-sep">·</span>
        <span class="meta-time">${time}</span>
        ${venue ? `<span class="meta-sep">·</span><span class="meta-venue">${escapeHtml(venue)}</span>` : ''}
        ${liveMetaPill}
      </div>

      <div class="match-teams">
        <span class="team home">${teamLabel(match.home, 'left')}</span>
        <span class="team-vs">${t('match.vs')}</span>
        <span class="team away">${teamLabel(match.away, 'right')}</span>
      </div>

      <div class="match-scoreboard">
        <div class="my-pick player-pred-pick">
          <span class="my-pick-avatar" style="--avatar-hue:${avatarHue}">${escapeHtml(ownerInitial)}</span>
          <span class="player-pred-num">${pickHome}</span>
          <span class="vs">−</span>
          <span class="player-pred-num">${pickAway}</span>
        </div>
        <div class="actual-side${isLive ? ' is-live' : ''}">
          ${statusIcon}
          ${actualNumsHtml}
          ${ptsBadge}
        </div>
      </div>
    </div>`;
}

function exportPredictionsCSV() {
  exportPredictionsXLSX().catch(err => {
    console.error('[export] failed:', err);
    showToast(t('leaderboard.exportError', { msg: err.message }));
  });
}

async function exportPredictionsXLSX() {
  const docsByUid = state.predictionDocs || {};
  if (!Object.keys(docsByUid).length) {
    showToast(t('leaderboard.exportEmpty'));
    return;
  }

  // Order players by leaderboard standings so the export feels familiar.
  const standings = computeStandings();
  const players = standings
    .filter(s => docsByUid[s.uid])
    .map(s => ({ uid: s.uid, name: s.name, doc: docsByUid[s.uid] }));
  if (!players.length) {
    showToast(t('leaderboard.exportEmpty'));
    return;
  }

  const sortedMatches = [...state.matches].sort((a, b) => {
    if (a.group !== b.group) return a.group.localeCompare(b.group);
    return (a.utcDate || '').localeCompare(b.utcDate || '');
  });

  const XLSX = await loadSheetJs();
  const wb = XLSX.utils.book_new();

  const PLAYERS_PER_SHEET = 9;
  const COLS_PER_BLOCK = 4;
  const FIRST_BLOCK_COL = 6;

  for (let start = 0; start < players.length; start += PLAYERS_PER_SHEET) {
    const group = players.slice(start, start + PLAYERS_PER_SHEET);
    const firstNum = start + 1;
    const lastNum = start + group.length;

    const totalCols = FIRST_BLOCK_COL + group.length * COLS_PER_BLOCK;
    const blank = () => new Array(totalCols).fill(null);

    // Row 0: title + player numbers
    const titleRow = blank();
    titleRow[0] = 'TODOS LOS PRONOSTICOS';
    group.forEach((_, i) => { titleRow[FIRST_BLOCK_COL + i * COLS_PER_BLOCK] = firstNum + i; });

    // Row 1: player names
    const nameRow = blank();
    group.forEach((p, i) => { nameRow[FIRST_BLOCK_COL + i * COLS_PER_BLOCK] = (p.name || '').toUpperCase(); });

    // Row 2: column headers
    const headerRow = blank();
    headerRow[0] = 'Juego';
    headerRow[1] = 'Resultado Oficial';
    group.forEach((_, i) => {
      const base = FIRST_BLOCK_COL + i * COLS_PER_BLOCK;
      headerRow[base] = 'Score';
      headerRow[base + 2] = 'PTOS.';
    });

    const aoa = [titleRow, nameRow, headerRow];

    // Match rows
    sortedMatches.forEach((match, idx) => {
      const result = state.results[match.id];
      const row = blank();
      row[0] = idx + 1;
      row[1] = (match.home || '').toUpperCase();
      row[2] = result ? result.home : null;
      row[3] = (match.away || '').toUpperCase();
      row[4] = result ? result.away : null;
      group.forEach((p, i) => {
        const base = FIRST_BLOCK_COL + i * COLS_PER_BLOCK;
        const pred = p.doc.predictions?.[match.id];
        if (pred) {
          row[base] = pred.home ?? null;
          row[base + 1] = pred.away ?? null;
          if (result) row[base + 2] = calcPoints(pred, result);
        }
      });
      aoa.push(row);
    });

    // Spacer + totals row
    aoa.push(blank());
    const totalsRow = blank();
    totalsRow[0] = 'TOTAL DE PUNTOS POR APOSTADOR';
    group.forEach((p, i) => {
      const preds = p.doc.predictions || {};
      let total = 0;
      for (const [matchId, pred] of Object.entries(preds)) {
        const actual = state.results[matchId];
        if (actual) total += calcPoints(pred, actual);
      }
      totalsRow[FIRST_BLOCK_COL + i * COLS_PER_BLOCK + 2] = total;
    });
    aoa.push(totalsRow);

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    // Reasonable column widths
    ws['!cols'] = new Array(totalCols).fill(null).map((_, c) => {
      if (c === 0) return { wch: 6 };
      if (c === 1 || c === 3) return { wch: 16 };
      if (c === 2 || c === 4) return { wch: 4 };
      if (c === 5) return { wch: 2 };
      const inBlock = (c - FIRST_BLOCK_COL) % COLS_PER_BLOCK;
      if (inBlock === 3) return { wch: 2 };
      return { wch: 6 };
    });

    const sheetName = group.length === 1
      ? `pronosticos ${firstNum}`
      : `pronosticos ${firstNum} al ${lastNum}`;
    XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  }

  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], { type: 'application/octet-stream' });
  const leagueName = (displayLeagueName(state.currentLeague?.name) || 'predictions').replace(/[^\w-]+/g, '_');
  const stamp = new Date().toISOString().slice(0, 10);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${leagueName}_${stamp}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast(t('leaderboard.exportDone', { n: sortedMatches.length, p: players.length }));
}

// ───────────────────────────────────────────────────────────────────────────
// Predictions import (Excel/CSV)
// ───────────────────────────────────────────────────────────────────────────

function normTeamName(s) {
  return String(s || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]/g, '');
}

function expandTeamAliases(englishName) {
  const cluster = TEAM_ALIASES.find(c => c.includes(englishName));
  return cluster || [englishName];
}

function normalizedFormsForSpanish(spanishName) {
  const key = String(spanishName || '').trim().toUpperCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const english = SPANISH_TEAM_TO_ENGLISH[key];
  if (!english) return null;
  return new Set(expandTeamAliases(english).map(normTeamName));
}

// Returns { match, swap } if a state match pairs these teams, else null.
function findMatchForRow(homeSp, awaySp) {
  const homeSet = normalizedFormsForSpanish(homeSp);
  const awaySet = normalizedFormsForSpanish(awaySp);
  if (!homeSet || !awaySet) return null;
  for (const m of state.matches) {
    const h = normTeamName(m.home);
    const a = normTeamName(m.away);
    if (homeSet.has(h) && awaySet.has(a)) return { match: m, swap: false };
    if (homeSet.has(a) && awaySet.has(h)) return { match: m, swap: true };
  }
  return null;
}

function toIntScore(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = parseInt(String(v).trim(), 10);
  return Number.isFinite(n) && n >= 0 && n <= 99 ? n : null;
}

// Walks AoA rows looking for the Excel template's two side-by-side match blocks.
// Returns an array of { home: <english-ish>, away, hs, as, unrecognized }.
function extractRowsFromAoA(rows) {
  const results = [];
  for (const row of rows) {
    if (!Array.isArray(row)) continue;
    for (const offset of [0, 9]) {
      const num = row[offset];
      if (!Number.isFinite(typeof num === 'number' ? num : NaN)) continue;
      const home = row[offset + 3];
      const hs   = row[offset + 4];
      const sep  = row[offset + 5];
      const away = row[offset + 6];
      const as   = row[offset + 7];
      if (typeof home !== 'string' || typeof away !== 'string') continue;
      if (typeof sep === 'string' && !/vs/i.test(sep)) continue;
      results.push({ home, away, hs, as });
    }
  }
  return results;
}

// Simple CSV: home,away,home_score,away_score (header optional).
function extractRowsFromCsv(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const out = [];
  for (const line of lines) {
    const cells = parseCsvLine(line);
    if (cells.length < 4) continue;
    const [home, away, hs, as] = cells;
    if (!home || !away) continue;
    if (/^home$/i.test(home) && /^away$/i.test(away)) continue; // header
    out.push({ home, away, hs, as });
  }
  return out;
}

function parseCsvLine(line) {
  const cells = [];
  let cur = '', inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else cur += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { cells.push(cur); cur = ''; }
    else cur += c;
  }
  cells.push(cur);
  return cells.map(s => s.trim());
}

let _sheetjsPromise = null;
function loadSheetJs() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  if (_sheetjsPromise) return _sheetjsPromise;
  _sheetjsPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
    s.async = true;
    s.onload = () => resolve(window.XLSX);
    s.onerror = () => reject(new Error('SheetJS load failed'));
    document.head.appendChild(s);
  });
  return _sheetjsPromise;
}

async function readFileRows(file) {
  const name = (file.name || '').toLowerCase();
  if (name.endsWith('.csv')) {
    const text = await file.text();
    return extractRowsFromCsv(text);
  }
  // Excel
  const XLSX = await loadSheetJs();
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  let all = [];
  for (const sheetName of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: null });
    all = all.concat(extractRowsFromAoA(rows));
  }
  return all;
}

async function handleImportFile(file) {
  if (!file || !state.uid || !state.leagueId) return;
  if (arePredictionsLocked()) {
    showToast(t('predictions.importLocked'));
    return;
  }

  let rows;
  try {
    rows = await readFileRows(file);
  } catch (err) {
    showToast(t('predictions.importParseError', { msg: err.message }));
    return;
  }

  if (!rows.length) {
    showToast(t('predictions.importEmpty'));
    return;
  }

  const updates = {};
  const skipped = { unknownTeams: [], missingScores: [] };
  let matched = 0;
  for (const r of rows) {
    const found = findMatchForRow(r.home, r.away);
    if (!found) { skipped.unknownTeams.push(`${r.home} vs ${r.away}`); continue; }
    let hs = toIntScore(r.hs);
    let as = toIntScore(r.as);
    if (hs === null || as === null) {
      skipped.missingScores.push(`${r.home} ${r.hs ?? '∅'} vs ${r.as ?? '∅'} ${r.away}`);
      continue;
    }
    if (found.swap) { const t1 = hs; hs = as; as = t1; }
    updates[found.match.id] = { home: hs, away: as };
    matched++;
  }

  const skippedCount = skipped.unknownTeams.length + skipped.missingScores.length;
  if (skippedCount) {
    console.warn('[import] skipped rows:', skipped);
  }

  if (matched === 0) {
    showToast(t('predictions.importNoMatch'));
    return;
  }

  const summary = t('predictions.importConfirm', {
    matched, skipped: skippedCount,
  });
  if (!window.confirm(summary)) return;

  // Merge in-app against the cached predictions, then full overwrite. Using
  // Firestore's { merge: true } evaluates rules against the merged document,
  // which still includes joinedAt (set by joinLeague) for users who haven't
  // yet had it stripped by an autosave overwrite — Firestore's schema rule
  // rejects that with "insufficient permissions". A full overwrite matches
  // the autosave shape that rules already accept.
  const user = firebase.auth().currentUser;
  const displayName = user?.displayName || user?.email || state.currentPlayer;
  const email = user?.email || '';
  // Filter existing predictions to the same shape autosave writes:
  // only complete {home:int, away:int} entries. Any malformed entry
  // already in Firestore (e.g. missing a side, or with stray fields)
  // would otherwise be carried into the write and trip the schema rule.
  const existingPredictions = state.predictionDocs[state.uid]?.predictions || {};
  const mergedPredictions = {};
  for (const [matchId, p] of Object.entries(existingPredictions)) {
    if (!p || typeof p !== 'object') continue;
    const h = parseInt(p.home, 10);
    const a = parseInt(p.away, 10);
    if (!Number.isInteger(h) || h < 0) continue;
    if (!Number.isInteger(a) || a < 0) continue;
    mergedPredictions[matchId] = { home: h, away: a };
  }
  for (const [matchId, scores] of Object.entries(updates)) {
    mergedPredictions[matchId] = { home: scores.home, away: scores.away };
  }

  try {
    await leaguePredictionsCol(state.leagueId).doc(state.uid).set({
      displayName,
      email,
      predictions: mergedPredictions,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.error('[import] save failed:', err);
    showToast(t('predictions.importSaveFailed', { msg: err.message }));
    return;
  }

  // Update DOM for instant visual feedback. The next render's
  // captureCurrentInputDraft/restoreInputDraft cycle will preserve these.
  for (const [matchId, scores] of Object.entries(updates)) {
    const hi = document.querySelector(`#view-predictions .score-input[data-match="${matchId}"][data-side="home"]`);
    const ai = document.querySelector(`#view-predictions .score-input[data-match="${matchId}"][data-side="away"]`);
    if (hi) hi.value = scores.home;
    if (ai) ai.value = scores.away;
  }
  showToast(t('predictions.importDone', { n: matched }));
}

function csvEscape(value) {
  const s = String(value ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function downloadCSV(csv, filename) {
  // UTF-8 BOM so Excel reads accented characters correctly
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ── League CRUD ───────────────────────────────────────────────────────────────

async function createLeague(name, type = 'groups') {
  if (!name || name.trim().length < 3) throw new Error(t('leagues.create.invalidName'));

  const doc = {
    name: name.trim(),
    type: type === 'knockout' ? 'knockout' : 'groups',
    ownerUid: state.uid,
    isPublic: true,
    memberUids: [state.uid],
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  };

  const ref = await firebase.firestore().collection('leagues').add(doc);
  return ref.id;
}

async function resetLeague() {
  if (!state.leagueId || (!isLeagueOwner() && !isAdmin())) throw new Error(t('leaderboard.resetDenied'));

  const snap = await leaguePredictionsCol(state.leagueId).get();
  const batch = firebase.firestore().batch();
  snap.docs.forEach(d => batch.delete(d.ref));
  await batch.commit();

  await firebase.firestore().collection('results').doc('all').delete().catch(() => {});

  ApiCache.clear?.();
  state.results = {};
  state.predictionDocs = {};
  document.querySelectorAll('#matches-container .score-input').forEach(input => { input.value = ''; });
  refreshDynamicContent();
}

async function joinLeague(leagueId) {
  const doc = await leagueDocRef(leagueId).get();
  if (!doc.exists) throw new Error(t('leagues.join.notFound'));
  const data = doc.data();
  if (!data.memberUids.includes(state.uid)) {
    await leagueDocRef(leagueId).update({
      memberUids: firebase.firestore.FieldValue.arrayUnion(state.uid),
    });
    const user = firebase.auth().currentUser;
    await leaguePredictionsCol(leagueId).doc(state.uid).set({
      displayName: user?.displayName || user?.email || '',
      email: user?.email || '',
      predictions: {},
      joinedAt: firebase.firestore.FieldValue.serverTimestamp(),
    }, { merge: true }).catch(() => {});
  }
  return { id: leagueId, name: displayLeagueName(data.name) };
}

async function leaveLeague(leagueId) {
  await leaguePredictionsCol(leagueId).doc(state.uid).delete().catch(() => {});
  await leagueDocRef(leagueId).update({
    memberUids: firebase.firestore.FieldValue.arrayRemove(state.uid),
  });
}

async function removePlayerFromLeague(playerUid) {
  if (!state.leagueId || (!isLeagueOwner() && !isAdmin())) return;
  await leaguePredictionsCol(state.leagueId).doc(playerUid).delete().catch(() => {});
  await leagueDocRef(state.leagueId).update({
    memberUids: firebase.firestore.FieldValue.arrayRemove(playerUid),
  });
}

async function maybeRunMigration() {
  if (!isAdmin()) return;

  const oldSnap = await firebase.firestore().collection('predictions').limit(1).get().catch(() => null);
  if (!oldSnap || oldSnap.empty) return;

  const leaguesSnap = await firebase.firestore().collection('leagues').limit(1).get().catch(() => null);
  if (leaguesSnap && !leaguesSnap.empty) return;

  const allOld = await firebase.firestore().collection('predictions').get();
  const memberUids = allOld.docs.map(d => d.id);
  const newLeagueId = (await firebase.firestore().collection('leagues').add({
    name: DEFAULT_LEAGUE_NAME,
    ownerUid: state.uid,
    isPublic: true,
    memberUids,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  })).id;

  const batch = firebase.firestore().batch();
  for (const d of allOld.docs) {
    batch.set(leaguePredictionsCol(newLeagueId).doc(d.id), d.data());
  }
  await batch.commit();

  showToast(`Migrated ${allOld.size} predictions into "${DEFAULT_LEAGUE_NAME}"`);
}

async function maybeRenameLegacyLeague() {
  if (!isAdmin()) return;
  try {
    const snap = await firebase.firestore().collection('leagues')
      .where('name', '==', LEGACY_DEFAULT_LEAGUE_NAME).get();
    const batch = firebase.firestore().batch();
    snap.docs.forEach(d => batch.update(d.ref, { name: DEFAULT_LEAGUE_NAME }));
    if (!snap.empty) await batch.commit();
  } catch (err) {
    console.warn('Legacy league rename skipped', err);
  }
}

// ── Leagues view rendering ───────────────────────────────────────────────────

function renderLeagues() {
  const container = document.getElementById('leagues-container');
  if (!container) return;

  const all = [...state.myLeagues];
  state.publicLeagues.forEach(l => {
    if (!all.some(a => a.id === l.id)) all.push(l);
  });

  const cardsHtml = all.length === 0
    ? `<div class="empty-state">${t('leagues.noPublic')}</div>`
    : all.map(league => {
        const isMember = state.myLeagues.some(ml => ml.id === league.id);
        return leagueCard(league, isMember);
      }).join('');

  container.innerHTML = `
    <div class="leagues-hero">
      <h2 data-i18n="leagues.title">${t('leagues.title')}</h2>
      <p data-i18n="leagues.subtitle">${t('leagues.subtitle')}</p>
    </div>

    <section class="leagues-section">
      <h3>${t('leagues.allHeading')}</h3>
      <div class="leagues-grid">${cardsHtml}</div>
    </section>

    ${isAdmin() ? `
    <div class="leagues-forms">
      <section class="leagues-form-card">
        <h3>${t('leagues.createHeading')}</h3>
        <div class="form-row">
          <input id="create-league-name" type="text" maxlength="60"
                 placeholder="${t('leagues.create.namePlaceholder')}">
        </div>
        <div class="form-row">
          <label class="create-league-type-label">
            <span>${t('leagues.create.type')}</span>
            <select id="create-league-type">
              <option value="groups">${t('leagues.create.typeGroups')}</option>
              <option value="knockout">${t('leagues.create.typeKnockout')}</option>
            </select>
          </label>
        </div>
        <div class="form-row">
          <button id="btn-create-league" class="btn btn-primary">${t('leagues.create.submit')}</button>
        </div>
        <div id="create-league-status" class="form-status"></div>
      </section>
    </div>
    ` : ''}
  `;

  bindLeaguesViewEvents();
}

function leagueCard(league, isMember) {
  const owned = league.ownerUid === state.uid;
  const isCurrent = league.id === state.leagueId;
  const memberCount = (league.memberUids || []).length;
  const memberLabel = memberCount === 1
    ? t('leagues.members', { n: 1 })
    : t('leagues.membersPlural', { n: memberCount });
  const ownerNote = owned ? `<span class="league-owner-note">★ ${t('leagues.owner')}</span>` : '';
  const typeTag = league.type === 'knockout'
    ? `<span class="league-type-tag knockout-tag">${t('knockout.tag')}</span>`
    : `<span class="league-type-tag groups-tag">${t('leagues.create.typeGroups')}</span>`;

  let actionHtml;
  if (isCurrent) {
    actionHtml = `<button class="btn btn-secondary league-card-current-btn" disabled>${t('leagues.current')}</button>`;
  } else if (isMember) {
    actionHtml = `<button class="btn btn-primary" data-league-enter="${league.id}">${t('leagues.enter')}</button>`;
  } else {
    actionHtml = `<button class="btn btn-primary" data-league-join-public="${league.id}">${t('leagues.join')}</button>`;
  }

  return `
    <div class="league-card${isCurrent ? ' is-current' : ''}">
      <div class="league-card-header">
        <h4>${escapeHtml(displayLeagueName(league.name))}</h4>
        ${typeTag}
      </div>
      <div class="league-card-meta">
        <span class="league-card-members">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
          ${memberLabel}
        </span>
        ${ownerNote}
      </div>
      <div class="league-card-actions">${actionHtml}</div>
    </div>`;
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c =>
    ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]
  );
}

function getInitials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  const first = parts[0].charAt(0);
  const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : '';
  return (first + last).toUpperCase() || '?';
}

function bindLeaguesViewEvents() {
  document.querySelectorAll('[data-league-enter]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.leagueEnter;
      await enterLeague(id);
      switchView(state.leagueType === 'knockout' ? 'knockout' : 'predictions');
    });
  });

  document.querySelectorAll('[data-league-join-public]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.leagueJoinPublic;
      try {
        const result = await joinLeague(id);
        showToast(t('leagues.joined.success', { name: result.name }));
        await loadMyLeagues();
        await enterLeague(id);
        switchView(state.leagueType === 'knockout' ? 'knockout' : 'predictions');
      } catch (err) {
        showToast(err.message);
      }
    });
  });

  const createBtn = document.getElementById('btn-create-league');
  if (!createBtn) return;
  createBtn.addEventListener('click', async () => {
    const name = document.getElementById('create-league-name').value.trim();
    const typeSel = document.getElementById('create-league-type');
    const type = typeSel ? typeSel.value : 'groups';
    const statusEl = document.getElementById('create-league-status');
    try {
      statusEl.textContent = '';
      const newId = await createLeague(name, type);
      statusEl.textContent = `✓ ${t('leagues.created')}`;
      statusEl.className = 'form-status status-ok';
      await loadMyLeagues();
      await enterLeague(newId);
      switchView(state.leagueType === 'knockout' ? 'knockout' : 'predictions');
    } catch (err) {
      statusEl.textContent = err.message;
      statusEl.className = 'form-status status-error';
    }
  });
}

function renderProfileLeagues() {
  const container = document.getElementById('profile-leagues-container');
  if (!container) return;

  const myLeagues = state.myLeagues || [];
  const currentId = state.leagueId;

  const rowsHtml = myLeagues.length === 0
    ? `<div class="empty-state">${t('profile.noLeagues')}</div>`
    : myLeagues.map(league => {
        const isCurrent = league.id === currentId;
        const memberCount = (league.memberUids || []).length;
        const memberLabel = memberCount === 1
          ? t('leagues.members', { n: 1 })
          : t('leagues.membersPlural', { n: memberCount });
        const typeTag = league.type === 'knockout'
          ? `<span class="league-type-tag">${t('knockout.tag')}</span>`
          : '';
        const action = isCurrent
          ? `<span class="profile-league-current" aria-label="${t('profile.currentLeague')}">✓ ${t('profile.currentLeague')}</span>`
          : `<button type="button" class="btn btn-secondary btn-sm" data-league-switch="${league.id}">${t('profile.switchLeague')}</button>`;
        return `
          <div class="profile-league-row${isCurrent ? ' is-current' : ''}">
            <div class="profile-league-info">
              <div class="profile-league-name">${escapeHtml(displayLeagueName(league.name))} ${typeTag}</div>
              <div class="profile-league-meta">${memberLabel}</div>
            </div>
            <div class="profile-league-action">${action}</div>
          </div>`;
      }).join('');

  const createForm = isAdmin() ? `
    <div class="profile-league-create">
      <label class="profile-label" for="profile-create-league-name" data-i18n="leagues.createHeading">${t('leagues.createHeading')}</label>
      <div class="form-row">
        <input id="profile-create-league-name" type="text" maxlength="60"
               placeholder="${t('leagues.create.namePlaceholder')}">
      </div>
      <div class="form-row">
        <label class="create-league-type-label">
          <span>${t('leagues.create.type')}</span>
          <select id="profile-create-league-type">
            <option value="groups">${t('leagues.create.typeGroups')}</option>
            <option value="knockout">${t('leagues.create.typeKnockout')}</option>
          </select>
        </label>
        <button id="profile-btn-create-league" class="btn btn-primary">${t('leagues.create.submit')}</button>
      </div>
      <div id="profile-create-league-status" class="form-status"></div>
    </div>` : '';

  container.innerHTML = `
    <div class="profile-leagues-list">${rowsHtml}</div>
    <div class="profile-leagues-actions">
      <button id="profile-btn-browse-leagues" class="btn btn-secondary btn-sm">${t('profile.browseLeagues')}</button>
    </div>
    ${createForm}
  `;

  container.querySelectorAll('[data-league-switch]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.leagueSwitch;
      btn.disabled = true;
      try {
        await enterLeague(id);
        switchView(state.leagueType === 'knockout' ? 'knockout' : 'predictions');
      } catch (err) {
        showToast(err.message);
        btn.disabled = false;
      }
    });
  });

  const browseBtn = container.querySelector('#profile-btn-browse-leagues');
  if (browseBtn) {
    browseBtn.addEventListener('click', () => { enterLeaguesView(); });
  }

  const createBtn = container.querySelector('#profile-btn-create-league');
  if (createBtn) {
    createBtn.addEventListener('click', async () => {
      const name = container.querySelector('#profile-create-league-name').value.trim();
      const typeSel = container.querySelector('#profile-create-league-type');
      const type = typeSel ? typeSel.value : 'groups';
      const statusEl = container.querySelector('#profile-create-league-status');
      try {
        statusEl.textContent = '';
        const newId = await createLeague(name, type);
        statusEl.textContent = `✓ ${t('leagues.created')}`;
        statusEl.className = 'form-status status-ok';
        await loadMyLeagues();
        await enterLeague(newId);
        switchView(state.leagueType === 'knockout' ? 'knockout' : 'predictions');
      } catch (err) {
        statusEl.textContent = err.message;
        statusEl.className = 'form-status status-error';
      }
    });
  }
}

function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.remove('hidden');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.add('hidden'), 2500);
}

init();
