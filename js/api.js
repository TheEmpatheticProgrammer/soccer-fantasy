const COMPETITION = 'WC';
const getApiBase = () => window.LOCAL_CONFIG?.apiBaseUrl || 'https://api.football-data.org/v4';
const isUsingProxy = () => !!window.LOCAL_CONFIG?.apiBaseUrl;

const ApiCache = {
  key: 'wc2026_api_cache_v3',
  ttl: 5 * 60 * 1000, // 5 minutes (default; callers can pass a shorter maxAge for live windows)

  set(data) {
    localStorage.setItem(this.key, JSON.stringify({ ts: Date.now(), data }));
  },
  get(maxAgeMs) {
    try {
      const item = JSON.parse(localStorage.getItem(this.key));
      const limit = typeof maxAgeMs === 'number' ? maxAgeMs : this.ttl;
      if (!item || Date.now() - item.ts > limit) return null;
      return item.data;
    } catch { return null; }
  },
  timestamp() {
    try { return JSON.parse(localStorage.getItem(this.key))?.ts || null; } catch { return null; }
  },
  clear() { localStorage.removeItem(this.key); },
};

async function loadWorldCupData(apiKey, force = false, maxAgeMs) {
  if (!force) {
    const cached = ApiCache.get(maxAgeMs);
    if (cached) return cached;
  }

  const headers = isUsingProxy() ? {} : { 'X-Auth-Token': apiKey };
  const res = await fetch(
    `${getApiBase()}/competitions/${COMPETITION}/matches?stage=GROUP_STAGE`,
    { headers }
  );

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `HTTP ${res.status}`);
  }

  const json = await res.json();
  const parsed = parseWorldCupResponse(json);
  ApiCache.set(parsed);
  return parsed;
}

function parseWorldCupResponse(json) {
  const groups = {};
  const matches = [];
  const crests = {};

  for (const m of json.matches) {
    if (!m.group) continue;

    const group = m.group.replace('GROUP_', '');
    const homeTeam = m.homeTeam || {};
    const awayTeam = m.awayTeam || {};
    const home = homeTeam.name || 'TBD';
    const away = awayTeam.name || 'TBD';

    if (homeTeam.crest) crests[home] = homeTeam.crest;
    if (awayTeam.crest) crests[away] = awayTeam.crest;

    if (!groups[group]) groups[group] = [];
    if (home !== 'TBD' && !groups[group].includes(home)) groups[group].push(home);
    if (away !== 'TBD' && !groups[group].includes(away)) groups[group].push(away);

    matches.push({
      id: String(m.id),
      group,
      home,
      away,
      utcDate: m.utcDate,
      matchday: m.matchday,
      status: m.status,
      venue: m.venue || null,
      // Capture scores any time football-data reports them, including
      // IN_PLAY and PAUSED (half-time) — UI uses `status` to badge LIVE/HT/FT.
      result: m.score?.fullTime?.home != null
        ? { home: m.score.fullTime.home, away: m.score.fullTime.away }
        : null,
    });
  }

  return {
    groups: Object.fromEntries(Object.entries(groups).sort()),
    matches,
    crests,
  };
}

const KnockoutApiCache = {
  key: 'wc2026_knockout_cache_v5',
  ttl: 5 * 60 * 1000,
  set(data) { localStorage.setItem(this.key, JSON.stringify({ ts: Date.now(), data })); },
  get(maxAgeMs) {
    try {
      const item = JSON.parse(localStorage.getItem(this.key));
      const limit = typeof maxAgeMs === 'number' ? maxAgeMs : this.ttl;
      if (!item || Date.now() - item.ts > limit) return null;
      return item.data;
    } catch { return null; }
  },
  clear() { localStorage.removeItem(this.key); },
};

const KNOCKOUT_API_STAGES = ['LAST_32', 'LAST_16', 'QUARTER_FINALS', 'SEMI_FINALS', 'THIRD_PLACE', 'FINAL'];

async function loadKnockoutData(apiKey, force = false, maxAgeMs) {
  if (typeof Storage !== 'undefined' && Storage.getKnockoutDemo && Storage.getKnockoutDemo()) {
    const matches = buildKnockoutDemoMatches();
    return { matches, crests: {} };
  }

  if (!force) {
    const cached = KnockoutApiCache.get(maxAgeMs);
    if (cached) return cached;
  }

  const headers = isUsingProxy() ? {} : { 'X-Auth-Token': apiKey };
  // Single request for all matches; filter to knockout stages client-side.
  // This avoids 6 parallel requests that trigger rate limits.
  const res = await fetch(
    `${getApiBase()}/competitions/${COMPETITION}/matches`,
    { headers }
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `HTTP ${res.status}`);
  }
  const json = await res.json();
  const allMatches = json.matches || [];
  const knockoutStageSet = new Set(KNOCKOUT_API_STAGES);
  const stageResults = KNOCKOUT_API_STAGES.map(stage => ({
    stage,
    matches: allMatches.filter(m => m.stage === stage),
  }));

  const out = parseKnockoutResponse(stageResults);
  const prev = KnockoutApiCache.get(Infinity);
  if (prev && out.matches.length < prev.matches.length) {
    return prev;
  }
  KnockoutApiCache.set(out);
  return out;
}

function parseKnockoutResponse(stageResults) {
  const matches = [];
  const crests = {};

  for (const { stage, matches: raw } of stageResults) {
    // Sort by utcDate; use match id as tiebreaker so ordering within a day is
    // stable and matches the official fixture numbering (lower id = earlier).
    const sorted = [...raw].sort((a, b) => {
      const at = a.utcDate ? new Date(a.utcDate).getTime() : Infinity;
      const bt = b.utcDate ? new Date(b.utcDate).getTime() : Infinity;
      return at - bt || (a.id || 0) - (b.id || 0);
    });

    const template = (typeof KNOCKOUT_TEMPLATE !== 'undefined' && KNOCKOUT_TEMPLATE[stage]) || [];

    sorted.forEach((m, idx) => {
      const homeTeam = m.homeTeam || {};
      const awayTeam = m.awayTeam || {};
      const home = homeTeam.name || 'TBD';
      const away = awayTeam.name || 'TBD';
      if (homeTeam.crest && home !== 'TBD') crests[home] = homeTeam.crest;
      if (awayTeam.crest && away !== 'TBD') crests[away] = awayTeam.crest;

      const slotInfo = template[idx] || {};
      const fromSlots = slotInfo.fromSlots || [];
      const isLoser = slotInfo.sourceType === 'loser';
      const prefix = isLoser ? 'Loser' : 'Winner';

      // Template aliases take precedence (real bracket seedings for R32).
      // For later rounds fall back to "Winner Slot X" derived from fromSlots.
      const homeAlias = slotInfo.homeAlias ||
        (fromSlots[0] != null ? `${prefix} Slot ${fromSlots[0]}` : null);
      const awayAlias = slotInfo.awayAlias ||
        (fromSlots[1] != null ? `${prefix} Slot ${fromSlots[1]}` : null);

      matches.push({
        id: String(m.id),
        stage,
        slot: slotInfo.slot || (idx + 1),
        home,
        away,
        homeAlias,
        awayAlias,
        utcDate: m.utcDate,
        status: m.status,
        venue: m.venue || null,
        result: m.score?.fullTime?.home != null
          ? (() => {
              const pen = m.score?.penalties;
              const reg = m.score?.regularTime;
              // When penalties exist, show regulation-time score (90 min) rather
              // than fullTime which includes extra-time goals in football-data API.
              const useReg = pen && pen.home != null && reg && reg.home != null;
              const r = {
                home: useReg ? reg.home : m.score.fullTime.home,
                away: useReg ? reg.away : m.score.fullTime.away,
              };
              if (pen && pen.home != null && pen.away != null) {
                r.penHome = pen.home;
                r.penAway = pen.away;
                r.winnerPick = pen.home > pen.away ? 'home' : 'away';
              } else if (r.home === r.away && reg) {
                const winner = reg.home > reg.away ? 'away'
                  : reg.away > reg.home ? 'home' : null;
                if (winner) r.winnerPick = winner === 'home' ? 'home' : 'away';
              }
              return r;
            })()
          : null,
      });
    });
  }

  return { matches, crests };
}

// Fetch group standings and build a map: alias → team name.
// Only resolves Winners and Runners-up (positions 1 & 2 per group).
// Best 3rd teams come directly from the API match data — no solver needed.
async function loadGroupStandings(apiKey) {
  const headers = isUsingProxy() ? {} : { 'X-Auth-Token': apiKey };
  const res = await fetch(
    `${getApiBase()}/competitions/${COMPETITION}/standings`,
    { headers }
  );
  if (!res.ok) return {};
  const json = await res.json();
  const standings = json.standings || [];
  const aliasMap = {};

  for (const group of standings) {
    if (group.type !== 'TOTAL') continue;
    const groupLetter = (group.group || '').replace(/^(?:GROUP_|Group\s*)/i, '');
    if (!groupLetter) continue;
    const table = group.table || [];
    for (const entry of table) {
      const pos = entry.position;
      const name = entry.team?.name;
      if (!name) continue;
      if (pos === 1) aliasMap[`Winner ${groupLetter}`] = name;
      if (pos === 2) aliasMap[`Runner-up ${groupLetter}`] = name;
    }
  }

  return aliasMap;
}

// ESPN's public scoreboard for the FIFA World Cup — undocumented but free,
// no auth, no rate limit, updates in near real time. Returns today's events
// by default; `events[].competitions[].competitors` carries the live score
// and `status.type.state` ('pre' | 'in' | 'post') tells us if it's live.
async function loadLiveScores() {
  const res = await fetch(
    'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard',
    { cache: 'no-store' }
  );
  if (!res.ok) throw new Error(`ESPN HTTP ${res.status}`);
  const json = await res.json();
  const events = json?.events || [];
  const out = [];
  for (const ev of events) {
    const comp = ev.competitions?.[0];
    if (!comp) continue;
    // Skip pre-match fixtures (score is '0' before kickoff). Accept both
    // 'in' (live) and 'post' (full time) so the final score also propagates
    // when a match wraps up.
    const state = comp.status?.type?.state;
    if (state !== 'in' && state !== 'post') continue;
    const home = comp.competitors?.find(c => c.homeAway === 'home');
    const away = comp.competitors?.find(c => c.homeAway === 'away');
    if (!home || !away) continue;
    const hs = parseInt(home.score, 10);
    const as = parseInt(away.score, 10);
    if (!Number.isInteger(hs) || !Number.isInteger(as)) continue;
    out.push({
      home: home.team?.displayName || home.team?.name || '',
      away: away.team?.displayName || away.team?.name || '',
      homeScore: hs,
      awayScore: as,
      state, // 'in' | 'post'
      status: comp.status?.type?.description || state,
    });
  }
  return out;
}
