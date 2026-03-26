# Equity Simulation Bug Fix Guide

This document describes three bugs in the equity simulation feature of a Torn City poker analysis dashboard. The relevant files are `helpers.js` and `equirty.js`. All three bugs should be fixed in order.

---

## Context

The dashboard is a single-file HTML poker analysis tool. Hand data is captured via a Tampermonkey userscript and exported as JSON. The equity simulation runs a Monte Carlo analysis against a random opponent hand at each street the hero participated in, then displays per-street equity percentages alongside coaching commentary about the hero's action.

The simulation engine itself (card evaluator, monte carlo sampling, deck management) is correct. The bugs are all in how the results are interpreted and narrated.

---

## Bug 1: Bets and raises are collapsed into a single action type

### Location

`helpers.js`, function `parseActions`, approximately line 209.

### Current code

```js
else if (msg.startsWith('raised') || msg.startsWith('bet')) type = 'raise';
```

### Problem

Both "bet" and "raised" action lines are assigned `type = 'raise'`. These are different poker actions. A bet is an opening wager when no one has bet on the current street. A raise is an increase over an existing bet. The equity simulation's guidance function (`generateGuidance` in `equirty.js`) uses the action type to select coaching text. When a player bets, the output incorrectly says things like "You raised $500K" and "Value raise. You had a strong hand and built the pot" when the player actually opened with a bet.

### Fix

Split into two distinct types:

```js
else if (msg.startsWith('raised')) type = 'raise';
else if (msg.startsWith('bet')) type = 'bet';
```

### Downstream changes required

After this fix, `type = 'bet'` will be a new action type flowing through the system. The following places must handle it:

1. **`equirty.js`, function `generateGuidance`** (around line 269): Add a `bet` branch. The coaching logic for a bet should be similar to raise but with different wording. Suggested approach:
   - If equity > 55: "Value bet. You had a strong hand and extracted value."
   - If equity >= 35: "Thin value bet or semi-bluff. Reasonable with moderate equity."
   - If equity < 35: "Bluff bet. Your hand was weak but betting applies pressure."

2. **`equirty.js`, function `runEquitySimulation`** (around line 334-342): The `actionDesc` builder needs a case for `bet`:
   ```js
   else if (a.type === 'bet') actionDesc = 'You bet ' + fmtDollar(a.amount) + '.';
   ```

3. **`equirty.js`, function `getHeroStreetActions`** (around line 248-253): The `amountToCall` calculation currently treats raise amounts as the call price. For bets, the same logic applies (the hero is putting money in), so `bet` should be handled identically to `raise` here:
   ```js
   if (heroAction.type === 'call') {
     amountToCall = heroAction.amount;
   } else if (heroAction.type === 'raise' || heroAction.type === 'bet') {
     amountToCall = heroAction.amount;
   }
   ```

4. **Other consumers of `parseActions` elsewhere in the codebase**: Many stat calculations use `type === 'raise'` to count aggressive actions. A full search for `'raise'` across the codebase is needed. In most analytical contexts (aggression stats, post-flop raise counts, etc.), bets and raises should both count as aggressive actions. The safest approach is: wherever the code currently checks `a.type === 'raise'`, change it to `(a.type === 'raise' || a.type === 'bet')`. Key locations likely include:
   - `stats.js` / `analyse()`: raise counters, aggression calculations
   - `app.js`: any insight card filters that look for raises
   - The TM export script (if it uses parseActions): check `postRaises`, `postBets` counters

   **Important**: The TM export script (`tc-poker-export.user.js`) already distinguishes bets from raises in its own parsing. It has separate `postBets` and `postRaises` counters. This change brings the dashboard's `parseActions` into alignment with what the TM script already does. Do not break the TM script's existing distinction.

---

## Bug 2: Only the first hero action per street is captured

### Location

`equirty.js`, function `getHeroStreetActions`, around lines 222-236.

### Current code

```js
for (var ai = 0; ai < acts.length; ai++) {
  var a = acts[ai];
  if (a.isMe && !heroAction && a.type !== 'won') {
    if (a.type !== 'sb' && a.type !== 'bb') {
      heroAction = a;
      potAtHeroAction = potRunning;
    }
  }
  // ...
}
```

The condition `!heroAction` means once the first hero action is found, all subsequent hero actions on that street are ignored.

### Problem

In many hands, the hero acts multiple times on the same street. For example on the river: check, then face a bet, then fold. The current code captures the check but never sees the fold. This means:

- The coaching says "You checked. Strong hand. Betting for value would usually be correct here." when the hero actually check-folded.
- The fold is never evaluated against the hero's equity, so the guidance never flags potentially bad folds.
- Pot odds are calculated at the wrong moment (at the check, when there's nothing to call, rather than at the fold decision point).

### Fix

Track the **last significant** hero action on each street, not the first. "Significant" means: if the hero folded, use the fold. If the hero called or raised, use that. Only use a check if the hero's only action was checking.

Replace the hero action selection logic with:

```js
var allHeroActions = [];
for (var ai = 0; ai < acts.length; ai++) {
  var a = acts[ai];
  if (a.isMe && a.type !== 'won' && a.type !== 'sb' && a.type !== 'bb') {
    allHeroActions.push({ action: a, potAtAction: potRunning });
  }
  if (a.amount && a.type !== 'won') {
    potRunning += a.amount;
  }
  if (a.isMe && a.type === 'fold') {
    heroFoldedOn = st;
  }
}

// Pick the most significant action: fold > call/raise/bet > check
if (allHeroActions.length > 0) {
  // Default to last action
  var picked = allHeroActions[allHeroActions.length - 1];

  // But if any action is a fold, that's the defining action
  for (var hi = 0; hi < allHeroActions.length; hi++) {
    if (allHeroActions[hi].action.type === 'fold') {
      picked = allHeroActions[hi];
      break;
    }
  }

  heroAction = picked.action;
  potAtHeroAction = picked.potAtAction;
}
```

**Important**: The pot tracking (`potRunning += a.amount`) must still iterate over ALL actions (not just hero actions) because opponent bets contribute to the pot. The current code interleaves pot tracking with hero action detection. When refactoring, make sure pot accumulation still processes every action in order, and `potAtHeroAction` is captured at the moment the selected hero action occurred (before the hero's own contribution).

Also: the blind fallback logic (lines 238-246) should remain as-is. It only activates when no non-blind hero action was found.

### Pot odds recalculation

With this fix, when the hero check-folds, the pot odds will be calculated at the fold decision point. The `amountToCall` for a fold is 0 (the hero chose not to call), but the pot odds display should still show what the hero would have needed. Currently the code sets `amountToCall = 0` for folds (implicitly, since it only sets it for calls and raises). This is fine for the equity display, but the `potOddsStr` will show "Needed 0% equity" which is meaningless.

To fix this: when the hero folds, look at what they were facing. The bet they declined to call is the action immediately before the fold in the street's action list. Capture that amount:

```js
if (heroAction.type === 'fold') {
  // Find the bet/raise the hero was facing
  for (var fi = allHeroActions.length - 1; fi >= 0; fi--) {
    // Actually need to look at ALL actions, not just hero actions
  }
}
```

A simpler approach: scan backwards from the fold in the full action list for the last non-hero bet/raise, and use that amount as `amountToCall`. This lets the pot odds display say something like "Needed 28% equity" on fold lines, which gives meaningful coaching ("You folded with 40% equity when you only needed 28%").

---

## Bug 3: Guidance text doesn't account for bet as a distinct action

### Location

`equirty.js`, function `generateGuidance`, around lines 269-298.

### Current code

The function has branches for: `sb`, `bb`, `check`, `call`, `raise`, `fold`. There is no `bet` branch.

### Problem

After Bug 1 is fixed, any action line starting with "bet" will have `type = 'bet'`. The `generateGuidance` function will fall through all branches and return empty text and `'neutral'` quality.

### Fix

Add a `bet` branch after the `raise` branch (or combine with raise using appropriate wording):

```js
else if (act.type === 'bet') {
  if (eq > 55) { text = 'Value bet. Strong hand, extracting value.'; quality = 'good'; }
  else if (eq >= 35) { text = 'Thin value or semi-bluff. Reasonable with this equity.'; quality = 'neutral'; }
  else { text = 'Bluff bet. Weak hand, but betting puts pressure on opponents.'; quality = 'neutral'; }
}
```

The thresholds can mirror the raise thresholds. The key difference is the wording: "bet" not "raise."

---

## Testing

After all three fixes, verify against this hand (the one that surfaced the bugs):

**Hand details:**
- Hero: SB position
- Board: 4♦ 5♥ 3♥ J♦ Q♠
- Pot: $141.8M
- Result: folded

**Action sequence:**
- Preflop: Hero posted SB, then called $1.25M (4-way to flop)
- Flop (4♦ 5♥ 3♥): Hero checked, then called $8M raise
- Turn (J♦): Hero **bet** $500K, then called $31.5M raise
- River (Q♠): Hero checked, then **folded** to $47.25M bet

**Expected output after fixes:**

1. **Turn action** should say "You bet $500K" (not "You raised $500K") and guidance should use bet-specific wording.

2. **River action** should say "You folded" (not "You checked") and guidance should evaluate the fold against equity. With ~90% equity against a random hand, the guidance should flag this as a potentially loose fold (though the caveat about multiway pots and actual opponent ranges applies).

3. No guidance text should be blank or missing for any street.

---

## What this guide does NOT cover

The equity simulation calculates against a **single random opponent hand**. In multiway pots (like the example hand which was 3-4 way), the true equity is lower. The existing caveat text at the bottom of the simulation output mentions this. Improving the simulation to account for multiple opponents is a separate, larger piece of work and is explicitly out of scope for these fixes.