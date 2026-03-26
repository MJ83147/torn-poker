# Monte Carlo Equity Calculator — Implementation Guide

## Overview

Add a Monte Carlo equity simulation to the hand replay modal in the Torn City poker dashboard. When a user views a hand from the log, they can click a "Run Equity Simulation" button. A loading spinner appears while the simulation runs, then the results replace the spinner showing equity at each street with contextual guidance comparing equity to the action taken and pot odds.

## Architecture

Create a single new file: `equity.js`. It is loaded via a `<script>` tag in the dashboard HTML, same as the other module files (stats.js, cards.js, etc.). It exports two things to the global scope:

1. `runEquitySimulation(hand)` — takes a hand object, returns a results object
2. UI wiring that adds a button to the hand replay modal

No external libraries. Pure vanilla JS. No changes to the Tampermonkey script.

---

## Hand Data Structure (for reference)

Each hand object in the app looks like this:

```js
{
  timestamp: 1773220506219,
  position: "SB",
  hole: ["7♦", "3♠"],          // Player's two hole cards, unicode suit symbols
  board: ["Q♠", "T♠", "4♣", "8♥", "2♦"],  // 0-5 community cards
  pot: 239062500,
  invested: 8750000,            // How much the player put in (may be absent on old data)
  outcome: {
    result: "won" | "lost" | "folded",
    amount: 239062500,          // What was returned (includes investment if won)
  },
  actions: [                    // Raw action log strings
    "   The preflop: Two cards dealt to each player",
    ">> Systoned: posted small blind $1,250,000",   // >> prefix = hero's action
    "   boris_sigma: posted big blind $2,500,000",
    "   Sdreka: raised $6,250,000 to $8,750,000",
    ">> Systoned: folded",
    "   The flop: : 9diamonds, Jclubs, 8diamonds",  // Street markers
    "   Sdreka: bet $15,937,500",
    // ...
  ],
  tableSize: 4,
  bigBlind: 2500000,
  tableId: "holdem25"
}
```

### Card format

Cards are strings like `"A♠"`, `"T♣"`, `"7♦"`, `"Q♥"`. The rank is everything before the suit symbol. Ranks are: `2 3 4 5 6 7 8 9 T J Q K A`. Note: some older data may have `"10"` instead of `"T"` — handle both.

### Action parsing

The existing `parseActions(hand.actions)` function in `helpers.js` returns an array of structured objects:

```js
{
  author: "Systoned",
  isMe: true,          // true if this is the hero's action
  street: "Preflop",   // "Preflop" | "Flop" | "Turn" | "River"
  type: "fold",        // "fold" | "check" | "call" | "raise" | "sb" | "bb" | "won"
  amount: 1250000,     // Dollar amount extracted from the action text
  msg: "posted small blind $1,250,000"
}
```

Use `parseActions()` to extract what the hero did on each street and how much they put in.

---

## Part 1: Poker Hand Evaluator

You need a function that takes a 5-card hand and returns a comparable numeric score. Higher score = better hand.

### Requirements

- Input: array of 5 card strings (e.g. `["A♠", "K♠", "Q♠", "J♠", "T♠"]`)
- Output: integer where higher = better hand
- Must correctly rank all standard poker hands: high card, pair, two pair, three of a kind, straight, flush, full house, four of a kind, straight flush, royal flush
- Must handle ace-low straights (A-2-3-4-5)

### Encoding scheme (suggested)

Use a hand rank category (0-8) shifted left, plus kickers for tiebreaking:

```
Score = (handRank * 10^10) + kicker values
```

Where handRank is:
- 0 = High card
- 1 = One pair
- 2 = Two pair
- 3 = Three of a kind
- 4 = Straight
- 5 = Flush
- 6 = Full house
- 7 = Four of a kind
- 8 = Straight flush (including royal flush)

### Best-of-seven evaluation

When evaluating a player's hand strength, they have 2 hole cards + up to 5 board cards. The best 5-card combination from all 7 cards must be found. Generate all C(7,5) = 21 combinations and evaluate each, returning the highest score.

For fewer than 7 total cards (e.g. on the flop with 5 cards total), generate C(5,5) = 1 or C(6,5) = 6 combinations accordingly.

---

## Part 2: Monte Carlo Simulation Engine

### Function signature

```js
function runEquitySimulation(hand)
```

### What it does

At each street where the hero was still in the hand, calculate the hero's equity against a single random opponent hand using the remaining deck.

### Street detection

Walk through the hand's board array to determine what the board looked like at each street:

- **Preflop**: board = [] (no community cards)
- **Flop**: board = first 3 cards
- **Turn**: board = first 4 cards
- **River**: board = all 5 cards

Only calculate equity for streets where the hero was still active. Use `parseActions(hand.actions)` to check: if the hero folded on a street, do not calculate equity for that street or any subsequent street.

### Algorithm per street

```
Given: heroHole (2 cards), knownBoard (0-5 cards)
Dead cards = heroHole + knownBoard
Remaining deck = full 52-card deck minus dead cards

Run N iterations (N = 10,000 for preflop/flop, 5,000 for turn, exact enumeration for river):
  1. Deal 2 random cards from remaining deck → opponentHole
  2. Deal random cards to complete the board to 5 → randomBoard
  3. Evaluate best 5-card hand for hero from (heroHole + fullBoard)
  4. Evaluate best 5-card hand for opponent from (opponentHole + fullBoard)
  5. Compare: hero wins / ties / loses

Equity = (wins + ties * 0.5) / N
```

**River special case**: On the river, all 5 board cards are known. The only unknown is the opponent's 2 cards. There are C(remaining, 2) combinations which is at most C(45, 2) = 990. Enumerate all of them exactly instead of using Monte Carlo. This gives a precise equity number.

**Turn**: C(remaining, 2) for opponent * remaining cards for river = doable with Monte Carlo at ~5000 iterations.

**Preflop**: Most variance. Use 10,000 iterations minimum.

### Performance notes

- This will run in the browser on potentially slow machines. Use a Web Worker if possible, but a synchronous loop with a loading spinner is acceptable for v1.
- The full 52-card deck can be generated from RANKS × SUITS where RANKS = `['2','3','4','5','6','7','8','9','T','J','Q','K','A']` and SUITS = `['♠','♥','♦','♣']`.
- Shuffle/random selection: use Fisher-Yates on remaining deck, take first N cards.
- Card comparison must handle the `"10"` vs `"T"` inconsistency. Normalise all cards to single-character ranks on input.

---

## Part 3: Pot Odds Calculation Per Street

For each street, calculate the pot odds the hero was getting on their action.

### Data needed per street

From `parseActions(hand.actions)`, extract for each street the hero participated in:

1. **Hero's action**: what they did (fold, check, call, raise)
2. **Amount to call**: if hero called, this is the call amount. If hero raised, this is the amount they put in. If hero checked, amount = 0.
3. **Pot before hero's action**: sum of all amounts put in by all players up to (but not including) the hero's action on that street.

### Pot odds formula

```
potOdds = amountToCall / (potBeforeAction + amountToCall)
```

This gives the minimum equity needed to break even on a call.

### Comparison to equity

For each street, compare:
- Hero's Monte Carlo equity at that street
- Pot odds they were getting (if they faced a bet)
- The action they took

---

## Part 4: Guidance Text

For each street, generate a plain-English assessment. The logic:

### If hero checked (no bet faced)
- Equity > 65%: "Strong hand. Betting for value would usually be correct here."
- Equity 40-65%: "Decent hand. A bet could protect your equity or extract thin value."
- Equity < 40%: "Weak hand. Checking is reasonable."

### If hero called a bet
- Calculate pot odds needed
- If equity > potOdds + 10%: "Clear call. Your equity significantly exceeded the price."
- If equity within 10% of potOdds: "Close spot. Your equity roughly matched the pot odds. On the flop and turn, implied odds may justify continuing."
- If equity < potOdds - 10%: "Unprofitable call. Your equity did not justify the price."

### If hero raised
- Equity > 55%: "Value raise. You had a strong hand and built the pot."
- Equity 35-55%: "Semi-bluff or thin value raise."
- Equity < 35%: "Bluff raise. Your hand was weak but raising applies pressure."

### If hero folded
- Equity > 40%: "You folded with significant equity. This may have been too tight unless the opponent's range was very strong."
- Equity 25-40%: "Marginal fold. Defensible depending on opponent tendencies."
- Equity < 25%: "Clean fold. Low equity against a random hand."

### Flop/turn caveat

On the flop and turn, append this note to any pot-odds comparison: "Note: this compares raw equity to pot odds. Implied odds (potential to win more on later streets) are not factored in and may justify calls that appear unprofitable by raw numbers alone."

---

## Part 5: UI Integration

### Button placement

Inside `showExampleHandModal()` in `app.js`, after the actions HTML and before the coaching note, add a button:

```html
<button class="example-hand-btn" id="mc-sim-btn">Run Equity Simulation</button>
```

Use the existing `example-hand-btn` CSS class for consistent styling.

### Only show the button when simulation is meaningful

The button should only appear when:
- `hand.hole` exists and has 2 cards (hero's cards are known)
- `hand.board` exists and has at least 3 cards (at least a flop was dealt), OR the hero went all-in preflop
- The hero did not fold preflop (there's at least one street worth simulating post-deal)

If the hero folded preflop and there's no board, there's nothing to simulate.

### Click handler flow

1. User clicks "Run Equity Simulation"
2. Replace button with a loading spinner (use a simple CSS spinner, consistent with the app's dark theme using `var(--gold)` and `var(--dim)` colours)
3. Run `runEquitySimulation(hand)`
4. Replace spinner with the results display

### Results display

Render a section below the hand actions showing each street as a row:

```
┌─────────────────────────────────────────────────┐
│  EQUITY SIMULATION (10,000 iterations)          │
├─────────────────────────────────────────────────┤
│  Preflop    72.3%   ██████████████░░░░░░  →  You raised. Strong hand, value raise.           │
│  Flop       58.1%   ███████████░░░░░░░░░  →  You called $15M. Needed 28% equity. Clear call. │
│  Turn       31.4%   ██████░░░░░░░░░░░░░░  →  You called $26M. Needed 33% equity. Close spot.  │
│  River      4.2%    █░░░░░░░░░░░░░░░░░░░  →  You called $79M. Needed 25% equity. Bad call.    │
└─────────────────────────────────────────────────┘
```

Design notes:
- Use the existing CSS variables: `var(--green)` for equity bars, `var(--bg2)` for track background, `var(--gold)` for labels, `var(--dim)` for secondary text
- Each street row: street name, equity %, a small horizontal bar, and the guidance text
- Colour-code the guidance: green for good decisions, amber/gold for marginal, red for leaks. Use `var(--green)`, `var(--gold)`, `var(--red)` respectively.
- Add the flop/turn implied odds caveat as a small note at the bottom in `var(--dim)` colour, `font-size: 9px`
- Show iteration count in the header so users understand this is a simulation, not exact math (except on the river where it IS exact — label that as "exact" instead of showing iteration count)

### Equity curve (optional nice-to-have)

Below the per-street rows, render a simple line connecting the equity values across streets. This can be a small inline SVG, nothing complex. Just dots at each street connected by lines, giving a visual sense of whether equity was climbing or declining through the hand. This is not required for v1 but would be a nice addition.

---

## Part 6: File Structure and Integration

### New file: `equity.js`

Place it alongside the other module files. It should contain:

1. The 5-card hand evaluator
2. The 7-card best-hand finder (C(7,5) combos)
3. The Monte Carlo simulation runner
4. The pot odds calculator
5. The guidance text generator
6. The UI wiring (button injection into the modal, click handler, results renderer)

### Wiring into the modal

The cleanest approach: after `showExampleHandModal()` builds and appends the modal, `equity.js` should hook into it. Two options:

**Option A (recommended)**: Modify `showExampleHandModal()` in `app.js` to call a function from equity.js. After `box.innerHTML = closeBtn + title + subtitle + metaHtml + actionsHtml + coaching;`, add:

```js
if (typeof injectEquityButton === 'function') {
  injectEquityButton(box, hand);
}
```

Then in `equity.js`, define `injectEquityButton(boxElement, hand)` which appends the button and wires the click handler.

**Option B**: Use a MutationObserver in equity.js to detect when the modal appears and inject the button. This avoids touching app.js but is more fragile.

Go with Option A.

### Script load order

In the HTML, load `equity.js` after `helpers.js` and `app.js`:

```html
<script src="helpers.js"></script>
<script src="app.js"></script>
<!-- ... other modules ... -->
<script src="equity.js"></script>
```

---

## Part 7: Edge Cases

1. **Missing hole cards**: If `hand.hole` is missing or incomplete, don't show the button.
2. **No board**: If the hand ended preflop (hero folded or everyone folded), only show preflop equity if the hero actually put money in voluntarily.
3. **10 vs T notation**: Normalise card ranks on input. If a card starts with "10", replace with "T". The existing `parseHoleKey()` function already handles this — follow the same pattern.
4. **Hands with no actions**: Skip entirely, don't show button.
5. **Board cards with text format**: Board cards from the TM script use the same unicode suit format as hole cards (`"Q♠"`, `"T♣"`). But action log lines contain text like `"9diamonds, Jclubs, 8diamonds"` — do NOT parse board cards from action text. Use `hand.board` directly.
6. **Split pots / ties**: The simulation should count ties as 0.5 wins, which is standard.
7. **Multiple opponents**: The simulation runs hero vs ONE random hand. This underestimates equity loss in multiway pots. Add a small note: "Equity calculated against a single random hand. In multiway pots, true equity may be lower."

---

## Summary of Changes

| File | Change |
|------|--------|
| `equity.js` | New file. Hand evaluator, Monte Carlo engine, pot odds calculator, guidance generator, UI wiring. |
| `app.js` | One line added inside `showExampleHandModal()`: call `injectEquityButton(box, hand)` after building the modal HTML. |
| HTML | One `<script src="equity.js"></script>` tag added. |

No other files need to change.