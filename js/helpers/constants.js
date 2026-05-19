// ── SHARED CONSTANTS ─────────────────────────────────────────────────────────
// Position / street / seat-count literals that used to be redeclared inline
// across panels and insight sections. Always reference these instead of
// inlining the array, so a position rename or a new street name only has to
// happen in one place.
//
// POSITION_ORDER is the canonical 9-position priority list (UTG to BB,
// including LJ). Panels and insight sections filter this against per-hand
// data and ignore positions with zero hands, so it is safe to use the full
// list everywhere even on smaller tables.

var POSITION_ORDER = ['UTG', 'UTG+1', 'MP', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
var EARLY_POSITIONS = ['UTG', 'UTG+1', 'MP'];
var LATE_POSITIONS  = ['CO', 'BTN'];
var STREETS = ['Preflop', 'Flop', 'Turn', 'River'];
var SEAT_COUNTS = [5, 6, 7, 8, 9];
