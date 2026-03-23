# Position Detection Fix

## Problem

Position assignment uses a fixed 8-element array lookup regardless of table size. This means:

- On tables smaller than 8, positions like CO, HJ never get assigned (e.g. a 5-player table only assigns BTN, SB, BB, UTG, UTG+1 — CO is missing)
- On 9-seat tables, the 9th seat overflows the array and falls back to "Active"

In standard poker, CO is always the seat directly before BTN. Positions fill inward from UTG as the table grows. The mapping must be dynamic based on player count.

Correct position assignments by table size (clockwise from dealer):

| Players | Positions |
|---------|-----------|
| 2 | BTN, BB |
| 3 | BTN, SB, BB |
| 4 | BTN, SB, BB, CO |
| 5 | BTN, SB, BB, UTG, CO |
| 6 | BTN, SB, BB, UTG, HJ, CO |
| 7 | BTN, SB, BB, UTG, MP, HJ, CO |
| 8 | BTN, SB, BB, UTG, UTG+1, MP, HJ, CO |
| 9 | BTN, SB, BB, UTG, UTG+1, MP, LJ, HJ, CO |

Note: in heads-up (2 players), the BTN is also the SB. The existing early-return for `isSmallBlind` will fire first and return 'SB'. This is acceptable.

---

## Part 1: TM Script (tc-poker-export.user.js)

### File: `tamper2` (the TM userscript)

### What to change

Replace the `getPosition` function. The current code is at approximately lines 61-74.

**Current code to find and replace:**

```js
function getPosition(players) {
    const list = Object.values(players || {});
    const me   = list.find(function (p) { return String(p.userID) === MY_USER_ID; });
    if (!me) return '';
    if (me.isBigBlind)   return 'BB';
    if (me.isSmallBlind) return 'SB';
    if (me.isDealer)     return 'BTN';
    var sorted = list.slice().sort(function (a, b) { return a.place - b.place; });
    var di = sorted.findIndex(function (p) { return p.isDealer; });
    var mi = sorted.findIndex(function (p) { return String(p.userID) === MY_USER_ID; });
    if (di === -1 || mi === -1) return 'Active';
    var rel = (mi - di + sorted.length) % sorted.length;
    return ['BTN', 'SB', 'BB', 'UTG', 'UTG+1', 'MP', 'HJ', 'CO'][rel] || 'Active';
  }
```

**Replace with:**

```js
function getPosition(players) {
    const list = Object.values(players || {});
    const me   = list.find(function (p) { return String(p.userID) === MY_USER_ID; });
    if (!me) return '';
    if (me.isBigBlind)   return 'BB';
    if (me.isSmallBlind) return 'SB';
    if (me.isDealer)     return 'BTN';
    var sorted = list.slice().sort(function (a, b) { return a.place - b.place; });
    var di = sorted.findIndex(function (p) { return p.isDealer; });
    var mi = sorted.findIndex(function (p) { return String(p.userID) === MY_USER_ID; });
    if (di === -1 || mi === -1) return 'Active';
    var rel = (mi - di + sorted.length) % sorted.length;
    var posMap = {
      2: ['BTN','BB'],
      3: ['BTN','SB','BB'],
      4: ['BTN','SB','BB','CO'],
      5: ['BTN','SB','BB','UTG','CO'],
      6: ['BTN','SB','BB','UTG','HJ','CO'],
      7: ['BTN','SB','BB','UTG','MP','HJ','CO'],
      8: ['BTN','SB','BB','UTG','UTG+1','MP','HJ','CO'],
      9: ['BTN','SB','BB','UTG','UTG+1','MP','LJ','HJ','CO']
    };
    var positions = posMap[sorted.length] || posMap[9];
    return positions[rel] || 'Active';
  }
```

**What changed:** The single fixed array `['BTN', 'SB', 'BB', 'UTG', 'UTG+1', 'MP', 'HJ', 'CO']` is replaced by a lookup object `posMap` keyed by table size (`sorted.length`). The `rel` calculation is unchanged. If the table size doesn't match any key (shouldn't happen, but safety), it falls back to the 9-player map.

---

## Part 2: Dashboard Migration (retroactive fix for existing hands)

Existing hands already have a `position` string baked into the JSON. The TM fix only applies to new hands. To fix historical data, we need a migration function in the dashboard that re-derives position from the `actions` array stored in each hand.

### How it works

Each hand's `actions` array contains lines like:
```
"   Wardyward: posted small blind $500,000"
">> Systoned: posted big blind $1,000,000"
"   Dadmacia: raised $2,000,000 to $3,000,000"
">> Systoned: folded"
```

From these we can reconstruct:
1. **SB player** — the name on the `posted small blind` line
2. **BB player** — the name on the `posted big blind` line
3. **Preflop action order** — all unique player names in order of first appearance (before the flop)
4. **BTN player** — in preflop action, after blinds post, players act UTG through BTN. So BTN is the last non-blind player to act (the last entry in the non-blind list)
5. **Our name** — any line prefixed with `>>` is us
6. **Table size** — count of unique players

Once we know the seat order (BTN, SB, BB, UTG, ... , CO), we look up our index in that order and map it to a position label using the same `posMap` table as above.

### File: `helpers.js`

Add this function at the end of `helpers.js` (before the final blank line, after `detectPlayerFromActions`):

```js
// Re-derive position for all hands from action data.
// Fixes historical hands that were assigned positions using the old
// fixed-array lookup which didn't account for table size.
function migratePositions(hands, playerName) {
  var posMap = {
    2: ['BTN','BB'],
    3: ['BTN','SB','BB'],
    4: ['BTN','SB','BB','CO'],
    5: ['BTN','SB','BB','UTG','CO'],
    6: ['BTN','SB','BB','UTG','HJ','CO'],
    7: ['BTN','SB','BB','UTG','MP','HJ','CO'],
    8: ['BTN','SB','BB','UTG','UTG+1','MP','HJ','CO'],
    9: ['BTN','SB','BB','UTG','UTG+1','MP','LJ','HJ','CO'],
  };

  for (var i = 0; i < hands.length; i++) {
    var h = hands[i];
    var actions = h.actions || [];
    var sbPlayer = null;
    var bbPlayer = null;
    var myName = null;
    var allPlayers = [];

    for (var j = 0; j < actions.length; j++) {
      var raw = actions[j];
      var isMe = raw.indexOf('>>') === 0;
      var line = raw.replace(/^>>\s*/, '').replace(/^\s+/, '').trim();

      // Stop at the flop — we only need preflop actions
      if (line.startsWith('The flop') || line.startsWith('The turn') || line.startsWith('The river')) break;
      if (line.startsWith('The preflop')) continue;

      var ci = line.indexOf(': ');
      if (ci === -1) continue;
      var author = line.slice(0, ci);
      var msg = line.slice(ci + 2);

      if (isMe) myName = author;

      if (msg.startsWith('posted small blind')) sbPlayer = author;
      else if (msg.startsWith('posted big blind')) bbPlayer = author;

      // Track unique players in order of first appearance
      if (allPlayers.indexOf(author) === -1) allPlayers.push(author);
    }

    // Fall back to the passed-in player name if >> prefix wasn't found
    // (e.g. player folded and had no action lines with >> in some edge case)
    if (!myName && playerName) myName = playerName;

    // Skip hands where we can't identify blinds or ourselves
    if (!myName || !sbPlayer || !bbPlayer) continue;

    // Build the non-blind players list (in preflop action order = UTG through BTN)
    var others = [];
    for (var k = 0; k < allPlayers.length; k++) {
      if (allPlayers[k] !== sbPlayer && allPlayers[k] !== bbPlayer) {
        others.push(allPlayers[k]);
      }
    }

    // Preflop action order for non-blinds is: UTG, UTG+1, ..., CO, BTN
    // So BTN is the LAST entry in 'others'.
    // In HU (2 players), others is empty because both players are SB and BB.
    // In that case BTN = SB (which is correct for heads-up).
    var btnPlayer = others.length > 0 ? others[others.length - 1] : sbPlayer;

    // Seat order from BTN clockwise: BTN, SB, BB, UTG, ..., CO
    var seatOrder = [btnPlayer, sbPlayer, bbPlayer];
    for (var k = 0; k < others.length - 1; k++) {
      seatOrder.push(others[k]);
    }

    var n = seatOrder.length;
    var positions = posMap[n] || posMap[9];
    var myIdx = seatOrder.indexOf(myName);
    if (myIdx === -1) continue;

    h.position = positions[myIdx] || h.position;
  }
}
```

### File: `app.js`

Call `migratePositions` inside `setSession`, before hands are stored. This ensures every hand (both fresh imports and restored sessions) gets corrected.

**Current code (approximately line 8):**

```js
function setSession(hands, meta) {
  _allHands = hands.filter(h => inferTable(h) !== null);
  _meta = meta;
}
```

**Replace with:**

```js
function setSession(hands, meta) {
  migratePositions(hands, meta.player || '');
  _allHands = hands.filter(h => inferTable(h) !== null);
  _meta = meta;
}
```

**What changed:** One line added. `migratePositions` mutates `h.position` on each hand in-place before the hands are filtered and stored. It uses `meta.player` as a fallback player name in case `>>` prefix detection fails on any individual hand. This runs on every load/import, so it's idempotent (running it twice produces the same result).

### Script load order

`helpers.js` must be loaded before `app.js` (it already is in the current `index.html`). No changes needed to load order.

---

## Edge cases handled

- **Heads-up (2 players):** BTN/SB is the same seat. The `others` array is empty, so `btnPlayer` falls back to `sbPlayer`. Seat order is `[sbPlayer, bbPlayer]` = 2 players, maps to `['BTN', 'BB']`.
- **Dead blind / late post:** Lines like `posted $1,000,000` (without "small blind" or "big blind") are not matched by the SB/BB detection. These players still appear in `allPlayers` via their other actions. They won't corrupt the blind detection.
- **9-seat tables:** The new map has an explicit 9-player entry including LJ. No more overflow to "Active".
- **Player folds immediately:** They still appear in the action sequence at their correct position (e.g. `>> Systoned: folded` appears after BB post and before the next player acts).
- **Hands with missing data:** If SB, BB, or player name can't be identified, the hand is skipped and its existing position is preserved unchanged.

---

## Testing

After implementing, verify with these checks:

1. **5-player hand:** Should show BTN, SB, BB, UTG, CO (no UTG+1 or MP)
2. **6-player hand:** Should show BTN, SB, BB, UTG, HJ, CO
3. **8-player hand:** Should show BTN, SB, BB, UTG, UTG+1, MP, HJ, CO (same as before for 8-player)
4. **9-player hand:** Should show LJ between MP and HJ, no "Active" fallback
5. **Position stats table in dashboard:** CO column should now have hands populated for 5+ player tables
6. **Existing data:** Re-import old JSON export and confirm positions have been corrected