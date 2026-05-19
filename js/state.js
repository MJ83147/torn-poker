// ── STATE (centralized app state) ─────────────────────────────────────────────

var _db = null;
var DB_NAME = 'tc_poker';
var DB_STORE = 'session';
var DB_KEY = 'tc_poker_analysis';

function _openDB(cb) {
  if (_db) return cb(_db);
  var req = indexedDB.open(DB_NAME, 2);  // bumped from 1
  req.onupgradeneeded = function(e) {
    var db = e.target.result;

    // v1 store - keep for migration source, don't delete yet
    if (!db.objectStoreNames.contains(DB_STORE)) {
      db.createObjectStore(DB_STORE);
    }

    // v2 stores
    if (!db.objectStoreNames.contains('hands')) {
      var store = db.createObjectStore('hands', { autoIncrement: true });
      store.createIndex('timestamp', 'timestamp');
      store.createIndex('tableId', 'tableId');
      store.createIndex('outcome', 'outcome.result');
      store.createIndex('position', 'position');
      store.createIndex('dedup', ['timestamp', 'tableId']);
    }
    if (!db.objectStoreNames.contains('meta')) {
      db.createObjectStore('meta');
    }
  };
  req.onsuccess = function(e) {
    _db = e.target.result;
    cb(_db);
  };
  req.onerror = function() { cb(null); };
}

// Boot: migrate localStorage/v1 blob → per-hand records if needed, then call back.
// This MUST complete before any reads happen.
function initStorage(callback) {
  _openDB(function(db) {
    if (!db) { callback(); return; }

    // Check if per-hand migration has already run
    var metaTx = db.transaction('meta', 'readonly');
    var metaGet = metaTx.objectStore('meta').get('session_meta');
    metaGet.onsuccess = function() {
      if (metaGet.result && metaGet.result.migrated) {
        // Already migrated to per-hand format
        callback();
        return;
      }

      // Need to migrate. Try the v1 IDB blob first, then localStorage.
      _loadV1Blob(db, function(blob) {
        if (!blob) {
          // Nothing to migrate - brand new user
          callback();
          return;
        }

        var hands = (Array.isArray(blob) ? blob : (blob.hands || [])).filter(function(h) {
          return h.hole && h.hole.length === 2;
        });

        if (!hands.length) { callback(); return; }

        // Write each hand individually with dedup
        var tx = db.transaction(['hands', 'meta'], 'readwrite');
        var store = tx.objectStore('hands');
        for (var i = 0; i < hands.length; i++) {
          var h = hands[i];
          if (!h.tableId) h.tableId = '';
          store.add(h);
        }

        // Write meta
        tx.objectStore('meta').put({
          player: blob.player || 'Unknown',
          exportedAt: blob.exportedAt || null,
          migrated: true,
          migratedAt: new Date().toISOString()
        }, 'session_meta');

        tx.oncomplete = function() {
          console.log('Migrated ' + hands.length + ' hands to per-hand records');
          callback();
        };
        tx.onerror = function() {
          console.error('Per-hand migration failed');
          callback();
        };
      });
    };
    metaGet.onerror = function() { callback(); };
  });
}

// Read the v1 blob from either the old IDB session store or localStorage
function _loadV1Blob(db, callback) {
  if (db.objectStoreNames.contains(DB_STORE)) {
    var tx = db.transaction(DB_STORE, 'readonly');
    var get = tx.objectStore(DB_STORE).get(DB_KEY);
    get.onsuccess = function() {
      callback(get.result || getJSON('tc_poker_analysis', null));
    };
    get.onerror = function() {
      callback(getJSON('tc_poker_analysis', null));
    };
  } else {
    callback(getJSON('tc_poker_analysis', null));
  }
}

var State = {
  allHands: [],
  meta: {},
  excludedTables: new Set(),
  modalHands: [],
  // UI flags persisted within a session. Living on State (not window) so two
  // panels can read the same value without monkey-patching globals.
  savedExpanded: true,
  // Bumped whenever allHands changes; the panel-cache and analysis-cache use
  // this as part of their key so a new import invalidates everything.
  sessionEpoch: 0,
  // One-time analysis over allHands, computed at import/restore for the header
  // strip. Never recomputed on filter changes or tab switches.
  overallAnalysis: null,

  setSession: function(hands, meta) {
    backfillHandData(hands);
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
    // Warm per-hand caches once so the first analyse()/tab render doesn't
    // pay the full parse cost across all hands on the click thread.
    preparseHands(this.allHands);
    this.meta = meta;
    this.sessionEpoch++;
    this.overallAnalysis = null;
  },

  getFilteredHands: function() {
    var self = this;
    var currentFilter = document.getElementById('table-filter').value;
    var playersFilter = document.getElementById('players-filter').value;
    var filtered = self.allHands;
    if (currentFilter !== 'all') {
      filtered = filtered.filter(function(h) {
        var tid = inferTable(h);
        return currentFilter === 'unknown' ? tid === null : tid === Number(currentFilter);
      });
    }
    if (playersFilter !== 'all') {
      var pf = Number(playersFilter);
      filtered = filtered.filter(function(h) {
        return countHandPlayers(h) === pf;
      });
    }
    filtered = filtered.filter(function(h) {
      return !self.excludedTables.has(String(inferTable(h) || 'unknown'));
    });
    return filtered;
  },

  // Save to IndexedDB (with localStorage fallback) - per-hand records
  save: function(data) {
    _openDB(function(db) {
      if (!db) {
        setJSON('tc_poker_analysis', data);
        return;
      }
      var hands = data.hands || [];
      var tx = db.transaction(['hands', 'meta'], 'readwrite');
      tx.onerror = function() { console.warn('IndexedDB save transaction failed', tx.error); };
      var store = tx.objectStore('hands');
      var dedupIdx = store.index('dedup');

      for (var i = 0; i < hands.length; i++) {
        (function(hand) {
          if (!hand.tableId) hand.tableId = '';
          var check = dedupIdx.get([hand.timestamp, hand.tableId]);
          check.onsuccess = function() {
            if (!check.result) {
              var addReq = store.add(hand);
              addReq.onerror = function() {
                console.warn('IndexedDB hand add failed', addReq.error, hand && hand.timestamp);
              };
            }
          };
          check.onerror = function() {
            console.warn('IndexedDB dedup lookup failed', check.error);
          };
        })(hands[i]);
      }

      // Update meta
      var metaPut = tx.objectStore('meta').put({
        player: data.player || 'Unknown',
        exportedAt: data.exportedAt || new Date().toISOString(),
        migrated: true,
        lastImportAt: new Date().toISOString()
      }, 'session_meta');
      metaPut.onerror = function() {
        console.warn('IndexedDB meta put failed', metaPut.error);
      };
    });
  },

  // Load from IndexedDB per-hand store (with localStorage fallback). Async.
  loadSaved: function(callback) {
    _openDB(function(db) {
      if (!db) {
        callback(getJSON('tc_poker_analysis', null));
        return;
      }

      // Read meta
      var metaTx = db.transaction('meta', 'readonly');
      var metaGet = metaTx.objectStore('meta').get('session_meta');
      metaGet.onsuccess = function() {
        var meta = metaGet.result;
        if (!meta) { callback(null); return; }

        // Read all hands
        var handsTx = db.transaction('hands', 'readonly');
        var handsGet = handsTx.objectStore('hands').getAll();
        handsGet.onsuccess = function() {
          var hands = handsGet.result || [];
          if (!hands.length) { callback(null); return; }
          callback({
            hands: hands,
            player: meta.player,
            exportedAt: meta.exportedAt
          });
        };
        handsGet.onerror = function() { callback(null); };
      };
      metaGet.onerror = function() { callback(null); };
    });
  },

  clear: function() {
    this.allHands = [];
    this.meta = {};
    this.sessionEpoch++;
    this.overallAnalysis = null;
  }
};
