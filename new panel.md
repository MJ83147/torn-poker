12:16Claude responded: Custom Report panel — build guideCustom Report panel — build guide
What this is
A new panel that lets the user build their own analytical query by composing a sentence of filters, then shows them metrics, charts, and opinionated insight cards on the resulting slice. It does not use the story engine or the catalogue. It is a slicing layer over metrics the app already computes.
Mental model
The user constructs a sentence like "Show me how I play at Comatose Cove, with 3 players, against Dadmacia." Each underlined token is a filter. Clicking a token opens a popover to change its value or remove it. An "add clause" button offers any clause not currently in the sentence. A "compare" toggle splits the sentence into two segments A and B, which run independently and display side by side.
The output below the sentence has three sections: a headline strip of summary numbers, a grid of charts, and a list of insight cards. Everything below the sentence is derived from the same DAU substrate the rest of the app uses.
Filter catalogue
Twelve clauses, each one optional. The order below is the order they should appear in the "add clause" menu.
Hand-level (describe the whole hand)

Table — single-select, picks one named table or "any"
Stake level — single-select band (micro / low / mid / high / nosebleed)
Players at the table — multi-select seat counts (2 through 9)
Opponent at the table — multi-select named villains
My position — single-select (BTN / CO / MP / EP / blinds, or any)
My stack depth — single-select band (short / mid / deep / very deep)
My hole cards — single-select class (pairs / suited / broadway / AK / suited connectors / offsuit junk)
Time window — single-select (7d / 30d / year / all)
Time of day — single-select (morning / afternoon / evening / late, plus weekend / weekday)

Decision-level (describe one moment in the hand)

Pot type — single-select (limped / SRP / 3-bet / 4-bet / all-in)
My pre-flop action — single-select (opened / 3-bet / 4-bet or shoved / called / limped / defended)
Hand result — single-select (won / lost at showdown / folded pre / folded post / showdown reached)

The proof-of-concept stops here. The real build should also support:

Street (preflop / flop / turn / river)
Action faced at the decision point (open / 3-bet / c-bet / donk / check-raise / all-in / nothing)
Bet sizing faced as fraction of pot (band: tiny / small / medium / large / huge / all-in)
Board texture at the decision point (reuse existing texture buckets)
Hand strength at the decision point (premium made / strong made / marginal made / strong draw / weak draw / air or overcards)

Each clause has a label (used in the popover title), an opts array of {value, label, optional meta}, a singular or multi flag, and a template function that renders the chosen value(s) into a phrase inside the sentence.
Sentence construction
The sentence is rendered from a state object holding the user's selections and the ordered list of active clauses. Each clause renders as a phrase that joins to the next with commas and a final "and". Clauses with no value selected default to "any" and don't appear in the sentence at all — they only appear once added.
Each rendered phrase contains one underlined token. Clicking the token opens a popover with the options for that clause. Clicking outside, or selecting an option, closes the popover. Multi-select clauses stay open until the user clicks away. Each popover has a "remove this filter" link at the bottom.
Setting a value to "any" is equivalent to removing the clause. The UI should either remove the clause when "any" is selected or leave it visible with grey styling — either is fine but be consistent.
The engine
The engine is a function that takes the state object and returns a results object. Pseudocode:
function runCustomReport(state):
  daus = filterDaus(allDaus, state)
  hands = groupByHand(daus)
  
  metrics = computeMetrics(hands, daus)
  charts = computeCharts(hands, daus)
  insights = evaluateInsightRules(metrics, state)
  
  return { metrics, charts, insights, sampleSize: hands.length }
In compare mode, this runs twice — once with the A state, once with the B state — and the panel renders the deltas.
Filtering. Each clause maps to a predicate on a DAU or on a hand. Hand-level clauses filter at the hand level. Decision-level clauses filter at the DAU level. A hand qualifies for the slice if it matches all hand-level filters AND contains at least one DAU matching all decision-level filters. The matching DAUs within those hands become the active DAU set.
In practice, only one DAU per hand matches a given decision-level filter combination, so "hands matched" and "decisions matched" give the same count. The headline label stays "hands matched" throughout.
Metrics. Reuse the metric functions that already exist for the catalogue. The custom panel doesn't compute anything novel — it just runs the same metrics over a user-defined subset. Required metrics for the headline and charts:

Hands matched
Sessions touched
bb/100 across the slice
Win rate (% of qualifying hands won)
VPIP and PFR across the slice
Action breakdown (fold / call / bet / raise frequencies)
bb/100 by position (for the position bar chart)
Win rate by hole-card class (for the cards bar chart)
bb/100 across time, bucketed by session (for the trend line)

If a metric is incoherent for the active filter combination (e.g. VPIP makes no sense if the user has filtered to postflop only), the engine should return null for it and the panel should hide that element rather than show a misleading number.
Charts. Four cards in the proof of concept:

bb/100 over time across qualifying sessions (line)
bb/100 by position (bars)
Win rate by hole-card class (bars)
Action breakdown (donut, or side-by-side donuts in compare mode)

The bar charts gain a second series in compare mode. The trend line gains a second line. The donut becomes two donuts.
Insight cards
Insight cards are opinionated readouts on the slice's metrics. They fire from a small library of rule templates that evaluate against any slice, not from hand-coded branches per filter combination.
Each rule has:

A condition (a predicate over the metrics)
A severity (red / amber / green / neutral)
A title generator
A body generator
A chips list generator
A coaching line generator

The engine runs every rule against the slice's metrics and renders the cards that fire. Rules should be additive — multiple can fire on the same slice — but a sensible cap (4–5 cards) keeps the panel readable.
Starter rule set:

Strong winner — bb/100 meaningfully positive (define threshold, e.g. +6) and sample clears confidence floor. Green strength card.
Strong loser — bb/100 meaningfully negative (e.g. -6) and sample clears confidence floor. Red leak card.
Wide and passive — VPIP-PFR gap large (e.g. >12 percentage points) regardless of bb/100. Amber warning card.
Wide and aggressive — both VPIP and PFR elevated against the user's baseline, bb/100 positive. Green strength card.
Tight winner — VPIP below baseline and bb/100 positive. Green strength card.
Going to showdown too often / not enough — WTSD outside a defined band. Amber.
Snapshot fallback — if no other rule fires, emit a neutral note card summarising hands, sessions, bb/100, VPIP, PFR. Always fires last and only if the cards list is otherwise empty.

The rules need a baseline to compare against. Use the user's own all-time aggregate (computed once at panel load) as the comparator. Where a rule references "baseline VPIP" or similar, it means the user's overall figure across all their hands, not a population average.
Adding new rules later is a matter of appending to the rule list. The dev should structure the rule library as data, not as a long if/else chain — one record per rule with the condition as a function.
Sample-size handling
Two thresholds, both configurable constants at the top of the module:

SAMPLE_MIN — below this, suppress all metric-based insight cards and headline numbers (or render the numbers greyed and unreliable). Show a single "not enough hands" card explaining the situation and suggesting the user widen filters. Recommend starting at 80 hands.
SAMPLE_OK — above this, win rate is treated as trustworthy and insight rules using win rate are allowed to fire. Recommend 250 hands.

In compare mode, both segments must clear SAMPLE_MIN independently. If either falls below, show the "not enough hands" card naming which segment is short.
The sample-size check runs before insight evaluation. If the slice is too small, the engine skips rule evaluation entirely and returns only the "not enough hands" card.
Compare mode
A toggle on the panel. When on, the state object holds two segment states (A and B) instead of one. The sentence renders as two stacked sentences with A and B labels and a "vs" between them. Adding a clause adds it to both segments. Each segment's tokens are edited independently.
When compare mode is turned on, segment B initialises as a copy of A. If the user has a size clause, the build can pre-flip it to a different value as a hint — otherwise B starts identical and the user changes one thing.
The headline strip switches to a three-column "A | Δ | B" layout per stat. Charts switch to dual-series. The insight engine evaluates each segment independently, then the panel additionally evaluates a small set of comparison rules — "A is meaningfully more profitable than B", "VPIP has widened in A vs B", etc. The comparison rules are a separate small library.
State management
The panel's state object:
{
  compare: boolean,
  A: SegmentState,
  B: SegmentState (only if compare)
}

SegmentState {
  clauses: [ordered list of active clause keys],
  table: value,
  stake: value,
  size: [values],
  opponent: [values],
  position: value,
  cards: value,
  ...
}
The state should serialise to a URL fragment so users can share a query. The state should also persist to localStorage so the panel restores on reload.
Implementation order

Data layer. Implement the filter predicates for each clause against the existing DAU structures. Verify filtering works in isolation by running a few known queries and inspecting the result count.
Engine. Wire the filter output into the existing metric functions. Confirm the same metrics computed on the full dataset match the catalogue's existing numbers.
State and sentence rendering. Build the state object, the sentence renderer, and the popover. No results yet — just the input UI.
Headline strip. Wire engine output to the three headline tiles. Add the sample-size gate.
Charts. Wire the four chart cards. Reuse the existing charting helpers where possible.
Insight rules. Start with two rules (strong winner, strong loser) and the snapshot fallback. Confirm cards render. Add the rest of the starter rule set.
Compare mode. Add the toggle, dual state, and comparison rules.
Decision-level clauses. Add street, action faced, bet sizing faced, board texture, hand strength at decision. These are the harder filters because they require the DAU substrate from the new framework, so they slot in after the simpler hand-level filters are working.
URL / localStorage persistence.