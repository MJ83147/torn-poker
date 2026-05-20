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

function dominantSeatBucket(d) {
  var n = dominantSeats(d);
  return n ? n + 'p' : null;
}

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

// Tighten the trigger gap when samples are small. Multiply the base threshold
// by sqrt(40 / n) and floor at the base value so big samples never relax the rule.
function scaleThresh(base, n) {
  if (!n || n <= 0) return base;
  var mult = Math.max(1, Math.sqrt(40 / Math.max(1, n)));
  return base * mult;
}

function defaultPositionFor(seats) {
  return seats === 2 ? 'BTN' : seats === 3 ? 'BTN' : 'CO';
}

function bandFor(metric, d, position) {
  var seats = dominantSeats(d);
  if (!seats) return null;
  var pos = position || dominantPosition(d) || defaultPositionFor(seats);
  return matrixTarget(metric, pos, seats, getUserStyle());
}

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
