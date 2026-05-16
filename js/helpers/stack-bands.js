// Stack-depth bands, tuned to Torn's buy-in range.
// Min buy-in: 50 BB. Max buy-in: 200 BB. Players can run stacks past the cap by winning.
// Single source of truth — consumed by custom report filters, matrix advice engine,
// and migration's per-hand annotation. Edit thresholds here only.

var STACK_BANDS = [
  { key: 'short',     label: 'short',     max: 50 },
  { key: 'mid',       label: 'mid',       max: 150 },
  { key: 'deep',      label: 'deep',      max: 300 },
  { key: 'very-deep', label: 'very deep', max: Infinity },
];

function stackBandKey(effBB) {
  if (effBB == null || !isFinite(effBB)) return 'unknown';
  for (var i = 0; i < STACK_BANDS.length; i++) {
    if (effBB <= STACK_BANDS[i].max) return STACK_BANDS[i].key;
  }
  return 'unknown';
}
