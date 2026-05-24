const PREDICTIONS_LOCK_DATE = new Date('2026-06-10T00:00:00');
const WORLD_CUP_START = new Date('2026-06-11T16:00:00-06:00');
const arePredictionsLocked = () => {
  if (state.currentLeague?.unlocked === true) return false;
  return Date.now() >= PREDICTIONS_LOCK_DATE.getTime();
};
const shouldRevealOthers = () => {
  if (state.currentLeague?.unlocked === true) return true;
  return Date.now() >= PREDICTIONS_LOCK_DATE.getTime();
};

const Storage = {
  keys: { apiKey: 'wc2026_api_key', lastLeagueId: 'wc2026_last_league_id' },
  getApiKey()         { return localStorage.getItem(this.keys.apiKey) || ''; },
  setApiKey(k)        { localStorage.setItem(this.keys.apiKey, k); },
  getLastLeagueId()   { return localStorage.getItem(this.keys.lastLeagueId) || ''; },
  setLastLeagueId(id) { localStorage.setItem(this.keys.lastLeagueId, id); },
  clearLastLeagueId() { localStorage.removeItem(this.keys.lastLeagueId); },
};

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
  myLeagues: [],
  publicLeagues: [],
  predictionDocs: {},
  results: {},
  groups:  { ...GROUPS },
  matches: [...ALL_MATCHES],
  crests: {},
  apiKey: '',
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
  renderKickoffHero();

  firebase.auth().onAuthStateChanged(user => {
    if (user) onSignedIn(user);
    else      onSignedOut();
  });
}

async function onSignedIn(user) {
  state.uid = user.uid;
  state.currentPlayer = user.displayName || user.email;

  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('player-display').textContent = state.currentPlayer;
  renderKickoffHero();
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
  switchView('predictions');
}

async function enterLeague(leagueId) {
  if (unsubPredictions) { unsubPredictions(); unsubPredictions = null; }
  if (unsubLeague)      { unsubLeague();      unsubLeague = null; }

  state.leagueId = leagueId;
  state.predictionsRendered = false;
  state.everyoneRendered = false;
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

  document.querySelectorAll('.league-owner-only').forEach(el =>
    el.classList.toggle('hidden', !isLeagueOwner())
  );

  document.getElementById('admin-panel').classList.toggle('hidden', !isAdmin());

  updateCurrentLeagueBadge();
  subscribeToPredictions();
  subscribeToLeague();
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
      renderPredictions();
      renderEveryone();
      renderLeaderboard();
    },
    err => console.error('league subscription error', err)
  );
}

async function enterLeaguesView() {
  state.leagueId = null;
  state.currentLeague = null;
  state.predictionDocs = {};
  if (unsubPredictions) { unsubPredictions(); unsubPredictions = null; }
  updateCurrentLeagueBadge();
  await loadPublicLeagues();
  switchView('leagues');
  renderLeagues();
}

function updateCurrentLeagueBadge() {
  const badge = document.getElementById('current-league-badge');
  if (!badge) return;
  if (state.currentLeague) {
    badge.textContent = displayLeagueName(state.currentLeague.name);
    badge.classList.remove('hidden');
  } else {
    badge.textContent = '';
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
  const countdownEl = document.getElementById('countdown-pill');
  if (!rankEl || !countdownEl) return;

  if (!state.currentLeague) {
    rankEl.classList.add('hidden');
    countdownEl.classList.add('hidden');
    return;
  }

  const myRank = computeMyRank();
  if (myRank) {
    rankEl.textContent = `${t('header.rank')} #${myRank.rank} · ${myRank.points} ${t('header.points')}`;
    rankEl.classList.remove('hidden');
  } else {
    rankEl.classList.add('hidden');
  }

  let label, kind;
  if (state.currentLeague.unlocked === true) {
    countdownEl.classList.add('hidden');
    return;
  } else {
    const remaining = formatCountdown(PREDICTIONS_LOCK_DATE.getTime());
    if (!remaining) {
      label = t('header.tournamentLive');
      kind = 'live';
    } else {
      label = t('header.locksIn', { time: remaining });
      kind = 'pending';
    }
  }
  countdownEl.textContent = label;
  countdownEl.dataset.kind = kind;
  countdownEl.classList.remove('hidden');
}

let countdownInterval = null;
function startCountdownInterval() {
  if (countdownInterval) return;
  countdownInterval = setInterval(() => {
    renderHeaderStats();
    renderKickoffHero();
  }, 60000);
}

function renderKickoffHero() {
  const targets = [
    { d: 'kickoff-days', h: 'kickoff-hours', m: 'kickoff-mins', wrap: 'kickoff-hero' },
    { d: 'auth-kickoff-days', h: 'auth-kickoff-hours', m: 'auth-kickoff-mins', wrap: null },
  ];
  const diff = WORLD_CUP_START.getTime() - Date.now();
  const live = diff <= 0;
  const days  = live ? 0 : Math.floor(diff / 86400000);
  const hours = live ? 0 : Math.floor((diff % 86400000) / 3600000);
  const mins  = live ? 0 : Math.floor((diff % 3600000) / 60000);

  for (const ids of targets) {
    const dEl = document.getElementById(ids.d);
    const hEl = document.getElementById(ids.h);
    const mEl = document.getElementById(ids.m);
    if (!dEl || !hEl || !mEl) continue;
    dEl.textContent = String(days).padStart(2, '0');
    hEl.textContent = String(hours).padStart(2, '0');
    mEl.textContent = String(mins).padStart(2, '0');
    if (ids.wrap) {
      const wrap = document.getElementById(ids.wrap);
      if (wrap) {
        wrap.classList.toggle('hidden', !state.uid);
        wrap.classList.toggle('is-live', live);
      }
    }
  }
}

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

  document.getElementById('auth-screen').classList.remove('hidden');
  document.getElementById('settings-panel').classList.add('hidden');
  updateCurrentLeagueBadge();
}

function renderProfile() {
  const user = firebase.auth().currentUser;
  if (!user) return;
  document.getElementById('profile-email').textContent = user.email;
  document.getElementById('profile-name-input').value = user.displayName || '';
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

      renderLeaderboard();
      renderPredictions();
      renderEveryone();
      renderHeaderStats();
      renderPlayerCard();
    },
    err => showToast(t('toast.predLoadFail', { msg: err.message }))
  );
}

function subscribeToResults() {
  unsubResults = firebase.firestore().collection('results').doc('all').onSnapshot(
    doc => {
      state.results = doc.exists ? (doc.data().results || {}) : {};
      renderAdminMatches();
      renderLeaderboard();
      renderPredictions();
      renderEveryone();
      renderHeaderStats();
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
  const count = Object.keys(preds).filter(id =>
    preds[id]?.home !== undefined && preds[id]?.away !== undefined
  ).length;
  const countEl = document.getElementById('picks-count');
  const totalEl = document.getElementById('picks-total');
  if (countEl) countEl.textContent = count;
  if (totalEl) totalEl.textContent = total;
}

function refreshDynamicContent() {
  refreshAuthLabels?.();
  renderAdminMatches();
  renderLeaderboard();
  renderPredictions();
  renderEveryone();
  if (state.leagueId === null) renderLeagues();
  refreshApiStatus();
  refreshSaveStatus();
  renderHeaderStats();
  updateCurrentLeagueBadge();
  renderKickoffHero();
  renderPlayerCard();
  document.querySelectorAll('.nav-btn.requires-league').forEach(btn => {
    btn.classList.toggle('hidden', !state.leagueId);
  });
}

function bindEvents() {
  document.querySelectorAll('.nav-btn[data-view]').forEach(btn =>
    btn.addEventListener('click', () => switchView(btn.dataset.view))
  );

  document.querySelectorAll('.sub-tab').forEach(btn =>
    btn.addEventListener('click', () => switchSubview(btn.dataset.subtab))
  );

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

async function runAutosave() {
  if (!state.uid || !state.leagueId || arePredictionsLocked() || isSaving) return;

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

async function loadFromApi(force = false) {
  if (!hasApiAccess()) { showApiStatus('settings.noKey', 'warn'); return; }

  setRefreshing(true);
  showApiStatus('settings.loading', 'info');

  try {
    const data = await loadWorldCupData(state.apiKey, force);

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

  } catch (err) {
    showApiStatus('settings.error', 'error', { msg: err.message });
  } finally {
    setRefreshing(false);
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

function formatTimeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60)   return t('time.justNow');
  if (s < 3600) return t('time.minutes', { n: Math.floor(s / 60) });
  return t('time.hours', { n: Math.floor(s / 3600) });
}

function switchView(view) {
  if ((view === 'predictions' || view === 'leaderboard') && !state.leagueId) {
    view = 'leagues';
  }
  document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
  const target = document.getElementById(`view-${view}`);
  target.classList.remove('hidden');
  playEnterAnimation(target);
  document.querySelectorAll('.nav-btn[data-view]').forEach(btn =>
    btn.classList.toggle('active', btn.dataset.view === view)
  );
  if (view === 'leaderboard') renderLeaderboard();
  if (view === 'predictions') { renderPredictions(); renderEveryone(); }
  if (view === 'leagues') { loadPublicLeagues().then(renderLeagues); }

  // Auto-refresh API data when entering predictions/leaderboard. ApiCache
  // (5min TTL) prevents hammering; admin's call additionally fans out to
  // Firestore so others' onSnapshot picks up the new results.
  if ((view === 'predictions' || view === 'leaderboard') && hasApiAccess()) {
    loadFromApi(false).catch(() => { /* errors surface via api-status pill */ });
  }
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
  if (name === 'everyone') renderEveryone();
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

function renderPredictions() {
  if (!state.uid) return;
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

  const lockBanner = arePredictionsLocked()
    ? `<div class="lock-banner">${t('predictions.locked')}</div>`
    : '';

  const columnHeader = '';

  const openPredictionGroups = captureOpenGroups('matches-container');
  const predictionsFirstRender = !state.predictionsRendered;
  state.predictionsRendered = true;

  container.innerHTML = lockBanner + columnHeader + Object.entries(state.groups).map(([group, teams], i) => {
    const matches = state.matches.filter(m => m.group === group);
    const isOpen = predictionsFirstRender ? i === 0 : openPredictionGroups.has(group);
    const resetBtn = arePredictionsLocked()
      ? ''
      : `<button type="button" class="group-reset-btn" data-reset-group="${group}" title="${t('predictions.resetGroup')}">${t('predictions.resetGroup')}</button>`;
    let groupPts = 0;
    let groupPredicted = 0;
    for (const m of matches) {
      const p = preds[m.id];
      if (p && p.home !== undefined && p.away !== undefined) {
        groupPredicted++;
        const actual = state.results[m.id];
        if (actual) groupPts += calcPoints(p, actual);
      }
    }
    return `
      <details class="prediction-group" data-group="${group}"${isOpen ? ' open' : ''}>
        <summary class="prediction-group-title">
          <span class="group-letter-badge">${group}</span>
          <span class="group-letter-text">${t('match.group', { letter: group })}</span>
          <span class="group-stats">
            <span class="group-stats-pts">${groupPts} ${t('header.points')}</span>
            <span class="group-stats-sep">·</span>
            <span class="group-stats-predicted">${groupPredicted}/${matches.length}</span>
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

  restoreInputDraft(draft);
  if (focusInfo) {
    const sel = `.score-input[data-match="${focusInfo.match}"][data-side="${focusInfo.side}"]`;
    document.querySelector(sel)?.focus();
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

function matchCard(match, pred = {}, result) {
  const hasPred = pred.home !== undefined && pred.away !== undefined;
  const pts = (result && hasPred) ? calcPoints(pred, result) : null;

  const lockAttr = arePredictionsLocked() ? 'disabled' : '';
  const { day, time } = formatMatchDateParts(match.utcDate);
  const venue = displayVenue(venueForMatch(match));
  const playerInitial = getInitials(state.currentPlayer);

  const rowClass = pts === 3 ? 'predict-row pts-exact'
                 : pts === 1 ? 'predict-row pts-partial'
                 : pts === 0 ? 'predict-row pts-miss'
                 : 'predict-row';

  const statusIcon = result === undefined || result === null
    ? `<span class="actual-status status-tbd">${t('match.tbd')}</span>`
    : pts === 3
      ? `<span class="actual-status status-label status-exact">${t('match.actual')}</span>`
      : pts === 1
        ? `<span class="actual-status status-label status-partial">${t('match.actual')}</span>`
        : pts === 0
          ? `<span class="actual-status status-label status-miss">${t('match.actual')}</span>`
          : `<span class="actual-status status-label status-neutral">${t('match.actual')}</span>`;

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
    <div class="${rowClass}">
      <div class="match-meta-line">
        <span class="meta-day">${day}</span>
        <span class="meta-sep">·</span>
        <span class="meta-time">${time}</span>
        ${venue ? `<span class="meta-sep">·</span><span class="meta-venue">${escapeHtml(venue)}</span>` : ''}
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
        <div class="actual-side">
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

  if (state.matches.length === 0) {
    container.innerHTML = skeletonMatchCards(4);
    return;
  }

  if (!shouldRevealOthers() && !isAdmin() && !isLeagueOwner()) {
    container.innerHTML = `<div class="lock-banner">${t('predictions.everyoneLocked')}</div>`;
    return;
  }

  const participants = Object.entries(state.predictionDocs);
  if (participants.length === 0) {
    container.innerHTML = `<div class="empty-state">${t('predictions.noOthers')}</div>`;
    return;
  }

  const openEveryoneGroups = captureOpenGroups('everyone-container');
  const everyoneFirstRender = !state.everyoneRendered;
  state.everyoneRendered = true;

  const everyoneColumnHeader = `
    <div class="everyone-column-header">
      <span></span>
      <span class="column-header-label">${t('match.actualResults')}</span>
    </div>`;

  container.innerHTML = everyoneColumnHeader + Object.entries(state.groups).map(([group, teams], i) => {
    const matches = state.matches.filter(m => m.group === group);
    const isOpen = everyoneFirstRender ? i === 0 : openEveryoneGroups.has(group);
    return `
      <details class="group-section" data-group="${group}"${isOpen ? ' open' : ''}>
        <summary class="group-header">
          <h2>${t('match.group', { letter: group })}</h2>
          <span class="group-teams">${teams.map(tCountry).join(' · ')}</span>
          <svg class="group-chevron" viewBox="0 0 12 12" aria-hidden="true">
            <path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </summary>
        ${matches.map(m => everyoneMatchBlock(m, participants)).join('')}
      </details>`;
  }).join('');
}

function captureOpenGroups(containerId) {
  const open = new Set();
  document.querySelectorAll(`#${containerId} details[data-group]`).forEach(el => {
    if (el.open) open.add(el.dataset.group);
  });
  return open;
}

function everyoneMatchBlock(match, participants) {
  const result = state.results[match.id];

  let rightCell = '';
  if (result) {
    rightCell = `
      <span class="actual-pill">
        ${teamFlag(match.home)}
        <span class="actual-num">${result.home}</span>
        <span class="actual-dash">−</span>
        <span class="actual-num">${result.away}</span>
        ${teamFlag(match.away)}
      </span>`;
  } else if (match.status === 'IN_PLAY' || match.status === 'PAUSED') {
    rightCell = `<span class="match-status status-${match.status.toLowerCase()}">${formatStatus(match.status)}</span>`;
  }

  const rows = participants.map(([uid, doc]) => {
    const pred = doc.predictions?.[match.id];
    if (!pred) return null;
    const pts = result ? calcPoints(pred, result) : null;
    const isSelf = uid === state.uid;
    return `
      <div class="other-prediction-row${isSelf ? ' is-self' : ''}">
        <span class="other-name">${doc.displayName || t('toast.unknown')}${isSelf ? ' <span class="self-tag">you</span>' : ''}</span>
        <span class="other-score">${pred.home}–${pred.away}</span>
        <span class="match-points ${pts !== null ? `points-${pts}` : 'points-none'}">
          ${pts !== null ? t('match.pts', { n: pts }) : ''}
        </span>
      </div>`;
  }).filter(Boolean);

  return `
    <div class="other-match-block">
      <div class="other-match-header">
        <span class="other-teams">${teamLabel(match.home)} <span class="vs-small">${t('match.vs')}</span> ${teamLabel(match.away)}</span>
        ${rightCell}
      </div>
      ${rows.length > 0
        ? rows.join('')
        : `<div class="empty-state-small">${t('predictions.noPredsForMatch')}</div>`}
    </div>`;
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
  if (pred.home === actual.home && pred.away === actual.away) return 3;
  const predOutcome   = Math.sign(pred.home   - pred.away);
  const actualOutcome = Math.sign(actual.home - actual.away);
  return predOutcome === actualOutcome ? 1 : 0;
}

function renderLeaderboard() {
  const container = document.getElementById('leaderboard-container');
  const total = state.matches.length;
  const players = Object.entries(state.predictionDocs);

  if (players.length === 0) {
    container.innerHTML = `<div class="empty-state">${t('leaderboard.empty')}</div>`;
    return;
  }

  const standings = players.map(([uid, doc]) => {
    const preds = doc.predictions || {};
    let points = 0, scored = 0;
    for (const [matchId, pred] of Object.entries(preds)) {
      const actual = state.results[matchId];
      if (!actual) continue;
      points += calcPoints(pred, actual);
      scored++;
    }
    return {
      uid,
      name: doc.displayName || t('toast.unknown'),
      points,
      scored,
      predicted: Object.keys(preds).length,
    };
  }).sort((a, b) => b.points - a.points || b.predicted - a.predicted);

  const ownerCanRemove = isLeagueOwner() || isAdmin();
  const isUnlocked = state.currentLeague?.unlocked === true;
  const adminOnly = isAdmin();

  const memberUids = state.currentLeague?.memberUids || [];
  const allMemberUids = Array.from(new Set([
    ...memberUids,
    ...Object.keys(state.predictionDocs || {}),
  ]));
  const membersListHtml = adminOnly && allMemberUids.length > 0 ? allMemberUids.map(uid => {
    const doc = state.predictionDocs[uid] || {};
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
          <div class="owner-tool-title">${t('leaderboard.lockToggleTitle')}</div>
          <div class="owner-tool-hint">${t('leaderboard.lockToggleHint')}</div>
        </div>
        <button id="btn-toggle-lock" class="lock-toggle-btn ${isUnlocked ? 'is-unlocked' : ''}"
                aria-pressed="${isUnlocked}">
          <span class="lock-toggle-icon" aria-hidden="true">${isUnlocked ? '🔓' : '🔒'}</span>
          <span class="lock-toggle-label">${isUnlocked ? t('leaderboard.unlocked') : t('leaderboard.locked')}</span>
        </button>
      </div>
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

  container.innerHTML = `
    ${ownerToolsHtml}
    ${adminMembersHtml}
    <table class="leaderboard-table">
      <thead>
        <tr>
          <th>#</th>
          <th>${t('leaderboard.player')}</th>
          <th>${t('leaderboard.points')}</th>
          <th>${t('leaderboard.matchesScored')}</th>
          <th>${t('leaderboard.predictionsMade')}</th>
          ${ownerCanRemove ? '<th></th>' : ''}
        </tr>
      </thead>
      <tbody>
        ${standings.map((player, i) => {
          const rank = i + 1;
          const rankClass = rank <= 3 ? `rank-${rank}` : 'rank-other';
          const removeCell = ownerCanRemove && player.uid !== state.uid
            ? `<td><button class="btn-remove-player" data-remove-uid="${player.uid}" data-remove-name="${escapeHtml(player.name)}" title="${t('leaderboard.removePlayer')}" aria-label="${t('leaderboard.removePlayer')}">
                 <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                   <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                 </svg>
               </button></td>`
            : (ownerCanRemove ? '<td></td>' : '');
          return `
            <tr${player.uid === state.uid ? ' class="current-player"' : ''}>
              <td><span class="rank-badge ${rankClass}">${rank}</span></td>
              <td>${player.name}</td>
              <td><span class="points-display">${player.points}</span></td>
              <td>${player.scored} / ${total}</td>
              <td>${player.predicted} / ${total}</td>
              ${removeCell}
            </tr>`;
        }).join('')}
      </tbody>
    </table>`;

  document.querySelectorAll('.btn-remove-player').forEach(btn => {
    btn.addEventListener('click', async () => {
      const uid = btn.dataset.removeUid;
      const name = btn.dataset.removeName;
      const leagueName = displayLeagueName(state.currentLeague?.name) || '';
      if (!confirm(t('leaderboard.removeConfirm', { name, league: leagueName }))) return;
      try {
        await removePlayerFromLeague(uid);
        showToast(t('leaderboard.removed', { name }));
      } catch (err) {
        showToast(err.message);
      }
    });
  });

  const lockBtn = document.getElementById('btn-toggle-lock');
  if (lockBtn) {
    lockBtn.addEventListener('click', async () => {
      if (!state.leagueId || (!isLeagueOwner() && !isAdmin())) return;
      const next = !(state.currentLeague?.unlocked === true);
      lockBtn.disabled = true;
      try {
        await leagueDocRef(state.leagueId).update({ unlocked: next });
      } catch (err) {
        showToast(err.message);
      } finally {
        lockBtn.disabled = false;
      }
    });
  }

  const exportBtn = document.getElementById('btn-export-predictions');
  if (exportBtn) {
    exportBtn.addEventListener('click', exportPredictionsCSV);
  }

  const resetBtn = document.getElementById('btn-reset-league');
  if (resetBtn) {
    resetBtn.addEventListener('click', async () => {
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
    });
  }
}

function exportPredictionsCSV() {
  const players = Object.entries(state.predictionDocs);
  if (players.length === 0) {
    showToast(t('leaderboard.exportEmpty'));
    return;
  }

  const playerNames = players.map(([, doc]) => doc.displayName || '(unknown)');

  const playerScoreHeaders = playerNames.flatMap(name => [`${name} (H)`, `${name} (A)`]);

  // Pivot layout — one row per match, one column per team per player, separate home/away cells.
  const headers = [
    'Group',
    'Date (UTC)',
    'Home',
    'Away',
    ...playerScoreHeaders,
    'Actual H',
    'Actual A',
    ...playerNames.map(name => `${name} (pts)`),
  ];

  const sortedMatches = [...state.matches].sort((a, b) => {
    if (a.group !== b.group) return a.group.localeCompare(b.group);
    return (a.utcDate || '').localeCompare(b.utcDate || '');
  });

  const lines = [headers.map(csvEscape).join(',')];

  for (const match of sortedMatches) {
    const result = state.results[match.id];
    const actualHome = result ? result.home : '';
    const actualAway = result ? result.away : '';

    const playerScoreCells = players.flatMap(([, doc]) => {
      const pred = doc.predictions?.[match.id];
      return pred
        ? [pred.home ?? '', pred.away ?? '']
        : ['', ''];
    });

    const playerPts = players.map(([, doc]) => {
      const pred = doc.predictions?.[match.id];
      if (!pred || !result) return '';
      return calcPoints(pred, result);
    });

    const row = [
      match.group,
      match.utcDate || '',
      match.home,
      match.away,
      ...playerScoreCells,
      actualHome,
      actualAway,
      ...playerPts,
    ];
    lines.push(row.map(csvEscape).join(','));
  }

  // Totals row
  const totals = players.map(([, doc]) => {
    const preds = doc.predictions || {};
    let total = 0;
    for (const [matchId, pred] of Object.entries(preds)) {
      const actual = state.results[matchId];
      if (!actual) continue;
      total += calcPoints(pred, actual);
    }
    return total;
  });
  const totalRow = [
    '', '', '', 'TOTAL',
    ...players.flatMap(() => ['', '']),
    '', '',
    ...totals,
  ];
  lines.push(totalRow.map(csvEscape).join(','));

  const csv = lines.join('\r\n');
  const leagueName = (displayLeagueName(state.currentLeague?.name) || 'predictions').replace(/[^\w-]+/g, '_');
  const stamp = new Date().toISOString().slice(0, 10);
  downloadCSV(csv, `${leagueName}_${stamp}.csv`);
  showToast(t('leaderboard.exportDone', { n: sortedMatches.length, p: players.length }));
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

async function createLeague(name) {
  if (!name || name.trim().length < 3) throw new Error(t('leagues.create.invalidName'));

  const doc = {
    name: name.trim(),
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
  const memberCount = (league.memberUids || []).length;
  const memberLabel = memberCount === 1
    ? t('leagues.members', { n: 1 })
    : t('leagues.membersPlural', { n: memberCount });
  const ownerNote = owned ? `<span class="league-owner-note">★ ${t('leagues.owner')}</span>` : '';

  const actionHtml = isMember
    ? `<button class="btn btn-primary" data-league-enter="${league.id}">${t('leagues.enter')}</button>`
    : `<button class="btn btn-primary" data-league-join-public="${league.id}">${t('leagues.join')}</button>`;

  return `
    <div class="league-card">
      <div class="league-card-header">
        <h4>${escapeHtml(displayLeagueName(league.name))}</h4>
      </div>
      <div class="league-card-meta">
        <span>${memberLabel}</span>
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
      switchView('predictions');
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
        switchView('predictions');
      } catch (err) {
        showToast(err.message);
      }
    });
  });

  const createBtn = document.getElementById('btn-create-league');
  if (!createBtn) return;
  createBtn.addEventListener('click', async () => {
    const name = document.getElementById('create-league-name').value.trim();
    const statusEl = document.getElementById('create-league-status');
    try {
      statusEl.textContent = '';
      const newId = await createLeague(name);
      statusEl.textContent = `✓ ${t('leagues.created')}`;
      statusEl.className = 'form-status status-ok';
      await loadMyLeagues();
      await enterLeague(newId);
      switchView('predictions');
    } catch (err) {
      statusEl.textContent = err.message;
      statusEl.className = 'form-status status-error';
    }
  });
}

function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.remove('hidden');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.add('hidden'), 2500);
}

init();
