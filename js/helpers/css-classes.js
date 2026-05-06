// ── CSS CLASS NAME CONSTANTS ────────────────────────────────────────────────
// Names of CSS classes referenced from JavaScript live here so a class rename
// is one edit instead of five. Only put a class here if more than one JS file
// adds / removes / toggles it. Class names used only inside one file can stay
// as plain string literals.
//
// CSS hookup: every name in this file must have a matching selector in
// styles.css or mobile-styles.css. JS adding a class with no matching CSS
// rule has been a recurring bug (e.g. modal overlays staying invisible).

var CSS = {
  // Modal / overlay visibility transition. Toggled with requestAnimationFrame
  // so the .show class triggers the opacity animation.
  SHOW: 'show',

  // Generic "active / on" state used for tabs, panels, the loader, and the
  // app shell.
  ON: 'on',

  // Tab and slide active marker.
  ACTIVE: 'active',

  // Loader fade-out marker (loader.js sets this when the dashboard renders).
  OUT: 'out',

  // Generic display:none utility (used by upload flow, filter selects, etc.).
  HIDDEN: 'hidden',

  // Saved-hand starred marker.
  STARRED: 'starred',
};
