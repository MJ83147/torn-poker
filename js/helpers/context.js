// ── GAME CONTEXT HELPER ───────────────────────────────────────────────────────
// Single source of truth for the table-mix lookups every panel and every rule
// reaches for:
//   - dominant seat count (2..9) and seat bucket key
//   - dominant flop bucket (HU / 3-way / multiway)
//   - dominant position from a candidate list
//   - matrix band lookup with the current player style applied
//   - sample-size aware threshold scaler
//   - flop-bucket modifier for postflop metrics
//
// Two ways to use:
//
//   1. Standalone helpers (used by rule definitions in the engine):
//        dominantSeats(d)
//        dominantPosition(d, ['UTG','UTG+1','MP'])
//        bandFor('vpip', d)
//        scaleThresh(8, d.n)
//
//   2. Bundled context object (used by panel rendering):
//        var ctx = getGameContext(d);
//        ctx.seats, ctx.flopBucket, ctx.band(...), ctx.scaleN(8), ctx.domPos([...])

// Pick the seat count the player has played most. Returns a number 2-9 or null.
function dominantSeats(d) {
  if (!d || !d.bySeatBucket) return null;
  var best = null, bestN = 0;
  for (var sb in d.bySeatBucket) {
    var sd = d.bySeatBucket[sb];
    if (!sd || (sd.n || 0) <= bestN) continue;
    bestN = sd.n;
    best = parseInt(sb, 10);
  }
  if (!best || isNaN(best)) return null;
  return Math.max(2, Math.min(9, best));
}

// Seat bucket key '2p'..'9p' for the dominant seat count, or null.
function dominantSeatBucket(d) {
  var n = dominantSeats(d);
  return n ? n + 'p' : null;
}

// Pick the position the player has played most. If `candidates` is given, only
// considers positions in that list. Returns the position string or null.
function dominantPosition(d, candidates) {
  if (!d || !d.byPosition) return null;
  var best = null, bestN = 0;
  for (var p in d.byPosition) {
    if (candidates && candidates.indexOf(p) === -1) continue;
    var pd = d.byPosition[p];
    if (!pd || (pd.n || 0) <= bestN) continue;
    bestN = pd.n;
    best = p;
  }
  return best;
}

// Pick the dominant flop bucket: 'HU' / '3-way' / 'multiway' or null.
function dominantFlopBucket(d) {
  if (!d || !d.byFlopBucket) return null;
  var keys = ['HU', '3-way', 'multiway'];
  var best = null, bestN = 0;
  for (var i = 0; i < keys.length; i++) {
    var fd = d.byFlopBucket[keys[i]];
    if (!fd || (fd.n || 0) <= bestN) continue;
    bestN = fd.n;
    best = keys[i];
  }
  return best;
}

// Sample-size scaler: tighten the trigger gap when samples are small. Multiply
// the base threshold by sqrt(40 / n) and floor at the base value so big samples
// never relax the rule.
function scaleThresh(base, n) {
  if (!n || n <= 0) return base;
  var mult = Math.max(1, Math.sqrt(40 / Math.max(1, n)));
  return base * mult;
}

// Default position when no specific seat is given. Mirrors the per-seat-count
// expression that mygame.js used to inline.
function defaultPositionFor(seats) {
  return seats === 2 ? 'BTN' : seats === 3 ? 'BTN' : 'CO';
}

// Pull a matrix band for the dominant cell. Optional explicit position; falls
// back to the dominant position, then the seat-count default. Returns
// {tight, ideal, loose} or null when no cell qualifies.
function bandFor(metric, d, position) {
  var seats = dominantSeats(d);
  if (!seats) return null;
  var pos = position || dominantPosition(d) || defaultPositionFor(seats);
  return matrixTarget(metric, pos, seats, getUserStyle());
}

// Flop bucket modifier (in percentage points) for postflop metrics. Postflop
// aggression rules tighten on multiway and loosen heads-up.
function flopMod(metric, d) {
  var fb = dominantFlopBucket(d);
  if (!fb) return 0;
  if (metric === 'cbet') {
    if (fb === 'HU') return 15;
    if (fb === 'multiway') return -20;
    return 0;
  }
  if (metric === 'flop-fold') {
    if (fb === 'HU') return -10;
    if (fb === 'multiway') return 10;
    return 0;
  }
  if (metric === 'foldToRaise') {
    if (fb === 'HU') return -8;
    if (fb === 'multiway') return 5;
    return 0;
  }
  return 0;
}

// Bundled context object for panel rendering.
function getGameContext(d) {
  var seats = dominantSeats(d);
  var flopBucket = dominantFlopBucket(d);
  var defaultPos = defaultPositionFor(seats);

  return {
    seats: seats,
    flopBucket: flopBucket,
    defaultPos: defaultPos,
    band: function(metric, position) {
      return bandFor(metric, d, position);
    },
    scaleN: function(base) {
      var n = (d && d.n) || 1;
      return Math.max(base, Math.round(scaleThresh(base, n)));
    },
    domPos: function(candidates) {
      if (!candidates || !candidates.length) return null;
      return dominantPosition(d, candidates) || candidates[0];
    },
  };
}
