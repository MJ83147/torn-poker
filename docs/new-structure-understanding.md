# Understanding the New Structure

A plain-English read of [js/new structure.md](../js/new%20structure.md). Written to be scannable. Source of truth is the spec itself; this is my reading of it.

---

## TL;DR

The framework rebuilds the analysis engine on a three-layer hierarchy:

**DAUs → Metrics → Insights → Stories.**

Every decision a player makes at the table becomes one atomic record (a DAU). Many DAUs aggregate into metrics (VPIP, c-bet %, fold to raise). Each metric, interpreted through context (position, seat count, hand type, board texture, P&L), produces an insight. Insights always fire — the question is what they say, not whether they speak. Stories group related insights into a narrative with a title, an impact statement, and one so-what conclusion. A story only displays if it has something meaningful to say.

The output is divided into ten sections, each with named stories, totalling roughly thirty stories across the app.

---

## The three layers

### DAU — Decision, Action, Outcome

The atomic unit. One DAU per decision point per player per street.

A DAU carries:
- **Decision** — what the player had to choose between. Not stored because it's deterministic from the game state.
- **Action** — call, raise, fold, check, bet.
- **Outcome** — what resulted.

Context fields on every DAU:
- `street` — Preflop / Flop / Turn / River
- `position` — UTG / MP / CO / BTN / SB / BB
- `pot_size` — running pot at the moment of decision, derived by walking the actions array
- `player_id` — who is acting; hero identified by `>>` prefix in raw data
- `hand_id`
- `session_id`

The spec also lists `stack_depth`, but our raw data doesn't carry it. Stories that depend on stack depth (e.g. SB cold-call vs 3-bet against short stacks) drop that dimension or skip the relevant pillar.

DAUs are emitted for **all players**, not just hero, because opponent analysis needs the same shape.

### Metrics

Aggregations of DAUs. No single DAU is a VPIP; many DAUs across many hands are. Every metric is the same pattern: filter DAUs by some combination of street, position, action, and outcome, then aggregate.

Current coverage already includes VPIP / PFR / limp, aggression factor, per-street action breakdowns, c-bet / delay c-bet / donk frequencies, fold-to-cbet / 3-bet / 4-bet, WTSD / WSD, all-in metrics, P&L by position and hand type, bet sizing distributions, and win rate by position.

**Bucketing.** A `bucketizeAnalysis()` pass runs a full analyse() per bucket: by seat count, by flop texture, by position, and by position × seat count (the most granular cross-cut).

**Sample-size gates.**
- `MIN_AGGREGATE` = 30 hands — gate for the top-level analysis.
- `MIN_AXIS` = 20 hands — gate for single-axis slices (position, seat count).
- `MIN_CELL` = 10 hands — gate for cross-axis cells (position × seat count).

Slices below the gate are computed but flagged and excluded from story output.

### Insights

An insight is a question answered by one or more metrics, interpreted through context. It is a conclusion derived from a stack of evidence, not a single number.

**Insights always fire.** The question is not whether an insight has something to say but what it says. A metric inside its band still produces an insight; the character of the statement changes, not whether it happens.

**Four-clause structure:**
1. **Aggregate.** Plain statement of the number. No target, no judgment.
2. **Implication.** What does this number mean in terms of how opponents can play against this player?
3. **Context.** Where is this most notable — position, seat count, hand type, board texture? The target band is introduced *here*, at the level where context is sufficient to make it meaningful.
4. **Outcome gap.** Optional. Only present if the data supports a meaningful difference in win rate or P&L between on-target and off-target conditions.

The "so what" is **not** part of the insight. It belongs to the story.

**Insight types.**
- **Target-based** — a defined band exists. The insight evaluates the player against it and states the gap. VPIP by position, c-bet frequency, fold to 3-bet.
- **Directional** — no target band. Behaviour is only meaningful in combination with outcomes. High check-fold with losses is a leak; high check-fold with neutral outcomes is the player getting away from bad spots cheaply. Check-fold, donk bet, delay c-bet.

**Targets are context-dependent.** A VPIP of 30% means different things at heads-up vs 6-max vs full ring. Targets are never stated at aggregate level; they are introduced at the level where context is sufficient. The same metric is evaluated against a different band for every position × seat count combination.

**Findings are grouped.** "You play too wide from early position in 6-max, driven by weak aces" is one observation, not three. The engine evaluates dimensions sequentially but groups output into single coherent observations.

### Stories

A story is a narrative built from one or more insights. It lives in one section.

**Structure:**
- **Title.** The topic, stated neutrally. "Width of Range", not "You play too wide."
- **Primary insights.** One or more, directly relevant to the section focus.
- **Supporting insights.** Pulled from other sections, but **always filtered to the context of this story**. A BB-focused story in the Position section only uses betting or showdown data from BB hands.
- **Impact.** The strategic consequence of the behaviour — what this enables opponents to do, or prevents the player from doing. Not a P&L number.
- **So what.** One statement that follows from whichever branches of the interrogation fired.

**Display logic.** Every defined story evaluates for every player; evaluation always runs. Display is conditional: a story renders only when the data produces meaningful signal. Stories with all metrics on target and no notable contextual variation do not display.

---

## P&L gating

A pattern that runs through the Position, Cards, Showdown, and Players sections.

A pillar fires as a **leak** only when both conditions hold:
1. The metric is off target.
2. The P&L on the flagged slice is meaningfully below the P&L on the comparator slice within the same pillar.

Other states:
- **Monitor.** Metric is off, but P&L holds up. Worth watching; often reverses as sample grows.
- **Play problem.** Metric is on target, but P&L on the on-target slice is poor. Correct selection, broken execution. The fix is in a different section (typically Streets or Bets).
- **Silent.** Metric on target and P&L positive. No reading.

All branches require `MIN_CELL` (10 hands) of volume on the flagged slice.

---

## The ten sections

| # | Section | Stories | What it interrogates |
|---|---|---|---|
| 1 | **Streets** | (target-based: c-bet, fold-to-cbet, 3-bet, fold-to-3bet; directional: check-fold, donk bet, delay c-bet) | Per-street action frequencies, each run through a four-step engine: frequency → context → outcome → so-what. |
| 2 | **Range** | Width of Range, Winning Hands | Preflop hand selection only. Width across seat count / position / hand type, and which specific hands win or lose money. |
| 3 | **Cards** | Premium Made Hands, Strong Made Hands, Marginal Made Hands, Strong Draws, Weak Draws, Air or Overcards | Postflop performance by hand strength held at the decision point. Hand strength is recomputed each street. Heavily P&L-gated. |
| 4 | **Bets** | Bet Sizing Shape, Value vs Bluff Sizing, Response to Sizing | Sizing as a fraction of pot across street / players in pot / position / texture, whether sizes match the job the hand needed, and how the player responds to bets faced (folds / calls / raises by sizing band). |
| 5 | **Position** | Nine stories, one per seat: UTG, UTG+1, MP, LJ, HJ, CO, BTN, SB, The Big Blind Problem | Each seat answers the same question — how does the player perform here? — through three or four pillars per seat (open frequency, hand composition, response to 3-bets, steal frequency, postflop aggression, etc.), all P&L-gated. |
| 6 | **Players** | Versus TAGs, Versus LAGs, Versus Nits, Versus Calling Stations, Versus Maniacs, Profitable Opponents, Unprofitable Opponents | Five playstyle stories (opponents classified by VPIP + AF, 50+ hands required) plus two pattern stories across profitable / unprofitable named villains (30+ hands). |
| 7 | **Tables** | Table Selection, Time at Table | P&L picture by table, volume distribution across profitable vs losing tables, table-level rather than opponent-level. |
| 8 | **Showdown** | Going to Showdown, Winning at Showdown, Showdown vs Non-Showdown Winnings | WTSD frequency by position / pot size, WSD by hand strength and opponent count, and the split between showdown vs non-showdown winnings as a diagnostic of player type. |
| 9 | **All-in EV** | (listed in §6 of the spec but not detailed) | All-in frequency, fold to all-in, won at all-in. |
| 10 | **Trends** | Direction of Travel, Session Swings | Time-window analysis: which headline metrics are moving in which direction and what's driving it; within-session vs across-session shifts, tilt patterns, session-length effects. |

Roughly thirty stories total.

---

## Worked example — The Big Blind Problem (Position section)

The spec walks the full pipeline for one story in §10. The pattern is the template for every other interrogation in the framework.

**Step 1 — Defend frequency.** Pull BB defend % (call + 3-bet combined) by seat count. Branch on whether it's within / above / below target.

**Step 2 — How they are defending.** Pull BB call % and BB 3-bet % separately. Detect: 3-bets on target, 3-bets below target with calls high (transparent, easy to play against), or 3-bets above target (potentially unbalanced).

**Step 3 — Raiser context.** Cut BB defend % by the raiser's position. Does the player tighten correctly against UTG and loosen against BTN? Or is the defence rate flat — defending UTG opens at the same rate as BTN steals?

**Step 4 — Postflop behaviour (BB caller hands only).** Pull fold-to-cbet, postflop aggression, and WWSF. Branch on whether the player is collapsing under pressure, calling correctly but passively, balanced, or calling too much without converting to wins.

**Supporting insights (filtered to BB hands).** Bet sizing when leading from BB (from Bets section, BB hands only). Showdown frequency after BB defence (from Showdown section, BB hands only).

**Impact.** *"Passive BB defence gives opponents a low-risk position to attack. Every raise into the BB becomes a probe rather than a gamble, because the response is predictable and the defence collapses under pressure."*

**So what.** One statement that depends on which branches fired. For example, if defending the right amount but folding too much to c-bets: *"Your selection is fine but your postflop execution is leaking. Call c-bets with a plan to continue on turns, not to reassess from scratch each street."*

The pattern repeats across every story: a sequenced interrogation that branches by what the data shows, a contextual impact, and one so-what statement derived from whichever branches fired.

---

## Data pipeline

| Stage | Responsibility |
|---|---|
| **Input** | Raw hand JSON objects from data collection. |
| **Parser** | Walks the unparsed `actions` array text, tracks the running pot, splits by street, emits one DAU per decision point per player. Hero by `>>` prefix. |
| **Storage** | Raw JSON retained for fidelity; parsed DAUs stored as structured records alongside. |
| **Metrics** | `analyse()` and `bucketizeAnalysis()`. Already partly implemented in current repo. |
| **Insights** | Rules applied to metric outputs. Always fire. Target-based or directional. |
| **Stories** | Groups of insights with impact and so-what. Display only when meaningful signal exists. |

---

## What's new vs what already exists in principle

Terminology and shape that's already in the repo:
- **DAU/metric/insight/story layering** — the bootstrap in [js/insights/framework.js](../js/insights/framework.js) (commit 99803de, Stage 5.1) names these layers and registers stories via `defineStory`.
- **Four-clause story text** — the framework already composes behaviour → implication → context → advice, plus an optional win-rate trailer. The spec calls clause 4 *outcome gap* and includes P&L (not only win rate) as a valid trailer signal.
- **Severity gates** — `classifySeverity` with `r` / `a` / `g` / `n` and `renderOnTarget` / cell-divergence gating already exists.
- **Sample gates** — `MIN_AGGREGATE` / `MIN_AXIS` / `MIN_CELL` constants are in [js/helpers/analysis.js](../js/helpers/analysis.js).
- **Bucketing axes** — `bucketizeAnalysis()` already cuts by seat count, flop texture, position, position × seat count.

What is genuinely new in this spec:
- **Per-decision-point DAUs with pot_size.** Current parsing in [js/helpers/hand-parsing.js](../js/helpers/hand-parsing.js) is action-level, not decision-level, and doesn't track the running pot per decision. Stack depth is in the spec but our data doesn't have it; skip it.
- **P&L-gated branches** in Position, Cards, Showdown, and Players. Stories fire as leak / monitor / play problem / silent based on the comparison of P&L between the flagged slice and a comparator slice within the same pillar. The current framework gates on metric severity alone.
- **The catalogue of ~30 named stories** with explicit interrogation paths. Today only five stories are registered, all in the Betting panel. The other ~25 are either represented as legacy panel-side insight cards or not at all.
- **The ten-section layout.** The current app has twelve tabs. The spec collapses Streets and Bets and shifts grouping. A reconciliation pass is needed.
- **Supporting-insight context filtering.** A BB story can pull in Bets data but only for BB hands. The current framework doesn't filter supporting findings.
- **Directional insights** as a first-class type. The current framework requires a band; the spec wants directional behaviour-plus-outcome to be a peer category.
- **The interrogation pattern.** Each story is a sequenced branch tree, not a single metric verdict. The current `defineStory` measures one number and composes prose around it.

---

## End notes

The spec is internally consistent. The biggest single conceptual move is shifting from hand-level aggregates to decision-level DAUs as the substrate. Once DAUs exist, metrics are filters over them, insights are interpretations of filtered metrics, and stories are sequenced interrogations of insights. The four-clause and four-part shapes are the same shape the existing bootstrap uses; the catalogue, the P&L gating, and the per-decision granularity are the substantive deltas.
