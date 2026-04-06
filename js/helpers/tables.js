// ── TABLE METADATA ────────────────────────────────────────────────────────────

// Table metadata (blind levels, max seats, tournament flag)
const TABLE_META = {
  2:  { name: 'Newbie Corner',   bb: 10,        sb: 5,        max: 9 },
  3:  { name: 'Hobo Holdem',     bb: 25,        sb: 13,       max: 9 },
  4:  { name: '8-bit',           bb: 100,       sb: 50,       max: 5 },
  5:  { name: 'Sprinkles',       bb: 250,       sb: 125,      max: 9 },
  6:  { name: 'Gatling Gun',     bb: 1000,      sb: 500,      max: 9 },
  7:  { name: 'Quickdraw',       bb: 2500,      sb: 1250,     max: 9 },
  8:  { name: 'Tight Knit',      bb: 5000,      sb: 2500,     max: 6 },
  9:  { name: 'Ballsy',          bb: 25000,     sb: 12500,    max: 9 },
  10: { name: 'Pound It',        bb: 250000,    sb: 125000,   max: 9 },
  11: { name: "Old 'n Slow",     bb: 100000,    sb: 50000,    max: 6 },
  12: { name: 'Tripod',          bb: 1000000,   sb: 500000,   max: 3 },
  13: { name: 'Slow Cooker',     bb: 5000000,   sb: 2500000,  max: 9 },
  14: { name: 'Fire Pit',        bb: 25000000,  sb: 12500000, max: 9 },
  15: { name: 'High Rollers',    bb: 10000000,  sb: 5000000,  max: 9 },
  16: { name: 'Oligarch',        bb: 100000000, sb: 50000000, max: 6 },
  17: { name: 'Fourplay',        bb: 100000,    sb: 50000,    max: 4 },
  18: { name: 'Duel at Dawn',    bb: 100000,    sb: 50000,    max: 2 },
  19: { name: 'Juan on Juan',    bb: 5000000,   sb: 2500000,  max: 2 },
  20: { name: 'Boom or Bust',    bb: 50000,     sb: 25000,    max: 9 },
  21: { name: 'Old Folks Home',  bb: 500000,    sb: 250000,   max: 6 },
  22: { name: 'Comatose Cove',   bb: 1000000,   sb: 500000,   max: 6 },
  23: { name: 'Periodic',        bb: 100000,    sb: 50000,    max: 9 },
  24: { name: "E-asy Street",    bb: 500,       sb: 250,      max: 9 },
  25: { name: "Cat's Chance",    bb: 2500000,   sb: 1250000,  max: 9 },
  26: { name: 'Broke Jokes',     bb: 50,        sb: 25,       max: 9 },
  27: { name: 'Six of the Best', bb: 10000,     sb: 5000,     max: 6 },
  28: { name: 'River Wizard',    bb: 1000000,   sb: 500000,   max: 9 },
  32: { name: 'Spilled Milk',    bb: 10,        sb: 5,        max: 6, tournament: true },
  33: { name: 'Dive Bar',        bb: 10,        sb: 5,        max: 6, tournament: true },
  34: { name: 'Lost at Sea',     bb: 10,        sb: 5,        max: 6, tournament: true },
  35: { name: 'Jaded',           bb: 10,        sb: 5,        max: 6, tournament: true },
  36: { name: 'Hell For',        bb: 10,        sb: 5,        max: 6, tournament: true },
  37: { name: 'Beach Please',    bb: 10,        sb: 5,        max: 6, tournament: true },
  38: { name: 'Cut the Cord',    bb: 10,        sb: 5,        max: 6, tournament: true },
  39: { name: 'Natural Talent',  bb: 10,        sb: 5,        max: 6, tournament: true },
  40: { name: 'Luxe',            bb: 10,        sb: 5,        max: 6, tournament: true },
  41: { name: 'Bloody Hell',     bb: 10,        sb: 5,        max: 6, tournament: true },
  43: { name: 'tsop test 1',     bb: 500,       sb: 250,      max: 4, tournament: true },
  44: { name: 'tsop test 2',     bb: 500,       sb: 250,      max: 7, tournament: true },
};

// Cash tables used to separate tournaments from cash games
const CASH_TABLE_IDS = new Set([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28]);

// Map of big blind amount -> table entries with max seats (for blind-based inference)
const BB_TO_TABLES = (() => {
  const map = {};
  for (const [id, t] of Object.entries(TABLE_META)) {
    if (t.tournament) continue; // only map cash tables for blind inference
    if (!map[t.bb]) map[t.bb] = [];
    map[t.bb].push({ id: Number(id), max: t.max });
  }
  return map;
})();

// BB display toggle state
let _displayBB = false;
