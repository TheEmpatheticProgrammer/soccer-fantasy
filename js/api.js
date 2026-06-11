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
