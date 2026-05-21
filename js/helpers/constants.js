// POSITION_ORDER is the canonical 9-position list. Panels and sections filter
// it against per-hand data, so it is safe to use the full list everywhere.
var POSITION_ORDER = ['UTG', 'UTG+1', 'MP', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
var EARLY_POSITIONS = ['UTG', 'UTG+1', 'MP'];
var LATE_POSITIONS  = ['CO', 'BTN'];
var STREETS = ['Preflop', 'Flop', 'Turn', 'River'];
var SEAT_COUNTS = [5, 6, 7, 8, 9];
