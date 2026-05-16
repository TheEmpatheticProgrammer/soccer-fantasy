const PREDICTIONS_LOCK_DATE = new Date('2026-06-10T00:00:00');
const arePredictionsLocked = () => Date.now() >= PREDICTIONS_LOCK_DATE.getTime();

const Storage = {
  keys: { apiKey: 'wc2026_api_key', lastLeagueId: 'wc2026_last_league_id' },
  getApiKey()         { return localStorage.getItem(this.keys.apiKey) || ''; },
  setApiKey(k)        { localStorage.setItem(this.keys.apiKey, k); },
  getLastLeagueId()   { return localStorage.getItem(this.keys.lastLeagueId) || ''; },
  setLastLeagueId(id) { localStorage.setItem(this.keys.lastLeagueId, id); },
  clearLastLeagueId() { localStorage.removeItem(this.keys.lastLeagueId); },
};

const DEFAULT_LEAGUE_PASSWORD = 'wc2026';
const DEFAULT_LEAGUE_NAME = 'World Cup 2026 League';

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

  state.leagueId = leagueId;
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
    badge.textContent = state.currentLeague.name;
    badge.classList.remove('hidden');
  } else {
    badge.textContent = '';
    badge.classList.add('hidden');
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

function subscribeToPredictions() {
  if (!state.leagueId) return;
  const leagueId = state.leagueId;
  unsubPredictions = leaguePredictionsCol(leagueId).onSnapshot(
    snap => {
      state.predictionDocs = {};
      snap.forEach(doc => { state.predictionDocs[doc.id] = doc.data(); });

      const myDoc = state.predictionDocs[state.uid];
      if (myDoc && state.currentPlayer && myDoc.displayName !== state.currentPlayer) {
        leaguePredictionsCol(leagueId).doc(state.uid)
          .set({ displayName: state.currentPlayer }, { merge: true });
      }

      renderLeaderboard();
      renderPredictions();
      renderEveryone();
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
    },
    err => showToast(t('toast.resultsLoadFail', { msg: err.message }))
  );
}

function onProfileUpdated() {
  const user = firebase.auth().currentUser;
  if (!user) return;
  state.currentPlayer = user.displayName || user.email;
  document.getElementById('player-display').textContent = state.currentPlayer;
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

  isSaving = true;
  setAutosaveStatus('saving');
  try {
    await leaguePredictionsCol(state.leagueId).doc(state.uid).set({
      displayName,
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

    if (isAdmin()) {
      const apiResults = {};
      for (const m of data.matches) {
        if (m.result) apiResults[m.id] = m.result;
      }
      const merged = { ...state.results, ...apiResults };
      if (Object.keys(apiResults).length > 0) {
        await firebase.firestore().collection('results').doc('all').set({
          results: merged,
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

  container.innerHTML = lockBanner + Object.entries(state.groups).map(([group, teams]) => {
    const matches = state.matches.filter(m => m.group === group);
    return `
      <section class="prediction-group">
        <h3 class="prediction-group-title">${t('match.group', { letter: group })}</h3>
        <div class="prediction-group-rows">
          ${matches.map(m => matchCard(m, preds[m.id], state.results[m.id])).join('')}
        </div>
      </section>`;
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
  const pts = (result && pred.home !== undefined && pred.away !== undefined)
    ? calcPoints(pred, result) : null;

  const lockAttr = arePredictionsLocked() ? 'disabled' : '';
  const { day, time } = formatMatchDateParts(match.utcDate);

  let rightCell = '';
  if (result) {
    rightCell = `
      <span class="actual-pill">
        ${teamFlag(match.home)}
        <span class="actual-num">${result.home}</span>
        <span class="actual-dash">−</span>
        <span class="actual-num">${result.away}</span>
        ${teamFlag(match.away)}
      </span>
      ${pts !== null
        ? `<span class="match-points points-${pts}">${t('match.pts', { n: pts })}</span>`
        : ''}`;
  } else if (match.status && match.status !== 'SCHEDULED') {
    rightCell = `<span class="match-status status-${match.status.toLowerCase()}">${formatStatus(match.status)}</span>`;
  } else {
    rightCell = `<span class="actual-placeholder">—</span>`;
  }

  return `
    <div class="predict-row">
      <span class="match-date">
        <span class="match-date-day">${day}</span>
        <span class="match-date-time">${time}</span>
      </span>

      <div class="match-fixture">
        <span class="team home">${teamLabel(match.home, 'left')}</span>
        <input class="score-input" type="number" min="0" max="30" inputmode="numeric"
               data-match="${match.id}" data-side="home" value="${pred.home ?? ''}" ${lockAttr}>
        <span class="vs">−</span>
        <input class="score-input" type="number" min="0" max="30" inputmode="numeric"
               data-match="${match.id}" data-side="away" value="${pred.away ?? ''}" ${lockAttr}>
        <span class="team away">${teamLabel(match.away, 'right')}</span>
      </div>

      <div class="match-actual">
        ${rightCell}
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

  if (!arePredictionsLocked() && !isAdmin()) {
    container.innerHTML = `<div class="lock-banner">${t('predictions.everyoneLocked')}</div>`;
    return;
  }

  const others = Object.entries(state.predictionDocs).filter(([uid]) => uid !== state.uid);
  if (others.length === 0) {
    container.innerHTML = `<div class="empty-state">${t('predictions.noOthers')}</div>`;
    return;
  }

  container.innerHTML = Object.entries(state.groups).map(([group, teams]) => {
    const matches = state.matches.filter(m => m.group === group);
    return `
      <div class="group-section">
        <div class="group-header">
          <h2>${t('match.group', { letter: group })}</h2>
          <span class="group-teams">${teams.map(tCountry).join(' · ')}</span>
        </div>
        ${matches.map(m => everyoneMatchBlock(m, others)).join('')}
      </div>`;
  }).join('');
}

function everyoneMatchBlock(match, others) {
  const result = state.results[match.id];
  const resultText = result
    ? `<span class="other-match-result">${result.home}–${result.away} ${formatStatus(match.status || 'FINISHED')}</span>`
    : (match.status && match.status !== 'SCHEDULED'
        ? `<span class="match-status status-${match.status.toLowerCase()}">${formatStatus(match.status)}</span>`
        : '');

  const rows = others.map(([uid, doc]) => {
    const pred = doc.predictions?.[match.id];
    if (!pred) return null;
    const pts = result ? calcPoints(pred, result) : null;
    return `
      <div class="other-prediction-row">
        <span class="other-name">${doc.displayName || t('toast.unknown')}</span>
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
        ${resultText}
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

  const ownerCanRemove = isLeagueOwner();

  container.innerHTML = `
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
      const leagueName = state.currentLeague?.name || '';
      if (!confirm(t('leaderboard.removeConfirm', { name, league: leagueName }))) return;
      try {
        await removePlayerFromLeague(uid);
        showToast(t('leaderboard.removed', { name }));
      } catch (err) {
        showToast(err.message);
      }
    });
  });
}

// ── League CRUD ───────────────────────────────────────────────────────────────

async function createLeague(name, isPublic, password) {
  if (!name || name.trim().length < 3) throw new Error(t('leagues.create.invalidName'));
  if (!isPublic && (!password || password.length < 4)) throw new Error(t('leagues.create.invalidPassword'));

  const doc = {
    name: name.trim(),
    ownerUid: state.uid,
    isPublic: !!isPublic,
    joinPassword: isPublic ? '' : password,
    memberUids: [state.uid],
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  };

  const ref = await firebase.firestore().collection('leagues').add(doc);
  return ref.id;
}

async function joinLeague(leagueId, password) {
  const doc = await leagueDocRef(leagueId).get();
  if (!doc.exists) throw new Error(t('leagues.join.notFound'));
  const data = doc.data();
  if (!data.isPublic && data.joinPassword !== (password || '')) {
    throw new Error(t('leagues.join.wrongPassword'));
  }
  if (!data.memberUids.includes(state.uid)) {
    await leagueDocRef(leagueId).update({
      memberUids: firebase.firestore.FieldValue.arrayUnion(state.uid),
    });
  }
  return { id: leagueId, name: data.name };
}

async function leaveLeague(leagueId) {
  await leaguePredictionsCol(leagueId).doc(state.uid).delete().catch(() => {});
  await leagueDocRef(leagueId).update({
    memberUids: firebase.firestore.FieldValue.arrayRemove(state.uid),
  });
}

async function removePlayerFromLeague(playerUid) {
  if (!state.leagueId || !isLeagueOwner()) return;
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
    isPublic: false,
    joinPassword: DEFAULT_LEAGUE_PASSWORD,
    memberUids,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  })).id;

  const batch = firebase.firestore().batch();
  for (const d of allOld.docs) {
    batch.set(leaguePredictionsCol(newLeagueId).doc(d.id), d.data());
  }
  await batch.commit();

  showToast(`Migrated ${allOld.size} predictions into "${DEFAULT_LEAGUE_NAME}" (password: ${DEFAULT_LEAGUE_PASSWORD})`);
}

// ── Leagues view rendering ───────────────────────────────────────────────────

function renderLeagues() {
  const container = document.getElementById('leagues-container');
  if (!container) return;

  const yoursHtml = state.myLeagues.length === 0
    ? `<div class="empty-state">${t('leagues.noneJoined')}</div>`
    : state.myLeagues.map(league => leagueCard(league, true)).join('');

  const browseList = state.publicLeagues.filter(l => !state.myLeagues.some(ml => ml.id === l.id));
  const browseHtml = browseList.length === 0
    ? `<div class="empty-state">${t('leagues.noPublic')}</div>`
    : browseList.map(league => leagueCard(league, false)).join('');

  container.innerHTML = `
    <div class="leagues-hero">
      <h2 data-i18n="leagues.title">${t('leagues.title')}</h2>
      <p data-i18n="leagues.subtitle">${t('leagues.subtitle')}</p>
    </div>

    <section class="leagues-section">
      <h3>${t('leagues.yoursHeading')}</h3>
      <div class="leagues-grid">${yoursHtml}</div>
    </section>

    <section class="leagues-section">
      <h3>${t('leagues.browseHeading')}</h3>
      <div class="leagues-grid">${browseHtml}</div>
    </section>

    <div class="leagues-forms">
      <section class="leagues-form-card">
        <h3>${t('leagues.createHeading')}</h3>
        <div class="form-row">
          <input id="create-league-name" type="text" maxlength="60"
                 placeholder="${t('leagues.create.namePlaceholder')}">
        </div>
        <div class="form-row visibility-row">
          <label class="visibility-option">
            <input type="radio" name="create-visibility" value="public" checked>
            <span><strong>${t('leagues.public')}</strong> · ${t('leagues.create.publicHint')}</span>
          </label>
          <label class="visibility-option">
            <input type="radio" name="create-visibility" value="private">
            <span><strong>${t('leagues.private')}</strong> · ${t('leagues.create.privateHint')}</span>
          </label>
        </div>
        <div class="form-row hidden" id="create-password-wrap">
          <input id="create-league-password" type="text" maxlength="40"
                 placeholder="${t('leagues.create.passwordPlaceholder')}">
        </div>
        <div class="form-row">
          <button id="btn-create-league" class="btn btn-primary">${t('leagues.create.submit')}</button>
        </div>
        <div id="create-league-status" class="form-status"></div>
      </section>
    </div>
  `;

  bindLeaguesViewEvents();
}

function leagueCard(league, isMember) {
  const owned = league.ownerUid === state.uid;
  const memberCount = (league.memberUids || []).length;
  const memberLabel = memberCount === 1
    ? t('leagues.members', { n: 1 })
    : t('leagues.membersPlural', { n: memberCount });
  const lockIcon = !league.isPublic
    ? `<span class="league-lock" title="${t('leagues.private')}" aria-label="${t('leagues.private')}">
         <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
           <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
           <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
         </svg>
       </span>`
    : '';
  const ownerNote = owned ? `<span class="league-owner-note">★ ${t('leagues.owner')}</span>` : '';

  let actionHtml;
  if (isMember) {
    actionHtml = `<button class="btn btn-primary" data-league-enter="${league.id}">${t('leagues.enter')}</button>`;
  } else if (league.isPublic) {
    actionHtml = `<button class="btn btn-primary" data-league-join-public="${league.id}">${t('leagues.join')}</button>`;
  } else {
    actionHtml = `
      <button class="btn btn-primary" data-league-join-private-btn="${league.id}">${t('leagues.join')}</button>
      <form class="league-card-passform hidden" data-league-passform="${league.id}">
        <input type="password" class="league-card-passinput" autocomplete="off"
               placeholder="${t('leagues.join.passwordPlaceholder')}">
        <button type="submit" class="btn btn-primary">${t('leagues.join.submit')}</button>
        <button type="button" class="btn btn-secondary" data-league-passcancel="${league.id}" aria-label="Cancel">✕</button>
      </form>
      <div class="league-card-error form-status" data-league-error="${league.id}"></div>`;
  }

  return `
    <div class="league-card">
      <div class="league-card-header">
        <h4>${lockIcon}${escapeHtml(league.name)}</h4>
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
        const result = await joinLeague(id, '');
        showToast(t('leagues.joined.success', { name: result.name }));
        await loadMyLeagues();
        await enterLeague(id);
        switchView('predictions');
      } catch (err) {
        showToast(err.message);
      }
    });
  });

  document.querySelectorAll('[data-league-join-private-btn]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.leagueJoinPrivateBtn;
      btn.classList.add('hidden');
      const form = document.querySelector(`[data-league-passform="${id}"]`);
      form.classList.remove('hidden');
      form.querySelector('input').focus();
    });
  });

  document.querySelectorAll('[data-league-passcancel]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.leaguePasscancel;
      const form = document.querySelector(`[data-league-passform="${id}"]`);
      form.classList.add('hidden');
      form.querySelector('input').value = '';
      document.querySelector(`[data-league-join-private-btn="${id}"]`).classList.remove('hidden');
      const errEl = document.querySelector(`[data-league-error="${id}"]`);
      if (errEl) errEl.textContent = '';
    });
  });

  document.querySelectorAll('[data-league-passform]').forEach(form => {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = form.dataset.leaguePassform;
      const password = form.querySelector('input').value;
      const errEl = document.querySelector(`[data-league-error="${id}"]`);
      try {
        if (errEl) errEl.textContent = '';
        const result = await joinLeague(id, password);
        showToast(t('leagues.joined.success', { name: result.name }));
        await loadMyLeagues();
        await enterLeague(id);
        switchView('predictions');
      } catch (err) {
        if (errEl) { errEl.textContent = err.message; errEl.className = 'league-card-error form-status status-error'; }
      }
    });
  });

  document.querySelectorAll('input[name="create-visibility"]').forEach(input => {
    input.addEventListener('change', () => {
      const isPublic = document.querySelector('input[name="create-visibility"]:checked').value === 'public';
      document.getElementById('create-password-wrap').classList.toggle('hidden', isPublic);
    });
  });

  document.getElementById('btn-create-league').addEventListener('click', async () => {
    const name = document.getElementById('create-league-name').value.trim();
    const isPublic = document.querySelector('input[name="create-visibility"]:checked').value === 'public';
    const password = document.getElementById('create-league-password').value;
    const statusEl = document.getElementById('create-league-status');
    try {
      statusEl.textContent = '';
      const newId = await createLeague(name, isPublic, password);
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
