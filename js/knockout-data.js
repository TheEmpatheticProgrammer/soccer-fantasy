// WC 2026 knockout bracket template.
//
// Slot numbering (fixed):
//   1..16  → Round of 32 matches
//   17..24 → Round of 16 (slot 17 = R32 #1 winner vs R32 #2 winner, etc.)
//   25..28 → Quarter-finals
//   29..30 → Semi-finals
//   31     → Third-place playoff (semi losers)
//   32     → Final (semi winners)

const KNOCKOUT_STAGES = ['LAST_32', 'LAST_16', 'QUARTER_FINALS', 'SEMI_FINALS', 'THIRD_PLACE', 'FINAL'];

const KNOCKOUT_TEMPLATE = (() => {
  // R32 seedings reflect the official WC 2026 bracket (fixtures sorted by date,
  // matching the order the football-data API returns them within this stage).
  const last32 = [
    { slot:  1, stage: 'LAST_32', homeAlias: 'Runner-up A',     awayAlias: 'Runner-up B',           feedsIntoSlot: 17 },
    { slot:  2, stage: 'LAST_32', homeAlias: 'Winner E',         awayAlias: 'Best 3rd A/B/C/D/F',    feedsIntoSlot: 17 },
    { slot:  3, stage: 'LAST_32', homeAlias: 'Winner F',         awayAlias: 'Runner-up C',           feedsIntoSlot: 18 },
    { slot:  4, stage: 'LAST_32', homeAlias: 'Winner C',         awayAlias: 'Runner-up F',           feedsIntoSlot: 18 },
    { slot:  5, stage: 'LAST_32', homeAlias: 'Winner I',         awayAlias: 'Best 3rd C/D/F/G/H',    feedsIntoSlot: 19 },
    { slot:  6, stage: 'LAST_32', homeAlias: 'Runner-up E',      awayAlias: 'Runner-up I',           feedsIntoSlot: 19 },
    { slot:  7, stage: 'LAST_32', homeAlias: 'Winner A',         awayAlias: 'Best 3rd C/E/F/H/I',    feedsIntoSlot: 20 },
    { slot:  8, stage: 'LAST_32', homeAlias: 'Winner L',         awayAlias: 'Best 3rd E/H/I/J/K',    feedsIntoSlot: 20 },
    { slot:  9, stage: 'LAST_32', homeAlias: 'Winner D',         awayAlias: 'Best 3rd B/E/F/I/J',    feedsIntoSlot: 21 },
    { slot: 10, stage: 'LAST_32', homeAlias: 'Winner G',         awayAlias: 'Best 3rd A/E/H/I/J',    feedsIntoSlot: 21 },
    { slot: 11, stage: 'LAST_32', homeAlias: 'Runner-up K',      awayAlias: 'Runner-up L',           feedsIntoSlot: 22 },
    { slot: 12, stage: 'LAST_32', homeAlias: 'Winner H',         awayAlias: 'Runner-up J',           feedsIntoSlot: 22 },
    { slot: 13, stage: 'LAST_32', homeAlias: 'Winner B',         awayAlias: 'Best 3rd E/F/G/I/J',    feedsIntoSlot: 23 },
    { slot: 14, stage: 'LAST_32', homeAlias: 'Winner J',         awayAlias: 'Runner-up H',           feedsIntoSlot: 23 },
    { slot: 15, stage: 'LAST_32', homeAlias: 'Winner K',         awayAlias: 'Best 3rd D/E/I/J/L',    feedsIntoSlot: 24 },
    { slot: 16, stage: 'LAST_32', homeAlias: 'Runner-up D',      awayAlias: 'Runner-up G',           feedsIntoSlot: 24 },
  ];
  const last16 = Array.from({ length: 8 }, (_, i) => ({
    slot: 17 + i,
    stage: 'LAST_16',
    fromSlots: [1 + i * 2, 2 + i * 2],
    sourceType: 'winner',
    feedsIntoSlot: 25 + Math.floor(i / 2),
  }));
  const qf = Array.from({ length: 4 }, (_, i) => ({
    slot: 25 + i,
    stage: 'QUARTER_FINALS',
    fromSlots: [17 + i * 2, 18 + i * 2],
    sourceType: 'winner',
    feedsIntoSlot: 29 + Math.floor(i / 2),
  }));
  const sf = Array.from({ length: 2 }, (_, i) => ({
    slot: 29 + i,
    stage: 'SEMI_FINALS',
    fromSlots: [25 + i * 2, 26 + i * 2],
    sourceType: 'winner',
    feedsIntoSlot: 32,
    loserFeedsIntoSlot: 31,
  }));
  const third = [{
    slot: 31,
    stage: 'THIRD_PLACE',
    fromSlots: [29, 30],
    sourceType: 'loser',
    feedsIntoSlot: null,
  }];
  const final = [{
    slot: 32,
    stage: 'FINAL',
    fromSlots: [29, 30],
    sourceType: 'winner',
    feedsIntoSlot: null,
  }];
  return { LAST_32: last32, LAST_16: last16, QUARTER_FINALS: qf, SEMI_FINALS: sf, THIRD_PLACE: third, FINAL: final };
})();

// Demo team names for local testing while the API doesn't yet return real
// knockout fixtures. Slots 1-16 (R32) get real-ish nation pairings; later
// rounds also get teams so the user can test the prediction inputs on every
// round, even before group stage finishes.
const KNOCKOUT_DEMO_FIXTURES = {
  1:  { home: 'Mexico',        away: 'Norway' },
  2:  { home: 'Brazil',         away: 'Iran' },
  3:  { home: 'Spain',          away: 'Saudi Arabia' },
  4:  { home: 'France',         away: 'Ghana' },
  5:  { home: 'Argentina',      away: 'Canada' },
  6:  { home: 'Germany',        away: 'Egypt' },
  7:  { home: 'Portugal',       away: 'Australia' },
  8:  { home: 'England',        away: 'Senegal' },
  9:  { home: 'Netherlands',    away: 'United States' },
  10: { home: 'Croatia',        away: 'Japan' },
  11: { home: 'Belgium',        away: 'Morocco' },
  12: { home: 'Uruguay',        away: 'South Korea' },
  13: { home: 'Colombia',       away: 'Switzerland' },
  14: { home: 'Italy',          away: 'Ecuador' },
  15: { home: 'Denmark',        away: 'Cape Verde' },
  16: { home: 'Poland',         away: 'Tunisia' },
  // Later rounds — placeholder pairings used only for demo
  17: { home: 'Mexico',        away: 'Brazil' },
  18: { home: 'Spain',          away: 'France' },
  19: { home: 'Argentina',      away: 'Germany' },
  20: { home: 'Portugal',       away: 'England' },
  21: { home: 'Netherlands',    away: 'Croatia' },
  22: { home: 'Belgium',        away: 'Uruguay' },
  23: { home: 'Colombia',       away: 'Italy' },
  24: { home: 'Denmark',        away: 'Poland' },
  25: { home: 'Mexico',        away: 'Spain' },
  26: { home: 'Argentina',      away: 'Portugal' },
  27: { home: 'Netherlands',    away: 'Belgium' },
  28: { home: 'Colombia',       away: 'Denmark' },
  29: { home: 'Mexico',        away: 'Argentina' },
  30: { home: 'Netherlands',    away: 'Colombia' },
  31: { home: 'Argentina',      away: 'Netherlands' }, // loser SF1 vs loser SF2
  32: { home: 'Mexico',        away: 'Colombia' },     // winner SF1 vs winner SF2
};

// Synthetic kickoffs for the demo bracket — staggered roughly one match per
// day starting "today + 30 days" so the schedule looks plausible.
function knockoutDemoKickoff(slot) {
  const base = Date.now() + 30 * 24 * 60 * 60 * 1000;
  return new Date(base + (slot - 1) * 24 * 60 * 60 * 1000).toISOString();
}

function buildKnockoutDemoMatches() {
  const out = [];
  for (const stage of KNOCKOUT_STAGES) {
    for (const slotInfo of KNOCKOUT_TEMPLATE[stage]) {
      const fx = KNOCKOUT_DEMO_FIXTURES[slotInfo.slot] || { home: 'TBD', away: 'TBD' };
      out.push({
        id: `demo-${slotInfo.slot}`,
        stage,
        slot: slotInfo.slot,
        home: fx.home,
        away: fx.away,
        homeAlias: slotInfo.homeAlias || null,
        awayAlias: slotInfo.awayAlias || null,
        utcDate: knockoutDemoKickoff(slotInfo.slot),
        status: 'TIMED',
        venue: null,
      });
    }
  }
  return out;
}

// Mock results that flow consistently through the demo bracket — every
// home team wins (matches KNOCKOUT_DEMO_FIXTURES progression), except the
// third-place playoff where the away side wins so the loser order works out.
const KNOCKOUT_DEMO_RESULTS = {
  1:  { home: 2, away: 1 }, 2:  { home: 2, away: 0 }, 3:  { home: 3, away: 0 }, 4:  { home: 1, away: 0 },
  5:  { home: 2, away: 1 }, 6:  { home: 3, away: 1 }, 7:  { home: 2, away: 0 }, 8:  { home: 1, away: 0 },
  9:  { home: 2, away: 0 }, 10: { home: 1, away: 0 }, 11: { home: 2, away: 1 }, 12: { home: 2, away: 1 },
  13: { home: 3, away: 1 }, 14: { home: 2, away: 1 }, 15: { home: 2, away: 0 }, 16: { home: 1, away: 0 },
  17: { home: 2, away: 1 }, 18: { home: 1, away: 0 }, 19: { home: 3, away: 1 }, 20: { home: 2, away: 1 },
  21: { home: 2, away: 0 }, 22: { home: 2, away: 1 }, 23: { home: 1, away: 0 }, 24: { home: 2, away: 1 },
  25: { home: 2, away: 1 }, 26: { home: 2, away: 1 }, 27: { home: 1, away: 0 }, 28: { home: 2, away: 1 },
  29: { home: 1, away: 0 }, 30: { home: 2, away: 1 },
  31: { home: 1, away: 2 },
  32: { home: 2, away: 1 },
};

function buildKnockoutDemoResultsById() {
  const out = {};
  for (const [slot, score] of Object.entries(KNOCKOUT_DEMO_RESULTS)) {
    out[`demo-${slot}`] = { home: score.home, away: score.away };
  }
  return out;
}
