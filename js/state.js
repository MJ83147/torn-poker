// ── STATE (centralized app state) ─────────────────────────────────────────────

var State = {
  allHands: [],
  meta: {},
  excludedTables: new Set(),
  modalHands: [],

  setSession: function(hands, meta) {
    this.allHands = hands.filter(function(h) { return inferTable(h) !== null; });
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

  save: function(raw) {
    try { localStorage.setItem('tc_poker_analysis', raw); } catch (_) {}
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
