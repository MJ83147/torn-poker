(function() {
  function bandFor(metric, position, seats, style) {
    if (!metric || !position || !seats) return null;
    if (typeof matrixTarget !== 'function') return null;
    return matrixTarget(metric, position, seats, style || null);
  }

  // Band for the aggregate VPIP measurement: the dominant cell's band so the
  // renderer can surface it once context is established.
  function aggregateBandFor(metric, d) {
    if (!d) return null;
    var seats = (typeof dominantSeats === 'function') ? dominantSeats(d) : null;
    var position = (typeof dominantPosition === 'function') ? dominantPosition(d) : null;
    if (!seats || !position) return null;
    return bandFor(metric, position, seats);
  }

  // Returns Set<string> of hand keys (e.g. 'AKs', 'TT', 'A5o') or null.
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
