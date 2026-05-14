// ── TARGET BANDS ──────────────────────────────────────────────────────────────
//
// Centralised lookup for the target band of any metric, keyed by context. The
// underlying tables live in js/engine/matrix.js (per seat count, per position).
// This helper is the entry point sections call so future sections don't have
// to know where the tables live.
//
// Stage 5.2 covers VPIP only (Width of Range). Add metrics as later sections
// land. Each helper returns either { tight, ideal, loose } or null.

(function() {
  // Resolve a band for a metric at a specific cell (position x seats).
  //
  //   metric    'vpip' (more later)
  //   position  'UTG' | 'MP' | 'HJ' | 'CO' | 'BTN' | 'SB' | 'BB' | ...
  //   seats     2 to 9
  //   style     optional, defaults to the persisted user style (TAG by default)
  function bandFor(metric, position, seats, style) {
    if (!metric || !position || !seats) return null;
    if (typeof matrixTarget !== 'function') return null;
    return matrixTarget(metric, position, seats, style || null);
  }

  // Band for the aggregate VPIP measurement. The spec says the aggregate is
  // stated without a target; the target is introduced at the dominant cell.
  // This helper returns the band of that dominant cell so the renderer can
  // surface it once context is established.
  function aggregateBandFor(metric, d) {
    if (!d) return null;
    var seats = (typeof dominantSeats === 'function') ? dominantSeats(d) : null;
    var position = (typeof dominantPosition === 'function') ? dominantPosition(d) : null;
    if (!seats || !position) return null;
    return bandFor(metric, position, seats);
  }

  // For Width of Range we also want to know the "ideal" recommended set of
  // hand keys for a given (position, seats). Used by Winning Hands to mark a
  // hand as inside or outside the target range. Returns a Set<string> of hand
  // keys (e.g. 'AKs', 'TT', 'A5o') or null.
  function recommendedHandsFor(position, seats) {
    if (!position || !seats) return null;
    if (typeof matrixForSeats !== 'function') return null;
    var entry = matrixForSeats(seats);
    if (!entry || !entry.rangesByPos) return null;
    return entry.rangesByPos[position] || null;
  }

  window.TargetBands = {
    bandFor: bandFor,
    aggregateBandFor: aggregateBandFor,
    recommendedHandsFor: recommendedHandsFor
  };
})();
