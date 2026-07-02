# TC Poker Tracker — data structures & flow

How a hand goes from the Torn poker table into the analysis app, and the shape
of the data at every step. Companion to `tc-poker-tracker.user.js`.

---

## 1. The pipeline at a glance

```
   Torn Hold'em page (torn.com, ?sid=holdem)
            │  WebSocket frames (Centrifugo push envelopes)
            ▼
   ┌─────────────────────────────────────────────┐
   │  tc-poker-tracker.user.js  (Tampermonkey)    │
   │                                              │
   │  inspectWsData()      ← reads every WS frame │
   │    ├─ personal getState  → hole cards + token│
   │    └─ public  frames     → table state       │
   │  reconstructHand()    ← builds a v2 hand     │
   │  IndexedDB  "tcp_data_export" / store "hands"│
   └─────────────────────────────────────────────┘
            │  Copy to clipboard  /  Export file
            ▼
   ┌─────────────────────────────────────────────┐
   │  poker.systoned.cc  (the app)                │
   │  process()/bootSession() → state.storeHands  │
   │  analysis, insights, range, players, …       │
   └─────────────────────────────────────────────┘
```

Everything happens **locally in the browser**. Nothing is uploaded by the
tracker; the only "send" is you copying/exporting the dataset into the app.

---

## 2. Source: Torn's WebSocket

All poker data arrives on the page's WebSocket. The tracker patches the
`WebSocket.prototype` (`addEventListener` + the `onmessage` setter) read-only and
inspects each incoming frame. It never patches `fetch`/XHR — there is nothing it
needs there.

A frame is a JSON push envelope; the tracker unwraps it to a **channel** and a
**message**:

```
{ push: { channel: "holdem71", pub: { data: { message: { …the message… } } } } }
```

### Channels

| Channel                  | Meaning                          | Used for                          |
|--------------------------|----------------------------------|-----------------------------------|
| `holdem<N>`              | public table channel             | full table state, every action    |
| `holdem<N>#<userID>`     | **your** personal channel        | **your hole cards** + hand token  |
| `holdemlobby`            | lobby snapshot (all tables)      | clone→parent table map only       |

`<N>` is the table id; `<userID>` in the personal channel **is you** — that is
how the tracker learns `heroUserID` (no hardcoding).

> **Scope guarantee.** The tracker only ever processes frames for the **one
> table you are viewing/playing**, and it never stores the `chatLog`. The lobby
> frame is used solely to learn the clone→base table mapping, then discarded.

### Message types (eventType)

| eventType         | Channel        | Shape (key fields)                                                                 |
|-------------------|----------------|-----------------------------------------------------------------------------------|
| `getState`        | personal       | `{ eventType, hand: ["diamonds-6","spades-Q"], token }`                            |
| `getState`        | public         | full snapshot: `players{}`, `communityCards`, `dealer`, `turn`, `bigBlind`, `token`, `chatLog[]` |
| `playerMakeMove`  | public         | per-action delta: `gameStatus`, `players{}`, `communityCards`, `turn`, `userAction`, `token`, `totalPot`, `bigBlind` |
| `updatePlayer`    | public         | single-seat update `{ player: { "<seat>": {…} } }` — ignored by the reconstructor  |
| `removePlayer`    | public         | `{ player: [<seat>] }` — a player left — ignored                                   |

### The `token` ties a hand together

Every frame of one hand shares a `token` (e.g.
`"3718f4f99a64575eb20998794a4ebb"`). The personal `getState` (your hole cards)
and the public action frames carry the **same** token, so the tracker keys its
live buffers by token. When a hand ends and the next deal begins, a new token
appears.

### Card encoding

Torn sends cards as **`suitword-rank`**: `"diamonds-6"`, `"spades-10"`,
`"spades-Q"`, `"hearts-7"`. The tracker converts to the app's
**`rank+suit-letter`** form: `6d`, `Ts`, `Qs`, `7h` (`10`→`T`). Conversion lives
in `cardToApp()`.

### Per-player frame fields (the ones that matter)

Inside `players` (keyed by seat number) each player carries:

```
userID, playername, status, place, money, pot, totalPot, lastRoundPot,
isDealer, isSmallBlind, isBigBlind, isSitOut, winnings, hand[], handName,
bestCombination[], …
```

- `money` = chips **behind** (hand-global; only drops when the player commits).
- `pot`   = chips committed **this betting round** (resets each street).
- `place` = seating order around the table.
- `winnings` = chips won (on the ended frame).
- `hand`  = revealed hole cards — populated only at showdown / when shown.
- `isSitOut` / `status: "Sitting out"` = dealt **out** of this hand.

---

## 3. Reconstruction — frames → one structured hand

`reconstructHand(buf)` turns a buffer of frames into a v2 hand. The rules, each
validated against real captures:

- **Hole cards** come from the personal `getState` (`buf.hole`).
- **Actor of a move** = the **previous** frame's `turn` (the current frame's
  `turn` points at who acts *next*).
- **Street of a move** = the **previous** frame's board length
  (`0→Preflop, 3→Flop, 4→Turn, 5→River`). The frame that first shows a new board
  is produced by the action that *closed* the prior street, so the previous
  board is the correct street for that action.
- **Action amount** = the drop in the actor's `money` since we last saw them
  (falls back to their round `pot` for the opening action). `raiseTo` for a
  bet/raise = the actor's round `pot`.
- **Blinds** are emitted at the first frame from the `isSmallBlind`/`isBigBlind`
  flags, using each blind's `pot` as the amount.
- **Board** = the **longest** `communityCards` seen across the hand. (The `ended`
  frame resets `communityCards` to `[]`, so we never shrink the board.)
- **Per-player stacks**: `startStack` = `money + pot` the first frame we see a
  seat (their full stack); `invested` accrues every later `money` drop;
  `endStack` = `money` on the last frame.
- **Outcome**: hero `winnings > 0` → `won`; else folded (status Folded, no
  reveal) → `folded`; else `lost`.
- **Showdown** = at least **two** players show non-empty `hand[]` on the ended
  frame.
- **Sitting-out players are excluded** from position and table size.

### Two subtleties worth remembering

- **The ended frame's `money` already includes winnings.** So `endStack` is the
  correct *post-payout* stack, and `invested` (computed from drops only, ignoring
  the payout jump) stays correct for the winner.
- **Partial hands are dropped.** If the first captured frame already shows a
  board, we joined mid-hand; `_partial: true` and `persistHand()` skips it.

---

## 4. The v2 hand object (what gets stored & exported)

```jsonc
{
  "timestamp": 1782856881000,      // capture time, epoch ms
  "heroUserID": 3583736,
  "position": "BB",                // BTN/SB/BB/UTG/UTG+1/MP/LJ/HJ/CO (blinds+button exact; middle seats approximate)
  "hole": ["6d", "Qs"],
  "board": ["7h", "Jd", "Ac", "7d", "5d"],
  "pot": 22500000,                 // final total pot
  "invested": 2500000,             // hero chips committed this hand
  "outcome": { "result": "won|lost|folded", "amount": 22500000 },  // amount = gross chips won (0 otherwise)
  "showdown": false,
  "tableSize": 7,                  // players dealt in (sit-outs excluded)
  "bigBlind": 250000,
  "tableId": 71,                   // raw channel id (may be an overflow clone)
  "table": "Table 71",
  "actions": [ /* see below */ ],
  "startStack": 92600518,          // hero — feeds the app's effective-stack maths
  "endStack": 90100518,            // hero — post-payout
  "stacks":  [ /* per-player, see below */ ],

  "_v2": true,
  "_live": true,                   // captured live (vs _legacy from the old import)
  "_partial": false,
  "_raw": { "hole": [...], "frames": [...], "frameTimes": [...] }   // local only — stripped on export
}
```

### `actions[]` entries

```jsonc
{
  "author": "Systoned",
  "isMe": true,
  "street": "Preflop|Flop|Turn|River",
  "type": "sb|bb|fold|check|call|bet|raise",
  "amount": 1750000,               // chips committed by this action (0 for fold/check)
  "raiseTo": 750000,               // total round commitment for bet/raise, else null
  "allIn": false,
  "actedMs": 8200                  // ms the actor took (gap between frames); null for the first action
}
```

### `stacks[]` entries (the new per-player capture)

```jsonc
{
  "userID": 4163466,
  "name": "M-A-D_22_O-N-E",
  "startStack": 41249270,
  "endStack": 48874270,            // post-payout
  "invested": 14875000,
  "profit": 7625000,               // winnings - invested
  "winnings": 22500000,
  "position": "BTN",
  "status": "Bet",
  "isDealer": true, "isSmallBlind": false, "isBigBlind": false,
  "revealed": ["2s", "2c"],        // [] unless they showed at the end
  "handName": "Four of a kind Twos",
  "isHero": false
}
```

`hero.startStack`/`endStack` are also lifted to the top-level hand fields because
the app's `estimateEffStackBB()` reads `hand.startStack` directly.

---

## 5. The `_raw` block & "never migrate again"

Each live hand keeps `_raw = { hole, frames, frameTimes }` — the structured
player frames (with `chatLog` stripped), scoped to your own hand at the table you
were playing. This is the anti-migration insurance:

- **Import once.** The legacy text history (`tc_poker_tm`) is converted a single
  time, guarded by the `tcp_data_export_history_imported` flag.
- **From then on, never re-migrate.** Improve the extractor → re-export. At
  export time `rederiveHand()` re-runs the *current* `reconstructHand()` over
  each hand's `_raw`, so every retained hand is upgraded — no replay, no
  re-import. Hands without `_raw` pass through unchanged.

`_raw` lives only in IndexedDB. It is **stripped on export** (`stripForExport()`)
so the clipboard/file payload stays small.

---

## 6. Storage (IndexedDB & localStorage)

| Name                                    | Kind        | Purpose                                            |
|-----------------------------------------|-------------|----------------------------------------------------|
| DB `tcp_data_export`, store `hands`     | IndexedDB   | our hand store (autoIncrement, no inline keys)     |
| DB `tc_poker_tm`                        | IndexedDB   | legacy v4.9 capture — **read-only**, imported once |
| `tcp_data_export_history_imported`      | localStorage| set after the one-time legacy import               |
| `tcp_table_parents`                     | localStorage| learned clone→base table map (`{ "71": 10 }`)      |
| `tcp_purged_foreign`                    | localStorage| set after one-time cleanup of hands without 2 hole cards |

---

## 7. Export envelope → app import

`syncToApp()` / `exportData()` wrap the (re-derived, `_raw`-stripped) hands:

```jsonc
{ "schemaVersion": 2, "player": "Systoned", "exportedAt": "2026-…Z", "hands": [ … ] }
```

On the app side (`app.js` → `state.storeHands`):

- **`schemaVersion >= 2`** → the payload is the source of truth; the store is
  wiped and replaced (no append/dedup).
- **Import filter:** only hands with `hole.length === 2` are kept. A hand whose
  cards are unknown can't be analysed.
- **Table inference** (`inferTable` in `js/helpers/analysis.js`): tries
  `tableId`, then `table`, then `bigBlind` via `BB_TO_TABLES`. Overflow clones
  (e.g. `tableId 71`, not in `TABLE_META`) still resolve — `bigBlind 250000` is
  unique to table 10 "Pound It". Opening the lobby once also teaches the tracker
  `71 → 10` directly.
- **Effective stack** (`estimateEffStackBB`): uses `hand.startStack`; if absent,
  falls back to an action-based estimate.

---

## 8. Data fidelity — full vs basic

Not every hand carries the new fields.

| Bucket                                   | Has stacks / start-end / timing / `_raw`? |
|------------------------------------------|-------------------------------------------|
| Hands captured by this tracker (live)    | **Yes** — full, and re-derivable          |
| Legacy `tc_poker_tm` import (`_legacy`)  | **No** — text source never had stacks     |
| Hands from an older install w/o `_raw`   | **No** — raw frames were never captured    |

Older hands are **not** dropped or degraded — they remain fully usable for every
existing feature (P&L, position, ranges, outcomes, replay). They simply can't be
back-filled: the source data never existed.

> **Rule for any stack/timing feature: missing = "unknown", not zero.** Include
> only hands where the field is actually present, e.g.
> `hands.filter(h => h.stacks && h.stacks.length)` or `h.startStack != null`.
> Coercing missing → 0 skews aggregates. Hands are tagged (`_live` / `_legacy`,
> and the presence of `stacks`/`startStack`) so this filtering is clean.

---

## 9. Privacy & scope (by construction)

- **Local only.** Capture and storage are in your browser; the tracker uploads
  nothing.
- **Current table only.** Frames are processed for the one table you're at.
- **No chat.** The `chatLog` is stripped from every retained frame; reconstruction
  uses only the structured player state.
- **Read-only on the wire.** WebSocket frames are inspected, never altered; the
  legacy DB is opened read-only.
```
