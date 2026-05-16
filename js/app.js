const PREDICTIONS_LOCK_DATE = new Date('2026-06-10T00:00:00');
const arePredictionsLocked = () => Date.now() >= PREDICTIONS_LOCK_DATE.getTime();

const Storage = {
  keys: { apiKey: 'wc2026_api_key' },
  getApiKey()  { return localStorage.getItem(this.keys.apiKey) || ''; },
  setApiKey(k) { localStorage.setItem(this.keys.apiKey, k); },
};

const state = {
  uid: null,
  currentPlayer: '',
  predictionDocs: {},
  results: {},
  groups:  { ...GROUPS },
  matches: [...ALL_MATCHES],
  crests: {},
  apiKey: '',
};

function teamLabel(name) {
  const crest = state.crests[name];
  const flag = crest
    ? `<img class="team-flag" src="${crest}" alt="" loading="lazy" decoding="async">`
    : '';
  return `${flag}<span class="team-name">${tCountry(name)}</span>`;
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
  document.getElementById('user-info').classList.remove('hidden');
  document.getElementById('user-display-email').textContent = user.email;
  document.getElementById('player-display').textContent = state.currentPlayer;

  document.getElementById('admin-panel').classList.toggle('hidden', !isAdmin());
  document.getElementById('btn-refresh').disabled = !state.apiKey;

  state.apiKey = Storage.getApiKey() || window.LOCAL_CONFIG?.apiKey || '';
  document.getElementById('api-key-input').value = state.apiKey;

  subscribeToPredictions();
  subscribeToResults();

  if (state.apiKey) {
    await loadFromApi(false);
  } else {
    showApiStatus('settings.enterKey', 'warn');
  }
}

function onSignedOut() {
  state.uid = null;
  state.currentPlayer = '';
  state.predictionDocs = {};
  state.results = {};

  if (unsubPredictions) { unsubPredictions(); unsubPredictions = null; }
  if (unsubResults)     { unsubResults();     unsubResults = null; }

  document.getElementById('auth-screen').classList.remove('hidden');
  document.getElementById('user-info').classList.add('hidden');
  document.getElementById('settings-panel').classList.add('hidden');
}

function subscribeToPredictions() {
  unsubPredictions = firebase.firestore().collection('predictions').onSnapshot(
    snap => {
      state.predictionDocs = {};
      snap.forEach(doc => { state.predictionDocs[doc.id] = doc.data(); });

      const myDoc = state.predictionDocs[state.uid];
      if (myDoc && state.currentPlayer && myDoc.displayName !== state.currentPlayer) {
        firebase.firestore().collection('predictions').doc(state.uid)
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
  if (!state.uid || arePredictionsLocked() || isSaving) return;

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
    await firebase.firestore().collection('predictions').doc(state.uid).set({
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
  if (!state.apiKey) { showApiStatus('settings.noKey', 'warn'); return; }

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
      <div class="group-section">
        <div class="group-header">
          <h2>${t('match.group', { letter: group })}</h2>
          <span class="group-teams">${teams.map(tCountry).join(' · ')}</span>
        </div>
        ${matches.map(m => matchCard(m, preds[m.id], state.results[m.id])).join('')}
      </div>`;
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

  const statusBadge = match.status && match.status !== 'SCHEDULED'
    ? `<span class="match-status status-${match.status.toLowerCase()}">${formatStatus(match.status)}</span>`
    : '';

  const pointsBadge = pts !== null
    ? `<span class="match-points points-${pts}">${t('match.pts', { n: pts })}</span>`
    : '';

  const lockAttr = arePredictionsLocked() ? 'disabled' : '';

  const actualRow = result ? `
    <div class="score-row actual-row">
      <span class="score-label">${t('match.actual')}</span>
      <span class="score-static">${result.home}</span>
      <span class="vs">−</span>
      <span class="score-static">${result.away}</span>
    </div>` : '';

  return `
    <div class="match-card">
      <div class="match-card-top">
        <span class="match-card-date">${formatMatchDateTime(match.utcDate)}</span>
        <span class="match-card-meta">
          ${statusBadge}
          ${pointsBadge}
        </span>
      </div>
      <div class="match-card-fixture">
        <div class="team-side home">
          ${teamFlag(match.home)}
          <span class="team-name">${tCountry(match.home)}</span>
        </div>
        <span class="fixture-vs">${t('match.vs')}</span>
        <div class="team-side away">
          <span class="team-name">${tCountry(match.away)}</span>
          ${teamFlag(match.away)}
        </div>
      </div>
      <div class="match-card-body">
        <div class="score-row your-row">
          <span class="score-label">${t('match.yourPick')}</span>
          <input class="score-input" type="number" min="0" max="30" inputmode="numeric"
                 data-match="${match.id}" data-side="home" value="${pred.home ?? ''}" ${lockAttr}>
          <span class="vs">−</span>
          <input class="score-input" type="number" min="0" max="30" inputmode="numeric"
                 data-match="${match.id}" data-side="away" value="${pred.away ?? ''}" ${lockAttr}>
        </div>
        ${actualRow}
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

  if (!arePredictionsLocked()) {
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

  container.innerHTML = `
    <table class="leaderboard-table">
      <thead>
        <tr>
          <th>#</th>
          <th>${t('leaderboard.player')}</th>
          <th>${t('leaderboard.points')}</th>
          <th>${t('leaderboard.matchesScored')}</th>
          <th>${t('leaderboard.predictionsMade')}</th>
        </tr>
      </thead>
      <tbody>
        ${standings.map((player, i) => {
          const rank = i + 1;
          const rankClass = rank <= 3 ? `rank-${rank}` : 'rank-other';
          return `
            <tr${player.uid === state.uid ? ' class="current-player"' : ''}>
              <td><span class="rank-badge ${rankClass}">${rank}</span></td>
              <td>${player.name}</td>
              <td><span class="points-display">${player.points}</span></td>
              <td>${player.scored} / ${total}</td>
              <td>${player.predicted} / ${total}</td>
            </tr>`;
        }).join('')}
      </tbody>
    </table>`;
}

function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.remove('hidden');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.add('hidden'), 2500);
}

init();
