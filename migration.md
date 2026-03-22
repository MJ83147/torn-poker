# IndexedDB Migration: Fix Read/Write Split, Then Restructure to Per-Hand Records

## Current state of the codebase

These instructions reference three files: `state.js`, `app.js`, and `index.html`.

### What exists now

**state.js** has:
- `_openDB(cb)` — opens IndexedDB database `tc_poker` (version 1) with one object store called `session`
- `migrateToIDB()` — runs on load, copies the localStorage blob into IndexedDB. Fire-and-forget (async, no callback).
- `State.save(data)` — writes to IndexedDB (with localStorage fallback if IDB fails)
- `State.loadSaved()` — reads from localStorage only (never reads from IndexedDB). Defined but never called anywhere.
- `State.setSession(hands, meta)` — deduplicates hands, calls `State.save()`, sets in-memory state
- `State.getFilteredHands()` — filters `State.allHands` by table filter and exclusions
- `State.clear()` — resets in-memory state

**app.js** has:
- `checkSavedSession()` (line 35) — reads from `localStorage.getItem('tc_poker_analysis')` directly. Shows the restore button if data exists.
- `process(raw)` (line 168) — parses pasted JSON, calls `State.setSession()` which writes to IndexedDB via `State.save()`
- Boot sequence (line 283) — calls `checkSavedSession()` immediately

### The problem

Writes go to IndexedDB. Reads come from localStorage. This means:

1. User imports data → saved to IndexedDB via `State.save()`
2. User closes page, comes back → `checkSavedSession()` reads localStorage
3. localStorage may have stale data (from before IDB was added) or no data at all (if the user's first import was after the IDB code shipped and the localStorage fallback wasn't triggered)
4. Restore button shows wrong data or doesn't appear

### Three user types to handle

| User type | localStorage | IndexedDB |
|---|---|---|
| Brand new | empty | empty |
| Existing (pre-IDB update) | has blob | empty |
| Recent (post-IDB update) | may have stale blob | has current blob |

---

## Phase 1: Fix the read/write split (do this first)

The goal is to make all reads come from IndexedDB, while safely migrating any localStorage-only users first. **No structural changes to the data format.** The blob stays as-is for now.

### 1.1 Changes to state.js

Replace the entire file with:

```js
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

// Boot: migrate localStorage → IDB if needed, then call back when ready.
// This MUST complete before any reads happen.
function initStorage(callback) {
  _openDB(function(db) {
    if (!db) {
      // IDB unavailable — fall back to localStorage reads
      callback();
      return;
    }

    // Check if IDB already has data
    var tx = db.transaction(DB_STORE, 'readonly');
    var get = tx.objectStore(DB_STORE).get(DB_KEY);
    get.onsuccess = function() {
      if (get.result) {
        // IDB has data — migration not needed
        callback();
        return;
      }

      // IDB is empty — check localStorage for data to migrate
      var raw = null;
      try { raw = localStorage.getItem('tc_poker_analysis'); } catch (_) {}
      if (!raw) {
        // Nothing anywhere — brand new user
        callback();
        return;
      }

      var parsed;
      try { parsed = JSON.parse(raw); } catch (_) { callback(); return; }

      // Migrate localStorage blob into IDB
      var writeTx = db.transaction(DB_STORE, 'readwrite');
      writeTx.objectStore(DB_STORE).put(parsed, DB_KEY);
      writeTx.oncomplete = function() {
        console.log('Migrated localStorage data to IndexedDB');
        callback();
      };
      writeTx.onerror = function() {
        console.error('Migration to IDB failed');
        callback();
      };
    };
    get.onerror = function() {
      callback();
    };
  });
}

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
        try { localStorage.setItem('tc_poker_analysis', JSON.stringify(data)); } catch (_) {}
        return;
      }
      var tx = db.transaction(DB_STORE, 'readwrite');
      tx.objectStore(DB_STORE).put(data, DB_KEY);
    });
  },

  // Load from IndexedDB (with localStorage fallback). Async.
  loadSaved: function(callback) {
    _openDB(function(db) {
      if (!db) {
        // IDB unavailable — try localStorage
        var result = null;
        try { result = JSON.parse(localStorage.getItem('tc_poker_analysis')); } catch (_) {}
        callback(result);
        return;
      }
      var tx = db.transaction(DB_STORE, 'readonly');
      var get = tx.objectStore(DB_STORE).get(DB_KEY);
      get.onsuccess = function() {
        if (get.result) {
          callback(get.result);
        } else {
          // IDB empty — try localStorage as last resort
          var result = null;
          try { result = JSON.parse(localStorage.getItem('tc_poker_analysis')); } catch (_) {}
          callback(result);
        }
      };
      get.onerror = function() {
        var result = null;
        try { result = JSON.parse(localStorage.getItem('tc_poker_analysis')); } catch (_) {}
        callback(result);
      };
    });
  },

  clear: function() {
    this.allHands = [];
    this.meta = {};
  }
};
```

**What changed from the original state.js:**

1. **Removed `migrateToIDB()`** and its immediate call. Replaced with `initStorage(callback)` which does the same migration but waits for it to finish before calling back.
2. **`initStorage(callback)`** checks IDB first. If IDB already has data, skips migration. If IDB is empty and localStorage has data, migrates it. Calls `callback` only after migration is complete (or confirmed unnecessary).
3. **`State.loadSaved(callback)`** is now async. Reads from IDB first, falls back to localStorage if IDB is empty or unavailable. The old version was synchronous and read from localStorage only.
4. Everything else (`State.setSession`, `State.getFilteredHands`, `State.save`, `State.clear`) is unchanged.

### 1.2 Changes to app.js

Two changes needed:

**Change 1: Make `checkSavedSession()` use `State.loadSaved()` instead of direct localStorage.**

Replace the entire `checkSavedSession` function (lines 35-59) with:

```js
function checkSavedSession() {
  State.loadSaved(function(json) {
    if (!json) return;
    try {
      var hands = (Array.isArray(json) ? json : (json.hands || [])).filter(function(h) { return h.hole && h.hole.length === 2; });
      if (!hands.length) return;
      var playerName = json.player || detectPlayerFromActions(hands) || 'Unknown';
      var rb = document.getElementById('restore-block');
      var rl = document.getElementById('restore-label');
      var date = json.exportedAt ? new Date(json.exportedAt).toLocaleDateString('en-GB', {
        day: 'numeric', month: 'short', year: 'numeric',
      }) : '';
      rl.textContent = hands.length + ' hands from ' + playerName + (date ? ' · ' + date : '') + ' found in storage';
      rb.style.display = 'block';
      document.getElementById('restore-btn').onclick = function() {
        var meta = {
          player: playerName,
          exportedAt: new Date().toISOString(),
        };
        State.setSession(hands, meta);
        try { fetch('https://script.google.com/macros/s/AKfycbyTtG1UMCpYXP15dgKQttFyG4Pe-BG8FoAftoW3oYtMBISS37Ws5lYhPPDJ0zl1GYxyQA/exec', { method: 'POST', body: JSON.stringify({ player: playerName, hands: hands.length }), mode: 'no-cors' }); } catch(_) {}
        showImportLoader(hands.length, function() { render(analyse(hands), hands, meta); });
      };
    } catch (_) {}
  });
}
```

The logic is identical. The only difference is it gets `json` from the callback parameter instead of parsing `localStorage.getItem()`.

**Change 2: Boot sequence must wait for `initStorage` before calling `checkSavedSession`.**

Replace the last line of app.js (line 283):

```js
// OLD (line 283):
checkSavedSession();
```

With:

```js
// NEW:
initStorage(function() {
  checkSavedSession();
});
```

This ensures the localStorage → IDB migration completes before any read happens.

### 1.3 Changes to index.html

**None.** No changes needed.

### 1.4 How to verify Phase 1 works

Test all three user types:

**Test 1 — Existing user (localStorage only):**
1. In DevTools, clear IndexedDB (`tc_poker` database)
2. Make sure `localStorage.getItem('tc_poker_analysis')` returns data
3. Reload the page
4. The restore button should appear with the correct hand count
5. In DevTools, check IndexedDB `tc_poker` → `session` store → `tc_poker_analysis` key now has data

**Test 2 — Recent user (IDB already has data):**
1. Import a session (paste JSON, click Analyse)
2. Reload the page
3. Restore button should show the correct data from IDB, regardless of what localStorage has

**Test 3 — Brand new user:**
1. Clear both localStorage and IndexedDB
2. Reload
3. No restore button appears
4. Paste and import a session
5. Reload — restore button now shows the imported data

---

## Phase 2: Restructure to per-hand records (do after Phase 1 is confirmed working)

This changes the IndexedDB schema from a single blob to individual hand records with indexes.

### 2.1 Changes to state.js

**Bump the database version from 1 to 2** in `_openDB`. Add the new stores in `onupgradeneeded`.

Replace `_openDB`:

```js
function _openDB(cb) {
  if (_db) return cb(_db);
  var req = indexedDB.open(DB_NAME, 2);  // bumped from 1
  req.onupgradeneeded = function(e) {
    var db = e.target.result;

    // v1 store — keep for migration source, don't delete yet
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
```

**Replace `initStorage`** to handle the per-hand migration:

```js
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
          // Nothing to migrate — brand new user
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
      if (get.result) {
        callback(get.result);
      } else {
        // IDB empty, try localStorage
        var result = null;
        try { result = JSON.parse(localStorage.getItem('tc_poker_analysis')); } catch (_) {}
        callback(result);
      }
    };
    get.onerror = function() {
      var result = null;
      try { result = JSON.parse(localStorage.getItem('tc_poker_analysis')); } catch (_) {}
      callback(result);
    };
  } else {
    var result = null;
    try { result = JSON.parse(localStorage.getItem('tc_poker_analysis')); } catch (_) {}
    callback(result);
  }
}
```

**Replace `State.save`** to write per-hand records with dedup:

```js
save: function(data) {
  _openDB(function(db) {
    if (!db) {
      try { localStorage.setItem('tc_poker_analysis', JSON.stringify(data)); } catch (_) {}
      return;
    }
    var hands = data.hands || [];
    var tx = db.transaction(['hands', 'meta'], 'readwrite');
    var store = tx.objectStore('hands');
    var dedupIdx = store.index('dedup');

    for (var i = 0; i < hands.length; i++) {
      (function(hand) {
        if (!hand.tableId) hand.tableId = '';
        var check = dedupIdx.get([hand.timestamp, hand.tableId]);
        check.onsuccess = function() {
          if (!check.result) {
            store.add(hand);
          }
        };
      })(hands[i]);
    }

    // Update meta
    tx.objectStore('meta').put({
      player: data.player || 'Unknown',
      exportedAt: data.exportedAt || new Date().toISOString(),
      migrated: true,
      lastImportAt: new Date().toISOString()
    }, 'session_meta');
  });
},
```

**Replace `State.loadSaved`** to read from the per-hand `hands` store:

```js
loadSaved: function(callback) {
  _openDB(function(db) {
    if (!db) {
      var result = null;
      try { result = JSON.parse(localStorage.getItem('tc_poker_analysis')); } catch (_) {}
      callback(result);
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
```

### 2.2 Changes to app.js

**None.** The `checkSavedSession()` and boot sequence changes from Phase 1 already use `State.loadSaved(callback)` and `initStorage(callback)`. Those interfaces don't change in Phase 2 — only their internal implementation changes in `state.js`.

### 2.3 Changes to index.html

**None.**

---

## Index reference

After Phase 2, the `hands` store has these indexes:

| Index name | Key path | Use case |
|---|---|---|
| `timestamp` | `timestamp` | Date range queries, ordering, trends |
| `tableId` | `tableId` | Per-table filtering |
| `outcome` | `outcome.result` | Pull all wins / losses / folds |
| `position` | `position` | Position-based queries |
| `dedup` | `['timestamp', 'tableId']` | Duplicate detection on import |

Query examples:

```js
// All hands from a specific table
var idx = store.index('tableId');
idx.getAll('holdem21');

// All winning hands
var idx = store.index('outcome');
idx.getAll('won');

// Hands in a date range
var idx = store.index('timestamp');
var range = IDBKeyRange.bound(startMs, endMs);
idx.getAll(range);

// Check for duplicate before insert
var idx = store.index('dedup');
var check = idx.get([hand.timestamp, hand.tableId]);
check.onsuccess = function() {
  if (!check.result) store.add(hand);
};
```

---

## Migration flow summary

```
Page loads
  → _openDB() runs
    → version 1 users: onupgradeneeded creates 'hands' + 'meta' stores
    → version 2 users: no upgrade needed
  → initStorage(callback) runs
    → Checks meta store for { migrated: true }
      → Found: migration done, call callback immediately
      → Not found: read v1 blob (IDB session store → localStorage fallback)
        → Insert each hand into 'hands' store
        → Write meta with migrated: true
        → Call callback
  → callback runs checkSavedSession()
    → State.loadSaved(cb) reads from 'hands' + 'meta' stores
    → Shows restore button if data exists
  → User pastes JSON → process() → State.setSession() → State.save()
    → Deduplicates and inserts per-hand records into 'hands' store
```

---

## What NOT to change

- **Do not delete localStorage data.** Leave it as a safety net.
- **Do not delete the v1 `session` object store** in Phase 2. It stays as a migration source. Can be removed in a future version (bump to version 3, delete in `onupgradeneeded`).
- **Do not change the Tampermonkey script.** It still uses localStorage on the `torn.com` origin. That's fine — it only stores temporary data before export and has its own cap.
- **Do not change `index.html`.** No markup changes needed for either phase.
- **Do not change `State.setSession()`, `State.getFilteredHands()`, or `State.clear()`.** Their interfaces stay the same. Only `save`, `loadSaved`, and the boot sequence change.