// ── STATE (centralized app state) ─────────────────────────────────────────────

var _db = null;
var DB_NAME = 'tc_poker';
var DB_STORE = 'session';
var DB_KEY = 'tc_poker_analysis';

function _openDB(cb) {
  if (_db) return cb(_db);
  var req = indexedDB.open(DB_NAME, 1);
  req.onupgradeneeded = function(e) {
    e.target.result.createObjectStore(DB_STORE);
  };
  req.onsuccess = function(e) {
    _db = e.target.result;
    cb(_db);
  };
  req.onerror = function() { cb(null); };
}

// Migrate localStorage → IndexedDB on load (safe: doesn't delete localStorage)
function migrateToIDB() {
  var raw = null;
  try { raw = localStorage.getItem('tc_poker_analysis'); } catch (_) {}
  if (!raw) return;
  var parsed;
  try { parsed = JSON.parse(raw); } catch (_) { return; }
  _openDB(function(db) {
    if (!db) return;
    var tx = db.transaction(DB_STORE, 'readwrite');
    tx.objectStore(DB_STORE).put(parsed, DB_KEY);
  });
}

migrateToIDB();

var State = {
  allHands: [],
  meta: {},
  excludedTables: new Set(),
  modalHands: [],

  setSession: function(hands, meta) {
    var seen = {};
    var clean = [];
    for (var i = 0; i < hands.length; i++) {
      var h = hands[i];
      var hole = (h.hole && h.hole.length === 2) ? h.hole[0] + h.hole[1] : '??';
      var key = h.timestamp + '|' + hole + '|' + (h.position || '');
      if (!seen[key]) {
        seen[key] = true;
        clean.push(h);
      }
    }
    this.save({ hands: clean, player: meta.player, exportedAt: meta.exportedAt });
    this.allHands = clean.filter(function(h) { return inferTable(h) !== null; });
    this.meta = meta;
  },

  getFilteredHands: function() {
    var self = this;
    var currentFilter = document.getElementById('table-filter').value;
    var filtered = self.allHands;
    if (currentFilter !== 'all') {
      filtered = self.allHands.filter(function(h) {
        var tid = inferTable(h);
        return currentFilter === 'unknown' ? tid === null : tid === Number(currentFilter);
      });
    }
    filtered = filtered.filter(function(h) {
      return !self.excludedTables.has(String(inferTable(h) || 'unknown'));
    });
    return filtered;
  },

  // Save to IndexedDB (with localStorage fallback)
  save: function(data) {
    _openDB(function(db) {
      if (!db) {
        // Fallback: try localStorage
        try { localStorage.setItem('tc_poker_analysis', JSON.stringify(data)); } catch (_) {}
        return;
      }
      var tx = db.transaction(DB_STORE, 'readwrite');
      tx.objectStore(DB_STORE).put(data, DB_KEY);
    });
  },

  loadSaved: function() {
    try {
      return JSON.parse(localStorage.getItem('tc_poker_analysis'));
    } catch (_) { return null; }
  },

  clear: function() {
    this.allHands = [];
    this.meta = {};
  }
};
