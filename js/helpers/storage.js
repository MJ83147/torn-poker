// ── STARRED HANDS (localStorage persistence) ─────────────────────────────────

function getHandKey(h) {
  var hole = (h.hole || []).join('');
  var board = (h.board || []).join('');
  var pos = h.position || '';
  var res = h.outcome ? h.outcome.result : '';
  var amt = h.outcome ? (h.outcome.amount || 0) : 0;
  var inv = h.invested || 0;
  var actLen = (h.actions || []).length;
  return hole + '|' + board + '|' + pos + '|' + res + '|' + amt + '|' + inv + '|' + actLen;
}

function getStarredHands() {
  try { return JSON.parse(localStorage.getItem('tc_starred_hands') || '{}'); } catch(e) { return {}; }
}

function setStarredHands(map) {
  try {
    localStorage.setItem('tc_starred_hands', JSON.stringify(map));
  } catch(e) {
    console.warn('[starred] localStorage write failed:', e);
  }
}

// Store only the fields needed to display/replay a hand (skip raw actions bloat)
function compactHand(h) {
  return {
    hole: h.hole,
    board: h.board,
    position: h.position,
    outcome: h.outcome,
    invested: getInvested(h),
    pot: h.pot,
    actions: h.actions,
    tableId: h.tableId,
    table: h.table,
    bigBlind: h.bigBlind,
    tableSize: h.tableSize,
    player: h.player
  };
}

function isHandStarred(h) {
  return !!getStarredHands()[getHandKey(h)];
}

function toggleStarHand(h) {
  var map = getStarredHands();
  var key = getHandKey(h);
  if (map[key]) {
    delete map[key];
  } else {
    map[key] = { hand: compactHand(h), note: '', savedAt: new Date().toISOString() };
  }
  setStarredHands(map);
  return !!map[key];
}

function getHandNote(h) {
  var entry = getStarredHands()[getHandKey(h)];
  return entry ? entry.note : '';
}

function setHandNote(h, note) {
  var map = getStarredHands();
  var key = getHandKey(h);
  if (map[key]) {
    map[key].note = note;
    setStarredHands(map);
  }
}
