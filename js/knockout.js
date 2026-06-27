// Knockout-stage rendering, scoring, autosave, and Firestore subscriptions.
// All knockout state lives under `state.knockout.*` to keep it separate from
// the group-stage state. Firestore paths mirror the group flow but under a
// distinct subcollection (`knockoutPredictions`) and document (`knockoutResults/all`).

const KNOCKOUT_ROUND_ORDER = ['LAST_32', 'LAST_16', 'QUARTER_FINALS', 'SEMI_FINALS', 'FINAL', 'THIRD_PLACE'];

function knockoutRoundLabel(stage) {
  switch (stage) {
    case 'LAST_32':        return t('knockout.round32');
    case 'LAST_16':        return t('knockout.round16');
    case 'QUARTER_FINALS': return t('knockout.quarterFinals');
    case 'SEMI_FINALS':    return t('knockout.semiFinals');
    case 'THIRD_PLACE':    return t('knockout.thirdPlace');
    case 'FINAL':          return t('knockout.final');
    default:               return stage;
  }
}

function knockoutPredictionsCol(leagueId) {
  return firebase.firestore().collection('leagues').doc(leagueId).collection('knockoutPredictions');
}

function knockoutResultsRef() {
  return firebase.firestore().collection('knockoutResults').doc('all');
}

// Live results merged with demo overlay (when demo mode is on). Real results
// always win over demo so admin-entered scores override the mock.
function getKnockoutResults() {
  const base = state.knockout?.results || {};
  const demoOn = typeof Storage !== 'undefined' && Storage.getKnockoutDemo && Storage.getKnockoutDemo();
  if (!demoOn) return base;
  const demo = (typeof buildKnockoutDemoResultsById === 'function') ? buildKnockoutDemoResultsById() : {};
  return { ...demo, ...base };
}

// 3 = exact full-time score (regulation + extra time, ignoring penalties)
// 1 = correct advancer (derived from score; for ties, the manual penalty pick)
// 0 = otherwise
function calcKnockoutPoints(pred, actual) {
  if (!pred || pred.home == null || pred.away == null) return null;
  if (!actual || actual.home == null || actual.away == null) return null;
  if (pred.home === actual.home && pred.away === actual.away) return 3;
  const winnerOf = s => s.home > s.away ? 'home' : s.away > s.home ? 'away' : (s.winnerPick || null);
  const pw = winnerOf(pred);
  const aw = winnerOf(actual);
  return pw && aw && pw === aw ? 1 : 0;
}

let unsubKnockoutPredictions = null;
let unsubKnockoutResults = null;

function subscribeToKnockoutPredictions() {
  if (!state.leagueId) return;
  const leagueId = state.leagueId;
  unsubKnockoutPredictions = knockoutPredictionsCol(leagueId).onSnapshot(
    snap => {
      state.knockout.predictionDocs = {};
      snap.forEach(doc => { state.knockout.predictionDocs[doc.id] = doc.data(); });
      state.knockout.predVersion = (state.knockout.predVersion || 0) + 1;

      const myDoc = state.knockout.predictionDocs[state.uid];
      const user = firebase.auth().currentUser;
      const myEmail = user?.email || '';
      const nameMismatch = myDoc && state.currentPlayer && myDoc.displayName !== state.currentPlayer;
      const emailMissing = myDoc && myEmail && !myDoc.email;
      if (nameMismatch || emailMissing) {
        const patch = {};
        if (nameMismatch) patch.displayName = state.currentPlayer;
        if (emailMissing) patch.email = myEmail;
        knockoutPredictionsCol(leagueId).doc(state.uid).set(patch, { merge: true });
      }

      scheduleRenderAll();
    },
    err => showToast(t('toast.predLoadFail', { msg: err.message }))
  );
}

function subscribeToKnockoutResults() {
  unsubKnockoutResults = knockoutResultsRef().onSnapshot(
    doc => {
      state.knockout.results = doc.exists ? (doc.data().results || {}) : {};
      state.knockout.resultsVersion = (state.knockout.resultsVersion || 0) + 1;
      scheduleRenderAll();
    },
    err => showToast(t('toast.resultsLoadFail', { msg: err.message }))
  );
}

function unsubscribeKnockout() {
  if (unsubKnockoutPredictions) { unsubKnockoutPredictions(); unsubKnockoutPredictions = null; }
  if (unsubKnockoutResults)     { unsubKnockoutResults();     unsubKnockoutResults = null; }
}

let knockoutAutosaveTimer = null;
let knockoutAutosaveRetries = 0;
const KNOCKOUT_AUTOSAVE_MAX_RETRIES = 10;

function scheduleKnockoutAutosave() {
  if (knockoutAutosaveTimer) clearTimeout(knockoutAutosaveTimer);
  setAutosaveStatus('editing');
  knockoutAutosaveTimer = setTimeout(runKnockoutAutosave, 600);
}

async function runKnockoutAutosave() {
  if (!state.uid || !state.leagueId || isSaving) return;
  if (!state.currentLeague) {
    if (knockoutAutosaveRetries++ < KNOCKOUT_AUTOSAVE_MAX_RETRIES) {
      knockoutAutosaveTimer = setTimeout(runKnockoutAutosave, 500);
      return;
    }
    knockoutAutosaveRetries = 0;
    setAutosaveStatus('error', t('predictions.saveLeagueMissing'));
    return;
  }
  knockoutAutosaveRetries = 0;
  if (arePredictionsLocked()) {
    setAutosaveStatus('error', t('predictions.saveLocked'));
    return;
  }

  const preds = {};
  document.querySelectorAll('#view-knockout .knockout-score-input').forEach(input => {
    const { match, side } = input.dataset;
    if (!preds[match]) preds[match] = {};
    if (input.value !== '') {
      const val = parseInt(input.value, 10);
      if (!isNaN(val) && val >= 0) preds[match][side] = val;
    }
  });
  // Layer in winner picks (only meaningful when the predicted score is a tie).
  document.querySelectorAll('#view-knockout .bracket-match').forEach(card => {
    const matchId = card.dataset.matchId;
    if (!matchId) return;
    const pick = card.querySelector('.penalty-pick-btn.is-selected')?.dataset.side;
    if (pick && preds[matchId]) preds[matchId].winnerPick = pick;
  });

  // Drop any predictions for rounds whose lock time has passed, and preserve
  // the saved version for those matches so we never overwrite a locked pick.
  const matchById = new Map((state.knockout?.matches || []).map(m => [m.id, m]));
  const existing = state.knockout.predictionDocs?.[state.uid]?.predictions || {};
  for (const matchId of Object.keys(preds)) {
    const m = matchById.get(matchId);
    if (m && isKnockoutRoundLocked(m.stage)) {
      if (existing[matchId]) preds[matchId] = existing[matchId];
      else delete preds[matchId];
    }
  }

  const cleaned = Object.fromEntries(
    Object.entries(preds).filter(([, p]) => p.home !== undefined && p.away !== undefined)
  );

  const matches = state.knockout?.matches || [];
  const expectedInputs = matches.length * 2;
  const actualInputs = document.querySelectorAll('#view-knockout .knockout-score-input').length;
  if (expectedInputs > 0 && actualInputs < expectedInputs) {
    console.warn('[knockout-autosave] DOM not fully rendered, skipping');
    return;
  }

  isSaving = true;
  setAutosaveStatus('saving');
  try {
    const user = firebase.auth().currentUser;
    await knockoutPredictionsCol(state.leagueId).doc(state.uid).set({
      displayName: state.currentPlayer || user?.displayName || user?.email || '',
      email: user?.email || '',
      predictions: cleaned,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    setAutosaveStatus('saved');
  } catch (err) {
    console.error('[knockout-autosave] failed', err);
    setAutosaveStatus('error', err.message);
  } finally {
    isSaving = false;
  }
}

function knockoutTeamFlag(name) {
  if (!name || name === 'TBD') return '<span class="team-flag team-flag-empty"></span>';
  const crest = state.crests[name] || state.knockout?.crests?.[name];
  return crest
    ? `<img class="team-flag" src="${crest}" alt="" loading="lazy" decoding="async">`
    : '<span class="team-flag team-flag-empty"></span>';
}

function knockoutTeamLabel(name, alias) {
  if (!name || name === 'TBD') {
    const label = alias || t('knockout.tbd');
    return `<span class="bracket-team-name bracket-team-tbd">${escapeHtml(label)}</span>`;
  }
  return `<span class="bracket-team-name">${escapeHtml(tCountry(name))}</span>`;
}

const KNOCKOUT_ROUND_LOCK_LEAD_MS = 60 * 60 * 1000; // 1 hour before first kickoff in a round

function knockoutRoundLockTime(stage) {
  const matches = (state.knockout?.matches || []).filter(m => m.stage === stage);
  let earliest = Infinity;
  for (const m of matches) {
    const t = m.utcDate ? new Date(m.utcDate).getTime() : NaN;
    if (Number.isFinite(t) && t < earliest) earliest = t;
  }
  if (!Number.isFinite(earliest)) return null;
  return earliest - KNOCKOUT_ROUND_LOCK_LEAD_MS;
}

function isKnockoutRoundLocked(stage) {
  const lockMs = knockoutRoundLockTime(stage);
  if (lockMs === null) return false;
  return Date.now() >= lockMs;
}

function formatKnockoutLockCountdown(ms) {
  const diff = ms - Date.now();
  if (diff <= 0) return null;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return t('knockout.locksInMin', { n: Math.max(1, mins) });
  const hours = Math.floor(mins / 60);
  if (hours < 48) return t('knockout.locksInHour', { n: hours });
  const days = Math.floor(hours / 24);
  return t('knockout.locksInDay', { n: days });
}

function renderKnockoutMatch(match, myPred) {
  const result = getKnockoutResults()[match.id] || null;
  const matches = state.knockout.matches || [];
  const locked = arePredictionsLocked() || isKnockoutRoundLocked(match.stage);

  const homeVal  = myPred && myPred.home != null ? myPred.home : '';
  const awayVal  = myPred && myPred.away != null ? myPred.away : '';
  const winnerPick = myPred?.winnerPick || '';
  const hasBoth = homeVal !== '' && awayVal !== '';
  const numHome = hasBoth ? parseInt(homeVal, 10) : null;
  const numAway = hasBoth ? parseInt(awayVal, 10) : null;
  const isTie   = hasBoth && numHome === numAway;
  const isTbd   = match.home === 'TBD' || match.away === 'TBD';

  let winnerBadge = '';
  if (!hasBoth) {
    winnerBadge = `<div class="winner-badge winner-badge-hint">${t('knockout.predictHint')}</div>`;
  } else if (!isTie) {
    const winnerName = numHome > numAway ? match.home : match.away;
    winnerBadge = `<div class="winner-badge winner-badge-auto">
      ${knockoutTeamFlag(winnerName)}
      <span class="winner-badge-text">${escapeHtml(tCountry(winnerName))} ${t('knockout.advances')}</span>
    </div>`;
  } else {
    const homeSelected = winnerPick === 'home' ? ' is-selected' : '';
    const awaySelected = winnerPick === 'away' ? ' is-selected' : '';
    winnerBadge = `<div class="winner-badge winner-badge-pk">
      <span class="winner-badge-label">${t('knockout.penaltyWinner')}</span>
      <div class="penalty-pick">
        <button type="button" class="penalty-pick-btn${homeSelected}" data-side="home" ${locked || isTbd ? 'disabled' : ''}>
          ${knockoutTeamFlag(match.home)}
          <span>${escapeHtml(match.home === 'TBD' ? (match.homeAlias || t('knockout.tbd')) : tCountry(match.home))}</span>
        </button>
        <button type="button" class="penalty-pick-btn${awaySelected}" data-side="away" ${locked || isTbd ? 'disabled' : ''}>
          ${knockoutTeamFlag(match.away)}
          <span>${escapeHtml(match.away === 'TBD' ? (match.awayAlias || t('knockout.tbd')) : tCountry(match.away))}</span>
        </button>
      </div>
    </div>`;
  }

  let resultStrip = '';
  if (result) {
    const pts = myPred ? calcKnockoutPoints(myPred, result) : null;
    const ptsBadge = pts !== null
      ? `<span class="everyone-pts-badge pts-badge-${pts}">${pts > 0 ? '+' : ''}${pts}</span>`
      : '';
    resultStrip = `<div class="bracket-result">
      <span class="bracket-result-label">${t('match.ft')}</span>
      <span class="bracket-result-score">${result.home}<span class="ft-dash">−</span>${result.away}</span>
      ${ptsBadge}
    </div>`;
  }

  const { day, time } = formatMatchDateParts(match.utcDate);

  let othersBtn = '';
  if (!isTbd) {
    const docs = state.knockout?.predictionDocs || {};
    let pickCount = 0;
    for (const uid of Object.keys(docs)) {
      const p = docs[uid]?.predictions?.[match.id];
      if (p && p.home != null && p.away != null) pickCount++;
    }
    if (pickCount > 0) {
      othersBtn = `<button type="button" class="bracket-match-others" data-match-id="${match.id}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
        <span>${pickCount} ${t('knockout.picks')}</span>
      </button>`;
    }
  }

  return `
    <article class="bracket-match" data-match-id="${match.id}" data-slot="${match.slot}" data-tie="${isTie}" data-stage="${match.stage}">
      <div class="bracket-match-meta">
        <span class="bracket-slot">#${match.slot}</span>
        <span class="bracket-meta-day">${day}</span>
        <span class="bracket-meta-sep">·</span>
        <span class="bracket-meta-time">${time}</span>
        ${othersBtn}
      </div>
      <div class="bracket-team-row" data-team="${escapeHtml(match.home || '')}">
        <span class="bracket-team-side">
          ${knockoutTeamFlag(match.home)}
          ${knockoutTeamLabel(match.home, match.homeAlias)}
        </span>
        <input class="knockout-score-input" type="number" min="0" max="30" inputmode="numeric"
               data-match="${match.id}" data-side="home"
               value="${homeVal}" ${locked || isTbd ? 'disabled' : ''}>
      </div>
      <div class="bracket-team-row" data-team="${escapeHtml(match.away || '')}">
        <span class="bracket-team-side">
          ${knockoutTeamFlag(match.away)}
          ${knockoutTeamLabel(match.away, match.awayAlias)}
        </span>
        <input class="knockout-score-input" type="number" min="0" max="30" inputmode="numeric"
               data-match="${match.id}" data-side="away"
               value="${awayVal}" ${locked || isTbd ? 'disabled' : ''}>
      </div>
      ${winnerBadge}
      ${resultStrip}
    </article>`;
}

function renderKnockoutBracket() {
  const container = document.getElementById('bracket-container');
  if (!container) return;
  if (!isViewActive('view-knockout')) return;

  const matches = state.knockout?.matches || [];
  if (matches.length === 0) {
    container.innerHTML = `<div class="empty-state">${t('knockout.loading')}</div>`;
    return;
  }

  const myDoc = state.knockout.predictionDocs?.[state.uid] || {};
  const myPreds = myDoc.predictions || {};

  // Capture focus + caret so re-renders triggered by snapshot don't kick the
  // user out of the input they're typing in.
  const focused = document.activeElement;
  const focusInfo = (focused && focused.classList.contains('knockout-score-input'))
    ? { match: focused.dataset.match, side: focused.dataset.side, start: focused.selectionStart, end: focused.selectionEnd }
    : null;

  // Capture unsaved DOM input values so partial entries survive re-renders.
  const domValues = {};
  container.querySelectorAll('.knockout-score-input').forEach(input => {
    const { match, side } = input.dataset;
    if (input.value !== '') {
      if (!domValues[match]) domValues[match] = {};
      domValues[match][side] = parseInt(input.value, 10);
    }
  });
  // Merge: saved predictions take priority, but unsaved DOM values fill gaps.
  const mergedPreds = {};
  for (const m of matches) {
    const saved = myPreds[m.id];
    const dom = domValues[m.id];
    if (saved || dom) {
      mergedPreds[m.id] = { ...dom, ...saved };
    }
  }

  const byStage = {};
  for (const m of matches) {
    (byStage[m.stage] ||= []).push(m);
  }
  for (const stage of Object.keys(byStage)) {
    byStage[stage].sort((a, b) => a.slot - b.slot);
  }

  container.innerHTML = `
    <div class="bracket">
      ${KNOCKOUT_ROUND_ORDER.filter(stage => (byStage[stage] || []).length > 0).map(stage => {
        const lockMs = knockoutRoundLockTime(stage);
        const isLocked = lockMs !== null && Date.now() >= lockMs;
        let lockBadge = '';
        if (isLocked) {
          lockBadge = `<span class="bracket-round-lock is-locked" title="${escapeHtml(t('knockout.lockedRound'))}">🔒 ${t('knockout.lockedRound')}</span>`;
        } else if (lockMs !== null) {
          const cd = formatKnockoutLockCountdown(lockMs);
          if (cd) lockBadge = `<span class="bracket-round-lock">${escapeHtml(cd)}</span>`;
        }
        return `
        <section class="bracket-round${isLocked ? ' round-locked' : ''}" data-round="${stage}">
          <header class="bracket-round-header">
            <h3 class="bracket-round-title">${knockoutRoundLabel(stage)}</h3>
            <div class="bracket-round-meta">
              ${lockBadge}
              <span class="bracket-round-count">${byStage[stage].length}</span>
            </div>
          </header>
          <div class="bracket-round-matches">
            ${byStage[stage].map(m => renderKnockoutMatch(m, mergedPreds[m.id])).join('')}
          </div>
        </section>
        `;
      }).join('')}
    </div>
  `;

  if (focusInfo) {
    const sel = `.knockout-score-input[data-match="${focusInfo.match}"][data-side="${focusInfo.side}"]`;
    const el = container.querySelector(sel);
    if (el) {
      el.focus({ preventScroll: true });
      try { el.setSelectionRange(focusInfo.start, focusInfo.end); } catch (e) {}
    }
  }

  renderBracketConnectors();
  updateBracketFloatingScrollbar();
}

const BRACKET_CONNECTOR_MIN_WIDTH = 1100;

const KNOCKOUT_TEMPLATE_BY_SLOT = (() => {
  const m = new Map();
  for (const stage of KNOCKOUT_STAGES) {
    for (const info of KNOCKOUT_TEMPLATE[stage]) m.set(info.slot, info);
  }
  return m;
})();

function _knockoutWinnerSide(res) {
  if (!res) return null;
  if (res.home > res.away) return 'home';
  if (res.away > res.home) return 'away';
  return res.winnerPick || null;
}

// Walk backward from the Final to find each edge on the eventual champion's
// route through the bracket. Returns a Set of "childSlot->parentSlot" keys.
function computeChampionEdges(results, slotToMatch, slotToId) {
  const out = new Set();
  const finalMatch = slotToMatch.get(32);
  const finalResult = results[slotToId.get(32)];
  if (!finalMatch || !finalResult) return out;
  const wSide = _knockoutWinnerSide(finalResult);
  if (!wSide) return out;
  const champ = finalMatch[wSide];
  if (!champ || champ === 'TBD') return out;

  let parentSlot = 32;
  while (true) {
    const info = KNOCKOUT_TEMPLATE_BY_SLOT.get(parentSlot);
    if (!info || !info.fromSlots) break;
    let found = null;
    for (const cs of info.fromSlots) {
      const cm = slotToMatch.get(cs);
      const cr = results[slotToId.get(cs)];
      if (!cm || !cr) continue;
      const cws = _knockoutWinnerSide(cr);
      if (cws && cm[cws] === champ) { found = cs; break; }
    }
    if (found == null) break;
    out.add(`${found}->${parentSlot}`);
    parentSlot = found;
  }
  return out;
}

// Walk forward from a starting slot, collecting every edge a team won.
function computeTeamForwardEdges(teamName, startSlot, results, slotToMatch, slotToId) {
  const out = new Set();
  if (!teamName || teamName === 'TBD') return out;
  let slot = startSlot;
  while (true) {
    const info = KNOCKOUT_TEMPLATE_BY_SLOT.get(slot);
    if (!info || info.feedsIntoSlot == null) break;
    const match = slotToMatch.get(slot);
    const result = results[slotToId.get(slot)];
    if (!match || !result) break;
    const wSide = _knockoutWinnerSide(result);
    if (!wSide || match[wSide] !== teamName) break;
    out.add(`${slot}->${info.feedsIntoSlot}`);
    slot = info.feedsIntoSlot;
  }
  return out;
}

function renderBracketConnectors() {
  const bracket = document.querySelector('#view-knockout .bracket');
  if (!bracket) return;
  const existing = bracket.querySelector('.bracket-connectors');
  if (existing) existing.remove();
  if (window.innerWidth < BRACKET_CONNECTOR_MIN_WIDTH) return;

  const bracketRect = bracket.getBoundingClientRect();
  const cardData = {};
  bracket.querySelectorAll('.bracket-match').forEach(card => {
    const slot = parseInt(card.dataset.slot, 10);
    if (Number.isNaN(slot)) return;
    const r = card.getBoundingClientRect();
    const rows = card.querySelectorAll('.bracket-team-row');
    const rowY = el => {
      if (!el) return null;
      const rr = el.getBoundingClientRect();
      return (rr.top + rr.bottom) / 2 - bracketRect.top;
    };
    cardData[slot] = {
      left:    r.left - bracketRect.left,
      right:   r.right - bracketRect.left,
      vCenter: (r.top + r.bottom) / 2 - bracketRect.top,
      homeY:   rowY(rows[0]),
      awayY:   rowY(rows[1]),
    };
  });

  const slotToId = new Map((state.knockout?.matches || []).map(m => [m.slot, m.id]));
  const slotToMatch = new Map((state.knockout?.matches || []).map(m => [m.slot, m]));
  const results = getKnockoutResults();
  const championEdges = computeChampionEdges(results, slotToMatch, slotToId);

  // Build edges from each parent's fromSlots — index 0 feeds the parent's
  // home row, index 1 feeds the away row. Skip 3rd-place to avoid lines
  // crossing the Final column.
  const edges = [];
  for (const stage of KNOCKOUT_STAGES) {
    if (stage === 'THIRD_PLACE') continue;
    for (const info of KNOCKOUT_TEMPLATE[stage]) {
      if (!info.fromSlots || info.fromSlots.length !== 2) continue;
      edges.push({ childSlot: info.fromSlots[0], parentSlot: info.slot, parentSide: 'home' });
      edges.push({ childSlot: info.fromSlots[1], parentSlot: info.slot, parentSide: 'away' });
    }
  }

  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('class', 'bracket-connectors');
  svg.setAttribute('width', bracket.scrollWidth);
  svg.setAttribute('height', bracket.scrollHeight);

  for (const e of edges) {
    const child = cardData[e.childSlot];
    const parent = cardData[e.parentSlot];
    if (!child || !parent) continue;
    if (parent.left <= child.right) continue;

    const childResult = results[slotToId.get(e.childSlot)];
    const wSide = _knockoutWinnerSide(childResult);
    const startY = wSide === 'home' ? child.homeY
                 : wSide === 'away' ? child.awayY
                 : child.vCenter;
    const endY = e.parentSide === 'home' ? parent.homeY : parent.awayY;
    if (startY == null || endY == null) continue;

    const xMid = (child.right + parent.left) / 2;
    const path = document.createElementNS(svgNS, 'path');
    path.setAttribute(
      'd',
      `M ${child.right} ${startY} L ${xMid} ${startY} L ${xMid} ${endY} L ${parent.left} ${endY}`
    );
    path.setAttribute('data-child', String(e.childSlot));
    path.setAttribute('data-parent', String(e.parentSlot));
    if (childResult) path.classList.add('is-winner');
    if (championEdges.has(`${e.childSlot}->${e.parentSlot}`)) path.classList.add('is-champion');
    svg.appendChild(path);
  }

  bracket.appendChild(svg);
}

// Hover-trace: highlight a team's full forward path through the bracket.
function highlightTeamPath(teamName, startSlot) {
  const bracket = document.querySelector('#view-knockout .bracket');
  if (!bracket || !teamName || teamName === 'TBD') return;
  const slotToId = new Map((state.knockout?.matches || []).map(m => [m.slot, m.id]));
  const slotToMatch = new Map((state.knockout?.matches || []).map(m => [m.slot, m]));
  const results = getKnockoutResults();
  const edges = computeTeamForwardEdges(teamName, startSlot, results, slotToMatch, slotToId);

  bracket.classList.add('has-trace');
  bracket.querySelectorAll('.bracket-connectors path').forEach(p => {
    const key = `${p.getAttribute('data-child')}->${p.getAttribute('data-parent')}`;
    p.classList.toggle('is-team-traced', edges.has(key));
  });
  bracket.querySelectorAll('.bracket-team-row').forEach(row => {
    row.classList.toggle('is-team-traced', row.dataset.team === teamName);
  });
}

function clearTeamPathHighlight() {
  const bracket = document.querySelector('#view-knockout .bracket');
  if (!bracket) return;
  bracket.classList.remove('has-trace');
  bracket.querySelectorAll('.is-team-traced').forEach(el => el.classList.remove('is-team-traced'));
}

let _bracketResizeRaf = null;
function _scheduleBracketConnectorRecalc() {
  if (_bracketResizeRaf) return;
  _bracketResizeRaf = requestAnimationFrame(() => {
    _bracketResizeRaf = null;
    renderBracketConnectors();
    updateBracketFloatingScrollbar();
  });
}
if (typeof window !== 'undefined') {
  window.addEventListener('resize', _scheduleBracketConnectorRecalc);
}

// Custom floating scrollbar — a drag-able thumb over a thin track, no native
// scrollbar involved so appearance is identical across browsers/OS. Lives
// inside #view-knockout so display:none on that view kills it automatically.
let _floatScrollbar = null;
let _floatThumb = null;
let _floatTrack = null;
let _floatDragging = false;
let _floatDragStartX = 0;
let _floatDragStartScroll = 0;

function setupBracketFloatingScrollbar() {
  if (_floatScrollbar) return _floatScrollbar;
  const viewEl = document.getElementById('view-knockout');
  const realContainer = document.getElementById('bracket-container');
  if (!viewEl || !realContainer) return null;

  const wrap = document.createElement('div');
  wrap.className = 'bracket-float-scrollbar';
  const track = document.createElement('div');
  track.className = 'bracket-float-track';
  const thumb = document.createElement('div');
  thumb.className = 'bracket-float-thumb';
  track.appendChild(thumb);
  wrap.appendChild(track);
  viewEl.appendChild(wrap);

  _floatScrollbar = wrap;
  _floatTrack = track;
  _floatThumb = thumb;

  // Sync bracket scroll → thumb position
  realContainer.addEventListener('scroll', _updateFloatThumb);

  // Drag thumb → scroll bracket
  thumb.addEventListener('mousedown', e => {
    _floatDragging = true;
    _floatDragStartX = e.clientX;
    _floatDragStartScroll = realContainer.scrollLeft;
    thumb.classList.add('is-dragging');
    e.preventDefault();
  });
  document.addEventListener('mousemove', e => {
    if (!_floatDragging) return;
    const sw = realContainer.scrollWidth;
    const cw = realContainer.clientWidth;
    const tw = track.clientWidth;
    const thumbW = thumb.offsetWidth;
    const maxThumb = tw - thumbW;
    const maxScroll = sw - cw;
    const dx = e.clientX - _floatDragStartX;
    realContainer.scrollLeft = _floatDragStartScroll + dx * (maxScroll / (maxThumb || 1));
  });
  document.addEventListener('mouseup', () => {
    if (!_floatDragging) return;
    _floatDragging = false;
    thumb.classList.remove('is-dragging');
  });

  // Click on track (not thumb) → jump to position
  track.addEventListener('click', e => {
    if (e.target === thumb) return;
    const rect = track.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const sw = realContainer.scrollWidth;
    const cw = realContainer.clientWidth;
    realContainer.scrollLeft = (x / track.clientWidth) * (sw - cw);
  });

  // Touch drag support for mobile
  thumb.addEventListener('touchstart', e => {
    _floatDragging = true;
    _floatDragStartX = e.touches[0].clientX;
    _floatDragStartScroll = realContainer.scrollLeft;
    thumb.classList.add('is-dragging');
    e.preventDefault();
  }, { passive: false });
  document.addEventListener('touchmove', e => {
    if (!_floatDragging) return;
    const sw = realContainer.scrollWidth;
    const cw = realContainer.clientWidth;
    const tw = track.clientWidth;
    const thumbW = thumb.offsetWidth;
    const maxThumb = tw - thumbW;
    const maxScroll = sw - cw;
    const dx = e.touches[0].clientX - _floatDragStartX;
    realContainer.scrollLeft = _floatDragStartScroll + dx * (maxScroll / (maxThumb || 1));
  });
  document.addEventListener('touchend', () => {
    if (!_floatDragging) return;
    _floatDragging = false;
    thumb.classList.remove('is-dragging');
  });

  return wrap;
}

function _updateFloatThumb() {
  if (!_floatThumb || !_floatTrack) return;
  const realContainer = document.getElementById('bracket-container');
  if (!realContainer) return;
  const sw = realContainer.scrollWidth;
  const cw = realContainer.clientWidth;
  const tw = _floatTrack.clientWidth;
  const ratio = cw / sw;
  const thumbW = Math.max(40, Math.round(tw * ratio));
  const maxScroll = sw - cw;
  const scrollRatio = maxScroll > 0 ? realContainer.scrollLeft / maxScroll : 0;
  const maxLeft = tw - thumbW;
  _floatThumb.style.width = `${thumbW}px`;
  _floatThumb.style.transform = `translateX(${Math.round(maxLeft * scrollRatio)}px)`;
}

function updateBracketFloatingScrollbar() {
  const wrap = setupBracketFloatingScrollbar();
  if (!wrap) return;
  const realContainer = document.getElementById('bracket-container');
  if (!realContainer || !isViewActive('view-knockout')) {
    wrap.classList.remove('is-visible');
    return;
  }
  const scrollWidth = realContainer.scrollWidth;
  const clientWidth = realContainer.clientWidth;
  if (scrollWidth <= clientWidth + 2) {
    wrap.classList.remove('is-visible');
    return;
  }
  const rect = realContainer.getBoundingClientRect();
  wrap.style.left = `${rect.left}px`;
  wrap.style.width = `${rect.width}px`;
  wrap.classList.add('is-visible');
  _updateFloatThumb();
}

function isViewActive(viewId) {
  const el = document.getElementById(viewId);
  return !!el && !el.classList.contains('hidden');
}

function bindKnockoutEvents() {
  const container = document.getElementById('view-knockout');
  if (!container || container.dataset.bound === '1') return;
  container.dataset.bound = '1';

  container.addEventListener('input', e => {
    if (!e.target.classList.contains('knockout-score-input')) return;
    if (arePredictionsLocked()) return;
    const card = e.target.closest('.bracket-match');
    if (card && isKnockoutRoundLocked(card.dataset.stage)) return;
    if (card) updateBracketCardTieState(card);
    scheduleKnockoutAutosave();
  });

  container.addEventListener('click', e => {
    const btn = e.target.closest('.penalty-pick-btn');
    if (!btn) return;
    if (arePredictionsLocked()) return;
    const card = btn.closest('.bracket-match');
    if (!card) return;
    if (isKnockoutRoundLocked(card.dataset.stage)) return;
    card.querySelectorAll('.penalty-pick-btn').forEach(b => b.classList.remove('is-selected'));
    btn.classList.add('is-selected');
    scheduleKnockoutAutosave();
  });

  container.addEventListener('click', e => {
    const btn = e.target.closest('.bracket-match-others');
    if (!btn) return;
    const matchId = btn.dataset.matchId;
    const card = btn.closest('.bracket-match');
    if (!card) return;
    const existing = card.querySelector('.bracket-others-panel');
    if (existing) { existing.remove(); btn.classList.remove('is-open'); return; }
    btn.classList.add('is-open');
    const match = (state.knockout?.matches || []).find(m => m.id === matchId);
    const result = match ? (getKnockoutResults()[matchId] || null) : null;
    const docs = state.knockout?.predictionDocs || {};
    const rows = [];
    for (const [uid, doc] of Object.entries(docs)) {
      const pred = doc.predictions?.[matchId];
      if (!pred || pred.home == null || pred.away == null) continue;
      const name = doc.displayName || t('toast.unknown');
      const pts = result ? calcKnockoutPoints(pred, result) : null;
      const ptsBadge = pts !== null
        ? `<span class="everyone-pts-badge pts-badge-${pts}">${pts > 0 ? '+' : ''}${pts}</span>`
        : '';
      const isSelf = uid === state.uid;
      rows.push(`<div class="bracket-others-row${isSelf ? ' is-self' : ''}">
        <span class="bracket-others-name">${escapeHtml(name)}</span>
        <span class="bracket-others-score">${pred.home} - ${pred.away}</span>
        ${ptsBadge}
      </div>`);
    }
    const panel = document.createElement('div');
    panel.className = 'bracket-others-panel';
    panel.innerHTML = rows.length ? rows.join('') : `<div class="empty-state">${t('knockout.noPredictions')}</div>`;
    card.appendChild(panel);
  });

  // Hover-trace: highlight a team's full forward path through the bracket
  // when their row is hovered (desktop only — touch devices won't fire these).
  container.addEventListener('mouseover', e => {
    const row = e.target.closest('.bracket-team-row');
    if (!row) return;
    const team = row.dataset.team;
    const card = row.closest('.bracket-match');
    if (!team || !card) return;
    const slot = parseInt(card.dataset.slot, 10);
    if (Number.isNaN(slot)) return;
    highlightTeamPath(team, slot);
  });
  container.addEventListener('mouseout', e => {
    const row = e.target.closest('.bracket-team-row');
    if (!row) return;
    const goingTo = e.relatedTarget?.closest?.('.bracket-team-row');
    if (goingTo) return; // entering another row — let mouseover handle it
    clearTeamPathHighlight();
  });
}

function updateBracketCardTieState(card) {
  const home = card.querySelector('.knockout-score-input[data-side="home"]')?.value;
  const away = card.querySelector('.knockout-score-input[data-side="away"]')?.value;
  const hasBoth = home !== '' && away !== '';
  const isTie = hasBoth && parseInt(home, 10) === parseInt(away, 10);
  card.dataset.tie = isTie ? 'true' : 'false';

  const badge = card.querySelector('.winner-badge');
  if (!badge) return;
  const matchId = card.dataset.matchId;
  const match = (state.knockout?.matches || []).find(m => m.id === matchId);
  if (!match) return;

  if (!hasBoth) {
    badge.outerHTML = `<div class="winner-badge winner-badge-hint">${t('knockout.predictHint')}</div>`;
  } else if (!isTie) {
    const numHome = parseInt(home, 10);
    const numAway = parseInt(away, 10);
    const winnerName = numHome > numAway ? match.home : match.away;
    badge.outerHTML = `<div class="winner-badge winner-badge-auto">
      ${knockoutTeamFlag(winnerName)}
      <span class="winner-badge-text">${escapeHtml(tCountry(winnerName))} ${t('knockout.advances')}</span>
    </div>`;
  } else {
    // Preserve existing winnerPick if it was set
    const existing = card.querySelector('.penalty-pick-btn.is-selected')?.dataset.side || '';
    const homeSelected = existing === 'home' ? ' is-selected' : '';
    const awaySelected = existing === 'away' ? ' is-selected' : '';
    const isTbd = match.home === 'TBD' || match.away === 'TBD';
    badge.outerHTML = `<div class="winner-badge winner-badge-pk">
      <span class="winner-badge-label">${t('knockout.penaltyWinner')}</span>
      <div class="penalty-pick">
        <button type="button" class="penalty-pick-btn${homeSelected}" data-side="home" ${isTbd ? 'disabled' : ''}>
          ${knockoutTeamFlag(match.home)}
          <span>${escapeHtml(match.home === 'TBD' ? (match.homeAlias || t('knockout.tbd')) : tCountry(match.home))}</span>
        </button>
        <button type="button" class="penalty-pick-btn${awaySelected}" data-side="away" ${isTbd ? 'disabled' : ''}>
          ${knockoutTeamFlag(match.away)}
          <span>${escapeHtml(match.away === 'TBD' ? (match.awayAlias || t('knockout.tbd')) : tCountry(match.away))}</span>
        </button>
      </div>
    </div>`;
  }
}
