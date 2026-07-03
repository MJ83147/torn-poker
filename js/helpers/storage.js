function getJSON(key, fallback) {
  try {
    var raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    return JSON.parse(raw);
  } catch (e) {
    return fallback;
  }
}

function setJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn('[storage] localStorage write failed for ' + key + ':', e);
  }
}

function getString(key, fallback) {
  try {
    var raw = localStorage.getItem(key);
    return raw == null ? fallback : raw;
  } catch (e) {
    return fallback;
  }
}

function setString(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    console.warn('[storage] localStorage write failed for ' + key + ':', e);
  }
}

function getSession(key, fallback) {
  try {
    var raw = sessionStorage.getItem(key);
    if (raw == null) return fallback;
    return raw;
  } catch (e) {
    return fallback;
  }
}

function setSession(key, value) {
  try {
    sessionStorage.setItem(key, value);
  } catch (e) {
    console.warn('[storage] sessionStorage write failed for ' + key + ':', e);
  }
}

function removeSession(key) {
  try {
    sessionStorage.removeItem(key);
  } catch (e) { /* noop */ }
}

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
  return getJSON('tc_starred_hands', {});
}

function setStarredHands(map) {
  setJSON('tc_starred_hands', map);
}

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
