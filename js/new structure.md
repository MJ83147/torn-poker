**Poker Analysis Framework**



- Players (opponents)





Design specification for the story, insight, and metric engine

May 2026

# **1. Foundations**

The framework is built on a three-layer hierarchy. Each layer is derived from the one below it. No layer skips a step.

| **Stories** Narrative accounts of how a player plays, built from one or more insights. A story only displays if it has something meaningful to say. ↑↑ **Insights** Questions answered by stacks of metrics, interpreted through context. Insights always fire. The question is not whether they have something to say but what they say. ↑↑ **Metrics** Aggregated signals computed from DAUs. VPIP, c-bet frequency, fold to raise, etc. ↑↑ **DAUs** The atomic unit. Every decision point at the table produces one, for every player, on every street. |
| --- |

# **2. The DAU**

DAU stands for Decision, Action, Outcome. It is the atomic unit of the data model. Every decision point at the table produces exactly one DAU, for every player, on every street.

| **Decision** | What the player had to choose between. Determined by game rules and context. Not explicitly logged because it is deterministic. |
| --- | --- |
| **Action** | What the player did. Call, raise, fold, check, bet. |
| **Outcome** | What resulted from that action. |

## **2.1 Context fields**

Every DAU carries context that determines what the action means.

| **street** | Preflop, Flop, Turn, River |
| --- | --- |
| **position** | UTG, MP, CO, BTN, SB, BB |
| **pot_size** | Running pot at the moment of decision. Derived by walking the actions array sequentially. |
| **stack_depth** | Hero and relevant villain stack at time of decision. |
| **player_id** | Who is acting. Hero identified by >> prefix in raw data. |
| **hand_id** | Parent hand. |
| **session_id** | Parent session. |

## **2.2 Raw data shape**

The raw input is a hand-level JSON object. A single hand contains many DAUs across streets and players.

| **Example hand object (abbreviated)** timestamp: 1773210465103 position: "BB" hole: ["3♥", "J♠"] board: ["9♣", "5♠", "7♥", "3♣", "2♥"] pot: 64000000 actions: [   "   Wazis: called $5,000,000"   ">> Systoned: folded"   "   The flop: 9♣ 5♠ 7♥"   "   Wazis: checked"   "   Wardyward: bet $6,000,000"   ... ] outcome: { result: "folded", foldStreet: "Preflop", amount: 0 } |
| --- |

## **2.3 Parsing**

The actions array is unparsed text. The parser walks it sequentially, tracks the running pot, splits by street, and emits one DAU per decision point per player. Hero is identified by the >> prefix. DAUs are emitted for all players because opponent analysis requires the same structure.

Decision options are not logged. They are deterministic from game rules given street, position, and whether aggression is facing. They do not need to be stored.

# **3. Metrics**

Metrics are aggregations of DAUs. No single DAU tells you a VPIP. Many DAUs across many hands do. Every metric is a variation of the same pattern: filter DAUs by some combination of street, position, action, and outcome, then aggregate.

## **3.1 Current metric coverage**

- VPIP, PFR, limp rate

- Aggression factor

- Per-street action breakdowns (fold, check, call, raise frequency)

- C-bet, delay c-bet, donk bet frequency and opportunity counts

- Fold to c-bet, fold to 3-bet, fold to 4-bet

- Went to showdown, won at showdown

- All-in frequency, fold to all-in, won at all-in

- P&L by position and hand type

- Bet sizing distributions by street

- Win rate by position

## **3.2 Bucketing**

The bucketizeAnalysis() function runs a full analyse() pass per bucket, giving every metric at every level of granularity:

- By seat count

- By flop texture

- By position

- By position x seat count (the most granular cross-cut)

## **3.3 Sample size gates**

| **MIN_AGGREGATE** | 30 hands. Gate for the top-level analysis. |
| --- | --- |
| **MIN_AXIS** | 20 hands. Gate for single-axis slices (position, seat count). |
| **MIN_CELL** | 10 hands. Gate for cross-axis cells (position x seat count). |

Slices below the gate are computed but flagged as gated. Gated slices are excluded from story output.

# **4. Insights**

An insight is a question answered by one or more metrics, interpreted through context. It is not a single number. It is a conclusion derived from a stack of evidence.

Insights always fire. The question is not whether an insight has something to say but what it says. A metric inside its target band still produces an insight. The character of what it says changes, not whether it fires.

## **4.1 Insight structure**

Every insight follows a four-clause pattern. The so what is not part of the insight. It belongs to the story.

| **Clause 1** | The aggregate number. Plain statement of fact. No target, no judgment. |
| --- | --- |
| **Clause 2** | Implication. What does this number mean in terms of how opponents can play against this player? |
| **Clause 3** | Context. Where is this most notable? Position, seat count, hand type. The target band is introduced here, at the level where context is sufficient to make it meaningful. |
| **Clause 4** | Outcome gap. Only present if the data supports a meaningful difference in win rate or P&L between on-target and off-target conditions. |

| **Example insight** *Your Fold to Raise is 38%. Opponents can attack you with any two cards because your defending range is thin. It is worst in 6-handed games (45%) and from CO (52%), both above the 22-28% target for those spots. Your win rate where Fold to Raise is on target is 55%, versus 38% where it is off, a 17 point gap.* |
| --- |

## **4.2 Context and target bands**

The aggregate number is never compared to a target in isolation. The target shifts with context. A VPIP of 30% means something completely different at heads-up versus 6-max versus full ring.

The backend evaluates seat count, position, and hand type simultaneously. Findings are grouped into single coherent observations. A conclusion like "you play too wide from early position in 6-max, driven by weak aces" is one observation, not three separate data points.

Targets are introduced at the point where sufficient context has been established. At aggregate level the number is stated without a target.

## **4.3 Insight types**

| **Target-based** | A defined band exists. The insight evaluates the player against it and states the gap. Examples: VPIP by position, c-bet frequency, fold to 3-bet. |
| --- | --- |
| **Directional** | No target band. The behaviour is only meaningful in combination with outcomes. High check-fold with losses is a leak. High check-fold with neutral outcomes means the player is getting away from bad spots cheaply. Examples: check-fold, donk bet, delay c-bet. |

# **5. Stories**

A story is a narrative built from one or more insights. It lives in a section. It has a title, not a verdict. Stories are always evaluated against the player's data. A story only displays if it has something meaningful to say.

## **5.1 Story structure**

| **Title** | The topic. Neutral. "Width of Range", not "You play too wide." |
| --- | --- |
| **Primary insights** | One or more insights directly relevant to the section focus. Multiple primaries are allowed as long as each is directly relevant. |
| **Supporting insights** | Insights from other sections, always filtered to the context of this story. A BB story only pulls in supporting insights from BB hands. |
| **Impact** | The strategic consequence of the behaviour. Not a P&L number. What does this pattern enable opponents to do, or prevent the player from doing? |
| **So what** | One statement. The conclusion that follows from the insights and impact combined. |

## **5.2 Display logic**

Every defined story is evaluated for every player. The evaluation always runs. The display is conditional: a story only renders if the data produces a reading with meaningful signal. Stories with all metrics on target and no notable contextual variation do not display.

## **5.3 Cross-section stories**

A story lives in one section. It can pull in supporting insights from other sections. Those supporting insights are always filtered to the context of the parent story. A BB-focused story in the position section only uses betting or showdown data from BB hands.

# **6. Analysis sections**

The full analysis is divided into ten sections. Each section has a defined set of stories.

- Streets

- Range

- Cards

- Bets

- Position

- Players (opponents)

- Tables

- Showdown

- All-in EV

- Trends

# **7. Range section**

Range covers preflop hand selection only. It does not include how hands are played postflop. That belongs in Streets and Bets.

Range has two stories: Width of Range and Winning Hands.

## **7.1 Story: Width of Range**

**Opening statement**

The aggregate VPIP. No target. No judgment. "You play X% of hands preflop."

**Interrogation: seat count**

Pull VPIP per seat count bucket. Only use buckets above MIN_AXIS.

| **One bucket with sufficient data** This is the aggregate. No additional seat count statement needed. **Multiple buckets, within 5 points of each other** "Your participation is consistent across game sizes." Introduce the target band at the dominant seat count. **Multiple buckets, meaningful variation** "In [N]-handed games you play X%, compared to Y% in [M]-handed games." Introduce the target at the most divergent bucket. |
| --- |

**Interrogation: position**

For each seat count bucket with sufficient data, pull VPIP per position above MIN_AXIS.

| **All positions on target** "This holds across all positions." **One or more positions off target** State the notable positions ordered by severity, worst first. "From [position] you play X% against a target of Y-Z%." **Multiple positions off in the same direction** Group them. "From early position you play X%, well above the Y-Z% target." |
| --- |

**Interrogation: hand type**

Only run at position x seat count combinations that showed something notable above. Evaluate which hand type is most overrepresented relative to dealt frequency.

| **One hand type disproportionate** "From [position] in [N]-max, weak aces account for X% of your played hands." Group all three dimensions into one observation. **Width spread evenly across hand types** No hand type statement. The width is a selection problem, not a composition problem. |
| --- |

**Impact**

The strategic consequence of the width, not a P&L number.

| **Too wide** Playing wide from early position means committing chips before the field acts with hands that cannot withstand aggression across multiple streets. **Too tight** Folding too many hands from late position surrenders the positional advantage those seats are designed to exploit. **On target** No impact statement. Story may not display depending on whether other branches produced signal. |
| --- |

**So what**

One statement that follows from whatever branches fired.

| **Wide from EP in 6-max, driven by weak aces:** *"**Cut weak aces from early position. A3-A7 offsuit plays poorly from UTG against a field that will often 3-bet or call you into a spot where you are dominated.**"* **Too tight from BTN:** *"**Open wider from the button. Any pair, any suited ace, any broadway, suited connectors and most one-gappers all play well here with position on every postflop street.**"* |
| --- |

## **7.2 Story: Winning Hands**

**Opening statement**

"Your most profitable hand is [hand]. Your least profitable is [hand]."

**Interrogation: inside vs outside range**

Pull P&L per hand key. For each hand, check whether it falls inside or outside the target range for the relevant position x seat count combination.

| **Losing hand inside range** The hand is being played correctly by selection standards but losing. Tagged as a play problem. Flag for Streets and Bets sections. **Losing hand outside range** The hand is outside target and losing. Tagged as a selection problem. **Winning hand outside range** The hand is outside target but profitable. Tagged as monitor. **Volume too low** Skip this hand. Sample below MIN_CELL is not enough to draw conclusions. |
| --- |

**Impact**

The strategic consequence by diagnosis type.

| **Play problem** Correct selection, broken execution. The issue is postflop and will not be solved by changing which hands you play. **Selection problem** These hands have no profitable home in your game. They cost chips every time they appear. **Monitor** Profitable now but outside your target range. Keep an eye on whether this continues as sample grows. |
| --- |

**So what**

One statement per diagnosis type that appears.

| **Play problem:** *"**[Hand] is inside your range but consistently losing. The selection is right; the postflop execution is not.**"* **Selection problem:** *"**Remove [hand] from [position]. It has cost you X across Y hands and has no edge in the spots you are playing it.**"* **Monitor:** *"**[Hand] is outside your target range but profitable so far. Keep playing it and monitor. If it starts losing, remove it.**"* |
| --- |

# **8. Streets section**

Streets covers how the player acts on each street. Every action type runs through the same engine. Context is not an optional layer: it is the mechanism that determines what any frequency actually means.

## **8.1 Action type classification**

| **Target-based** | A defined band exists. Evaluated against target and outcome. C-bet, fold to c-bet, 3-bet, fold to 3-bet, fold to 4-bet. |
| --- | --- |
| **Directional** | No target band. Frequency is only meaningful in combination with outcomes. Check-fold, check-call, donk bet, delay c-bet. |

## **8.2 The engine: four steps for every action type**

| **Step 1: Frequency** | How often is the player doing this? Aggregate number, no target yet. |
| --- | --- |
| **Step 2: Context** | Does frequency vary by position, seat count, or street? The same frequency reads very differently depending on these factors. Find the notable intersections. |
| **Step 3: Outcome** | What happens when they take this action in each notable context? Win rate and P&L when action is taken versus when it is not. |
| **Step 4: So what** | One statement combining frequency, context, and outcome into a diagnosis. |

## **8.3 How context changes the reading**

Context is not decoration. The same c-bet frequency of 70% produces a completely different reading depending on conditions:

| **70% c-bet, heads up, in position, high success rate** Strength. The player is using initiative to apply pressure in the most favourable conditions. **70% c-bet, multiway, out of position, low success rate** Leak. C-betting automatically into multiple opponents out of position is burning chips. Opponents need a weaker hand to continue when multiple players remain. **70% c-bet, heads up, out of position, neutral success rate** Borderline. The frequency is not wrong but the out-of-position element increases risk. Look at which boards this is happening on. |
| --- |

The same logic applies to every action type. Check-fold at 40% means nothing without knowing:

- Which street it is happening on (turn check-fold at 40% is different from river check-fold)

- Whether it is heads up or multiway

- Whether it correlates with losses or neutral outcomes

## **8.4 Worked example: C-bet**

**Opening statement**

"You c-bet X% of the time when you have the opportunity."

**Interrogation: context**

Cut c-bet frequency by position (in position vs out of position), seat count (heads up vs multiway), and street (flop vs turn).

| **Frequency consistent across all contexts** "Your c-bet frequency is consistent regardless of position, seat count, or street." Introduce the target band here. **Higher multiway than heads up** "You c-bet more often into multiple opponents than heads up. In [N]-way pots you c-bet X%, compared to Y% heads up." Almost always a leak. **Lower in position than out of position** "You c-bet less often when you have positional advantage." Unusual and worth examining. In-position c-bets have a higher EV floor. **Drops sharply on the turn vs flop** "You c-bet the flop at X% but give up on the turn at Y%." This can be correct or a leak depending on outcomes. |
| --- |

**Interrogation: outcome**

For each notable context from above, pull success rate (fold + hero wins) and P&L when c-bet is taken versus skipped.

| **High frequency, high success rate** Strength. Continuation betting is working. **High frequency, low success rate** Leak. C-betting too automatically. Opponents are calling or raising at a rate that makes it unprofitable. **Low frequency, high success rate** Picking spots well. Could potentially c-bet more and retain edge. **Low frequency, low success rate** Opponents are realising equity when checks are made. Free cards are being given to hands that should be pushed out. |
| --- |

**Impact**

| **Over c-betting multiway** Opponents learn the c-betting range is wide and begin floating or raising with hands they would fold heads up. Initiative becomes a liability. **Under c-betting in position** Opponents take free cards and realise equity. The positional advantage of having initiative is being left unused. |
| --- |

**So what**

| **High frequency, poor multiway outcome:** *"**Tighten your c-bet range in multiway pots. Bet for value and protection on boards that connect with your opening range. Check back and reassess when the board misses.**"* **Low frequency, good outcome:** *"**Your c-bet selection is sharp. You could widen slightly in position heads up and retain the same edge.**"* |
| --- |

# **9. System design**

## **9.1 Data pipeline**

| **Input** | Raw hand JSON objects from the data collection layer. |
| --- | --- |
| **Parser** | Walks the actions array, tracks running pot, splits by street, emits one DAU per decision point per player. |
| **Storage** | Raw JSON retained for fidelity. Parsed DAUs stored as structured records alongside. |
| **Metrics** | Computed by analyse() and bucketizeAnalysis(). Already implemented. |
| **Insights** | Rules applied to metric outputs. Always fire. Target-based or directional. |
| **Stories** | Groups of insights with impact and so-what. Display only when meaningful signal exists. |

## **9.2 Insight assembly**

The backend evaluates every dimension sequentially but groups output into single coherent observations. Multiple findings across position x seat count x hand type become one sentence, not three.

Targets are context-dependent. The same metric is evaluated against a different band for every position x seat count combination. Targets are never stated at aggregate level.

## **9.3 Story assembly**

Every defined story is evaluated for every player. Display is conditional on meaningful signal. A story with all metrics on target and no notable contextual variation does not display.

Supporting insights from other sections are always scoped to the context of the parent story. The so what is one statement derived from whichever branches of the interrogation fired.

# **10. End-to-end example**

The following traces the full pipeline for a single story: "The Big Blind Problem" in the Position section. Every branch of the interrogation is shown with the output it produces.

## **10.1 Story title**

| **The Big Blind Problem** |
| --- |

## **10.2 Interrogation: defend frequency**

Pull BB defend % (call + 3-bet combined) by seat count.

| **Branch A: Defend % within target** "Your BB defend frequency is on target." Move to how they are defending. **Branch B: Defend % above target** "You defend too often from the BB. In [N]-handed games you defend X% against a target of Y-Z%." Move to how they are defending. **Branch C: Defend % below target** "You fold too often from the BB. In [N]-handed games you defend X% against a target of Y-Z%." Move to how they are defending. |
| --- |

## **10.3 Interrogation: how they are defending**

Pull BB call % and BB 3-bet % separately.

| **Branch A: 3-bet % within target** "Your 3-bet frequency from the BB is on target." **Branch B: 3-bet % below target, call % high** "Almost all of your BB defends are calls. You 3-bet only X% against a target of Y-Z%. Your defending range is transparent and easy to play against in position." **Branch C: 3-bet % above target** "You 3-bet frequently from the BB at X%. Confirm this is balanced with enough flat calls, otherwise your 3-bet range becomes readable and exploitable." |
| --- |

## **10.4 Interrogation: raiser context**

Cut BB defend % by position of the raiser. Does the player defend at a similar rate against UTG opens and BTN steals?

| **Branch A: Defend % adjusts correctly** "You correctly tighten your defence against early position raises." No further flag. **Branch B: Defend % flat across raiser positions** "You defend at a similar rate regardless of where the raise comes from. UTG has a much stronger range than BTN. Defending the same frequency against both inflates your calling range against hands that dominate yours." **Branch C: Defend % higher against early position** "You defend more often against early position raisers than late position steals. UTG's range is tight and strong. Calling wide into that range costs chips across every street." |
| --- |

## **10.5 Interrogation: postflop behaviour (BB caller hands only)**

Pull fold to flop c-bet when BB caller, BB postflop aggression frequency, and BB WWSF.

| **Branch A: Fold to c-bet high, aggression low** "After defending, you fold to continuation bets frequently and rarely take the lead. Opponents can c-bet you off most hands profitably regardless of what they hold." **Branch B: Fold to c-bet on target, aggression low** "You are calling c-bets at the right frequency but not applying pressure back. You are a passive caller rather than an active defender. Opponents face little risk continuing to barrel." **Branch C: Fold to c-bet on target, aggression on target** "Your postflop play from the BB is balanced." **Branch D: Fold to c-bet low** "You are calling too many c-bets from the BB. Check WWSF to confirm whether these calls are converting into won pots." If WWSF is also low, add: "You are calling and then losing. Tighten your continuing range." |
| --- |

## **10.6 Supporting insights (BB hands only)**

The following insights are pulled from other sections but filtered to BB hands only. They add depth to the story without belonging to a different story.

- Bet sizing when leading from BB (from Bets section, BB hands only)

- Showdown frequency after BB defence (from Showdown section, BB hands only)

## **10.7 Impact**

| *"**Passive BB defence gives opponents a low-risk position to attack. Every raise into the BB becomes a probe rather than a gamble, because the response is predictable and the defence collapses under pressure.**"* |
| --- |

## **10.8 So what**

One statement derived from whichever branches fired. Examples:

| **If Branch B2 (passive caller) fired** "3-bet more from the BB against late position openers and lead more flops when you connect. Make it expensive to steal and unprofitable to barrel." **If Branch B (defend too often) and Branch B (raiser context flat) fired** "Tighten your BB defence against early position raises and shift more of your defends against steals toward 3-bets rather than calls." **If Branch A (defend on target) and Branch A (fold to c-bet high) fired** "Your selection is fine but your postflop execution is leaking. Call c-bets with a plan to continue on turns, not to reassess from scratch each street." |
| --- |

Bets section
Bets covers two things: the sizing and shape of money the player puts in the pot, and how they respond to bets faced. Streets asks which actions a player takes. Bets asks whether the size of those actions is doing strategic work, and whether the player adapts their response to the size of bets they face.
Bets has three stories: Bet Sizing Shape, Value vs Bluff Sizing, and Response to Sizing.
Bet Sizing Shape
Opening statement
A neutral statement of the player's bet sizing distribution as a fraction of pot, aggregated across all streets. No target, no judgment.
Interrogation
The interrogation runs across four dimensions: street, players in pot, position, and board texture. All dimensions are evaluated together. Only dimensions that produce notable findings are pulled into the observation. Findings are grouped into one coherent statement. Targets are introduced at the level where context is sufficient, which is the intersection of street, players in pot, and position.
Branches per dimension
Coherent variation
Sizing clusters around one or two defaults, or varies sensibly across the dimension. State the shape neutrally.
Flat across the dimension
Sizing does not vary where it should. Call it out as blind to that dimension.
Scattered or incoherent
Sizing varies widely with no dominant shape, or varies in a direction that does not match the spot. Flag as noise.

Target evaluation
Inside the street x players x position intersection, the player's sizing is evaluated against the target band:
On target
Sizing matches the band for this context.
Above target
Sizing is larger than the band.
Below target
Sizing is smaller than the band.

Impact
One statement per finding. The statement describes the strategic consequence of the pattern, not a P&L number.
Scattered sizing on a street
Opponents can read your hand strength by the size you choose. Your sizing leaks information.
Single-size sizing on a street
You give opponents no decision tree, but the same bet has to do too many jobs: extracting value, protecting, and bluffing all at once.
Players-blind sizing
Betting the same fraction of pot multiway as heads-up gives worse pot odds to the field you can least afford to give them to. Opponents continue lighter than they should.
Position-blind sizing
Betting the same out of position lets opponents float you cheaply, knowing they can take the pot away later when you have to act first.
Incoherent variation by players
Variation is not doing strategic work. Some sizes are wrong for the spot because the variation is not aligned with anything.
Incoherent variation by position
Same as above for position. The variation is noise, not adaptation.
Sizing above target
Strong hands fold less than they should. Bluffs get called less than they should. Chips are committed without the return.
Sizing below target
Worse hands stay in cheaply and realise equity. Value is missed. Nothing is being protected.

So what
One statement per fired combination of findings. The statement names the pattern, points at where it shows up, and says what to do. Templates are written for combinations that produce a meaningful reading, with slots for the specific context and numbers.
Scattered sizing + below target
Your sizing is all over the place on {street} and consistently too small for the spot, especially {context}. Pick one size that fits the spot and use it as your default until the board forces a change.
Scattered sizing + above target
Your sizing on {street} is all over the place and tends to run too big in {context}, which both leaks information and costs more than the spot returns. Tighten to a single sensible default.
Coherent shape + on target
Your {street} sizing has a clear default that fits the spot in {context}. It is doing the work it should. Hold it.
Single size + below target
You use one size everywhere on {street}, and it is too small for {context}. The discipline is good but the size is wrong. Move the default up.
Single size + above target
You use one size everywhere on {street}, and it is too big for {context}. Strong hands fold less than they should and bluffs get called less than they should. Move the default down.
Players-blind + position-coherent
Your sizing on {street} adapts to position but ignores how many opponents are in the pot, so multiway pots are getting heads-up sizes. Drop your default when more than two players see the flop.
Position-blind + players-coherent
Your sizing on {street} adapts to multiway versus heads-up but is the same in position and out, so opponents float you cheaply when you are out of position. Bet bigger when you are acting first.
Board-texture-blind + everything else coherent
Your sizing on {street} is sensible across players and position but the same on wet and dry boards, which gives draws too good a price on wet boards. Bet bigger on connected and two-tone textures.
Coherent across players, position, texture + above target
Your sizing on {street} adapts well to context but runs too big across the board, costing more than the spots return. Pull every default down.
Coherent across all + below target
Your sizing on {street} adapts well to context but runs too small across the board, missing value and giving draws cheap continues. Lift every default up.

Value vs Bluff Sizing
Opening statement
A neutral statement of how the player's bet sizes line up with the hands they ended up holding, aggregated across all streets. No target, no judgment.
Scope
Value vs Bluff Sizing asks whether the player's bet size gives away their hand strength, and whether the size matched the job the hand needed. The unit of analysis is the bet line across the hand, not a single bet on a single street. The judgment for each bet is retrospective: a bet is classified as right-sized, too small, or too big based on whether it did the job the hand needed.
Judgment rule
Too small
The bet failed to do the job the hand needed. It did not fold out worse, did not protect against draws, or did not extract value when extraction was available.
Too big
The bet did more than the hand needed. It overpriced the situation, folded out callers value would have come from, or committed chips without need.
Right-sized
The bet matched the job the hand needed.

Interrogation
The interrogation runs across six dimensions: hand strength, street, players in pot, position, board texture, and sequence shape. All dimensions are evaluated together. Only dimensions that produce notable findings are pulled into the observation.
Branches per dimension
Coherent pattern
A consistent direction in the misjudgment along this dimension. State the pattern.
No notable variation
The dimension does not produce a meaningful split. Move on.
Scattered or incoherent
Misjudgment varies along the dimension but with no sensible direction. Flag as noise.

Impact
One statement per finding.
Consistently too small for hand strength
You are underpricing your strong hands. Opponents see the river cheaply with hands that should have been priced out, and you are missing value when you have the goods.
Consistently too big for hand strength
You are overpaying your bluffs and pricing your value hands out of the action. Strong hands get folded too easily. Weak hands cost more than they win.
Too small clusters on a specific street
Your {street} sizing is consistently below what the hand needs. You are either failing to protect or failing to extract on this street specifically.
Too big clusters on a specific street
Your {street} sizing is consistently above what the hand needs. You are overcommitting or folding out the action you wanted on this street specifically.
Too small multiway, fine heads-up
You handle heads-up sizing well but undersize in multiway pots, giving the field cheap continues. Multiway pots need bigger bets to protect against multiple draws.
Too big multiway, fine heads-up
You handle heads-up sizing well but oversize in multiway pots, folding out the callers your value would have come from. Multiway pots punish big bets.
Too small out of position, fine in position
You size well in position but underbet out of position, letting opponents see free cards when you needed to charge them.
Too big out of position, fine in position
You size well in position but overbet out of position, committing more chips than the spot returns when you cannot see what opponents do next.
Sizing wrong on wet boards, fine on dry
You handle dry boards well but misjudge wet ones, where sizing matters most. Wet boards reward size that prices out draws.
Sequence: starts right, ends too small
You give up sizing late in the hand. Strong starting bets shrink on the turn and river, letting opponents catch up cheaply or stack off cheaply.
Sequence: starts too big, ends too small
Your sizing shrinks under pressure. Big early bets followed by small later bets tells opponents your hand got worse, and they pile on.
Sequence: consistently too small across the line
Your whole bet line is too cautious for the hand. You are leaving value on the table when you have it and not protecting when you need to.
Sequence: consistently too big across the line
Your whole bet line is too aggressive for the hand. Bluffs are overbuilt and value hands get no callers.

So what
To be written.
Response to Sizing
Opening statement
A neutral statement of how the player responds to bets faced, broken down by the size of the bet. Against bets of {size band}, you fold X%, call Y%, raise Z%. Stated across the sizing bands. No target, no judgment.
Scope
Response to Sizing asks what the player does when money is put in front of them and whether that response shifts with the size of the bet they face. The discipline-versus-stations reading sits inside this story as the outcome layer: folding to small bets that should be called is one kind of mistake, calling big bets that should be folded is the opposite.
Sizing bands
Bets faced are bucketed by fraction of pot: under 33%, 33 to 66%, 66 to 100%, and overbet. These are the bands used in the opening statement and the interrogation.
Interrogation
The interrogation runs across six dimensions: sizing band faced, street, players in pot, position, board texture, and hand strength held when facing the bet. All dimensions are evaluated together. The hand strength dimension is retrospective and uses showdown data where available.
Branches per dimension
Coherent pattern
Response shifts along the dimension in a sensible direction. State the pattern.
Flat across the dimension
Response does not vary where it should. Call it out as blind to the dimension.
Scattered or incoherent
Response varies but with no sensible direction. Flag as noise.

Impact
One statement per finding.
Folds too often to small bets
You are paying off opponents for free. Small bets are cheap to call and often probes, but you are folding hands that should continue.
Calls too often to big bets
You are paying off value. Big bets are usually strong, but you are not giving opponents credit and calling down with hands that cannot win.
Sizing-blind response
You react the same way to a small probe as to an overbet. Opponents can size up with value and size down to bluff cheaply, and either way gets the same response from you.
Folds vary by street
Your response to bets changes by street in a way that is making spots more or less profitable. The {street} pattern is the one to look at.
Folds vary by players in pot
You handle bets faced differently heads-up vs multiway. Multiway bets are usually stronger; heads-up bets can be wider. Your response should reflect that, and it is leaning the wrong way in {context}.
Folds vary by position
Your response to bets shifts with position in a way that is costing you. Out-of-position calls are more expensive than in-position ones, and the pattern shows you are not adjusting.
Folds vary by board texture
Wet boards reward folding more than dry ones because opponents' draws and made hands stack better. You are not adjusting your fold rate to the texture.
Folds correlated with hand strength (right call)
You fold weak hands and call with strong ones. This is the discipline reading. The response matches the holding.
Folds uncorrelated with hand strength (wrong call)
Your fold rate does not track what you hold. Weak hands stay in, strong ones bail. Opponents can pressure you regardless of what they have because your defence is not sorted by hand strength.
Calls too often when behind
At showdown, your called hands are losing more than they should. You are paying off value rather than folding.
Folds too often when ahead
At showdown, the hands you folded would have won. Opponents are getting you off the best hand.
Raises too rarely (passive)
You almost never raise bets faced. Calling-only defence is exploitable: opponents bluff at you knowing you will not fight back.
Raises too often (over-aggressive)
You raise into spots where opponents are unlikely to fold, paying off value with chips you did not need to put in.

Position section
Position covers how the player performs at each seat at the table. The section has nine stories, one per seat, all answering the same question: how does the player perform at this seat?
Branches in every story are gated by P&L. A pillar fires as a leak only when the metric is off target and the P&L on the flagged slice is meaningfully below the P&L on the on-target slice of the same pillar. If the metric is off but P&L holds up, the branch flags as monitor. If the metric is on target but P&L is poor, the branch flags as play problem (correct selection, broken execution). All branches require MIN_CELL volume on the flagged slice.

11.1 Story: Under the Gun
Opening statement
"From UTG you play X% of hands and open Y% when first in. Net P&L from UTG is Z across N hands."
Pillar 1: open frequency
Metric: UTG open % vs 8-12% target band (9-handed) or 12-15% (6-handed). P&L slice: net P&L of UTG opens, split by on-target hand types vs off-target hand types.
| Leak: open % above target + off-target opens lose meaningfully more than on-target opens "You open too wide from UTG. At [N]-handed you open X%. Your weak-ace and offsuit broadway opens (off-target hands) have lost $A across B hands, against $C profit across D hands for your on-target opens." | | Leak: open % below target + UTG profit below seat-count peer benchmark "You open too tight from UTG. At X% against an 8-12% target, you are folding profitable opens. Your UTG win rate is below what the seat returns when played correctly." | | Monitor: open % above target + off-target opens not losing "You open above target from UTG but your wider range is holding its own. Keep watching; this often reverses as sample grows." | | Play problem: open % on target + P&L negative on the on-target slice "Your UTG selection is right but you are losing with the right hands. The leak is postflop, not preflop." | | Silent: open % on target + P&L on the on-target slice positive No reading. |
Pillar 2: hand composition
Metric: distribution of UTG hands played by type (premium pairs, premium broadways, weak aces, suited connectors, offsuit junk). P&L slice: net P&L by hand type within UTG opens.
| Leak: weak aces overrepresented + weak-ace P&L negative or meaningfully below premium-pair P&L "X% of your UTG opens are weak aces (A2-A9 offsuit). They have lost $A across B hands while your premium opens have made $C across D hands." | | Leak: speculative suited overrepresented + their P&L meaningfully below premium opens "X% of your UTG opens are speculative suited hands. They are returning $A per hand against $C per hand from your premium opens." | | Monitor: junk overrepresented + P&L holding "Off-target hands appear in your UTG range but are not currently losing. Worth watching." | | Silent: composition on target No reading. |
Pillar 3: response to 3-bets
Metric: fold to 3-bet, call %, 4-bet % when opening from UTG, vs 60-70% fold and 8%+ 4-bet targets. P&L slice: net P&L when facing a 3-bet after UTG open, split by response (fold, call, 4-bet).
| Leak: fold to 3-bet above 70% + calling/4-betting P&L positive while folds give up positive EV spots Cannot fire on absolute P&L of folds (folds lose blinds by definition). Fires only if the alternative responses on this slice are profitable, indicating folds are being chosen over winning alternatives. "You fold to 3-bets at X% after opening UTG. On the hands where you do continue, you are profitable. Opponents are 3-betting you light and you are giving up winning spots." | | Leak: fold to 3-bet below 60% + calls and 4-bets losing meaningfully "You call 3-bets too often after opening UTG. Your continuing hands have lost $A across B hands, against $C profit on hands where you folded the marginal portion of your range." | | Leak: 4-bet % below 8% + 4-bet P&L (where it occurs) meaningfully better than call P&L "You 4-bet only X% when 3-bet after opening UTG. The 4-bets you do make are winning more than your flat calls. You have a profitable 4-betting range you are not using." | | Silent: response on target or P&L doesn't separate the responses No reading. |
Impact
Fires only if at least one pillar resolved to a leak or play problem. Impact statement is templated by which combination of pillars fired.
| Open % leak + composition leak "Wide UTG opens combined with weak hand selection cost chips on every street. The full field acts behind you, position is given up to anyone who calls, and the only edge you have is range strength. Both are working against you." | | Open % on target + response leak "Your selection is sound but you are not defending it. Opponents 3-bet you light because they know how the response goes." | | Composition leak only "Your opening frequency is fine but the hands inside it are not. The right number of UTG opens with the wrong hands costs the same as opening too wide." |
So what
Templated per fired combination. Includes the P&L figure that drove the diagnosis.
| Open % above target + weak aces overrepresented + both losing "Cut weak aces from your UTG range. They have cost you $A across B hands. Tighten UTG to pairs, premium broadways, and AQ+/AJs+." | | Open % on target + fold to 3-bet above 70% + alternative responses profitable "Add a 4-betting range from UTG with QQ+/AK and a suited-ace bluff component. Your continuing hands are profitable; you are folding too much of the range that wins." | | Play problem on open % slice "Your UTG selection is right but losing. The fix is not in this seat. Look at how you play these hands postflop in the Streets and Bets sections." |

11.2 Story: UTG+1
Opening statement
"From UTG+1 you play X% of hands and open Y% when first in. Net P&L from UTG+1 is Z across N hands."
Pillar 1: open frequency relative to UTG
Metric: UTG+1 open % vs 10-14% target and vs UTG open %. P&L slice: net P&L of UTG+1 opens vs UTG opens, on equivalent hand subsets.
| Leak: UTG+1 open % identical to UTG (within 1 point) + UTG+1 P&L meaningfully below what wider play returns Requires comparison cohort. If the player widens correctly at MP and MP is profitable, the gap shows treating UTG+1 as UTG forfeits value. "You open UTG+1 the same as UTG. The marginal hands you fold here are profitable when you play them from MP. Cost of the under-expansion: $A across B hands." | | Leak: UTG+1 open % closer to MP than UTG + off-target portion of opens losing "You open UTG+1 at X%, closer to your MP range. The wider portion of your range (the hands you would not open from UTG) has lost $A across B hands." | | Leak: UTG+1 open % below UTG + UTG+1 P&L below UTG P&L "You open UTG+1 tighter than UTG and your UTG+1 results are also worse. You are giving up the seat's structural advantage." | | Monitor: open % off target + P&L holds No leak fire. | | Play problem: open % within band + on-target opens negative Selection is right; postflop is the issue. | | Silent: open % within band + P&L positive No reading. |
Pillar 2: hand composition
Same evaluation as UTG.
| Leak: speculative hands overrepresented vs UTG + those hands losing meaningfully more than premium opens State the P&L gap. | | Leak: weak aces overrepresented + weak-ace P&L negative Same template as UTG. | | Monitor / silent as in UTG. |
Pillar 3: response to 3-bets
Same evaluation as UTG.
Impact
| Open % identical to UTG + composition tight "UTG+1 is a transition seat, not a clone of UTG. Playing them identically leaves chips uncollected against a field that has narrowed by one." | | Open % closer to MP + composition leak "Treating UTG+1 as MP ignores the six players still to act at 9-handed. The wider hands you are adding do not have the implied odds to justify them." |
So what
| Open % identical to UTG + cost confirmed "Widen UTG+1 marginally beyond UTG. Add suited broadways and the bottom of your premium pairs. The hands you are folding here are returning profit elsewhere." | | Open % closer to MP + losing on the wider portion "Tighten UTG+1 toward your UTG range. The wider portion has cost you $A. Six players behind is still a lot of equity." | | Play problem "Your UTG+1 selection is right but losing. Look at postflop play, not range." |

11.3 Story: Middle Position
Opening statement
"From MP you play X% of hands and open Y% when first in. Net P&L from MP is Z across N hands."
Pillar 1: open frequency
Metric: MP open % vs 14-18% target. P&L slice: P&L of MP opens, split by on-target vs off-target hands.
| Leak: open % above target + off-target opens losing meaningfully more than on-target State the gap. | | Leak: open % below target + MP P&L below what the seat returns at correct frequency Cohort comparison required. | | Monitor / play problem / silent as elsewhere. |
Pillar 2: 3-bet frequency vs EP opens
Metric: 3-bet % from MP when facing UTG or UTG+1 open, vs 4-7% target. P&L slice: P&L when 3-betting from MP vs flat-calling EP opens, on the same hand subsets.
| Leak: 3-bet % below 4% + 3-bets when made are profitable, flat-calls in this spot are not "You 3-bet only X% from MP against EP opens. The 3-bets you make have profited $A; your flat-calls have lost $B. You have a profitable move you are not using." | | Leak: 3-bet % above 7% + 3-bets losing meaningfully "You 3-bet X% against EP opens from MP. These 3-bets have lost $A across B hands. EP ranges are too strong to 3-bet light." | | Monitor / silent as elsewhere. |
Pillar 3: response to squeezes
Metric: fold to 3-bet from MP open, isolating 3-bets from CO/BTN/SB/BB. P&L slice: P&L on squeeze defence, split by response.
| Leak: fold to squeeze above 70% + alternative responses profitable Same shape as UTG response leak. | | Leak: fold to squeeze below 60% + continuing hands losing meaningfully Same shape as UTG. | | Silent otherwise. |
Impact
| Open % within band + 3-bet leak "Your MP opening selection is sound but the seat's most profitable move (3-betting EP) is going unused." | | Open % above target + squeeze defence leak "Wide MP opens that fold to squeezes is the most exploitable combination at this seat." |
So what
| 3-bet % below target + 3-bets profitable "Add a 3-betting range from MP against EP opens. Hands like AQ, KQs, 99-JJ. Your existing 3-bets are profitable, you are leaving more on the table." | | Squeeze defence weak + cost confirmed "Tighten your MP opening range and add a 4-betting range against squeezes. Late position and the blinds are squeezing you because folds are the most common response." |

11.4 Story: Lojack
Opening statement
"From LJ you play X% of hands and open Y% when first in. Net P&L from LJ is Z across N hands."
Pillar 1: open frequency
Metric: LJ open % vs 18-22% target. P&L slice: as elsewhere.
| Leak: open % below 18% + LJ P&L meaningfully below seat potential Cohort comparison: if the player's HJ/CO are wider and profitable, LJ tightness is leaving money behind. | | Leak: open % above 22% + off-target opens losing Standard shape. | | Monitor / play problem / silent as elsewhere. |
Pillar 2: steal attempts when folded to
Metric: steal % when folded to LJ vs 25-30% target. P&L slice: P&L of LJ steals, split by stolen-uncontested vs played-out.
| Leak: steal % below 25% + the steals that are made are profitable "When folded to LJ you steal X%. The steals you do make profit $A per hand. You are leaving uncontested pots on the table." | | Leak: steal % above 30% + steals losing meaningfully (3-bets and call-downs eat the equity) State the P&L. | | Silent otherwise. |
Pillar 3: 3-bet frequency vs EP/MP opens
Metric: 3-bet % from LJ when facing EP/MP open, vs 5-8% target. P&L slice: P&L of LJ 3-bets vs flat-calls of EP/MP opens.
| Leak: 3-bet % below 5% + 3-bets profitable, flats not Same shape as MP 3-bet pillar. | | Leak: 3-bet % above 8% + 3-bets losing meaningfully Same shape. | | Silent otherwise. |
Impact
| Open % below + steal % below "You are playing LJ like middle position. The seat sits next to the late-position seats and prints when treated like one." | | Open % within + 3-bet leak "LJ opens are calibrated but the 3-betting opportunity is unused. Position on EP/MP makes this a profitable spot you are flat-calling away." |
So what
| LJ underplayed across pillars + cohort cost confirmed "Widen LJ. Open suited broadways, suited connectors, and pocket pairs down to 22. Add a 3-betting range against EP/MP. The seat returns more than middle position when used as a late-position seat." | | Open % above + steals losing "Tighten LJ steals. The two late-position players behind are punishing the wider portion. Your steal range has cost you $A." |

11.5 Story: Hijack
Opening statement
"From HJ you play X% of hands and steal Y% when folded to. Net P&L from HJ is Z across N hands."
Pillar 1: steal frequency when folded to
Metric: steal % when folded to HJ vs 30-35% target. P&L slice: P&L of HJ steals split between successful (uncontested or won postflop) and contested-lost.
| Leak: steal % below 30% + steals that occur are profitable State P&L gap vs cohort. | | Leak: steal % above 35% + wider portion losing meaningfully State P&L. | | Silent / monitor as elsewhere. |
Pillar 2: response to 3-bets from CO/BTN
Metric: fold to 3-bet and 4-bet % when opening from HJ, isolating CO/BTN 3-bets. P&L slice: P&L on HJ-opens-then-3-bet hands, split by response.
| Leak: fold to CO/BTN 3-bet above 65% + alternative responses profitable Same shape as UTG response leak. | | Leak: 4-bet % below 8% + 4-bets when made profitable State P&L gap. | | Silent otherwise. |
Pillar 3: postflop aggression after stealing
Metric: c-bet % when HJ is preflop raiser, vs 60-70% target heads-up. P&L slice: P&L on HJ-raised pots that reach the flop, split by c-bet vs check.
| Leak: c-bet % below 60% heads-up + c-bet hands profitable, check-back hands losing "After stealing from HJ you c-bet only X% heads-up. C-bets profit $A per hand; checked-back flops lose $B." | | Leak: c-bet % above 70% multiway + multiway c-bets losing meaningfully "After HJ steals you c-bet X% multiway. Multiway c-bets have lost $A across B hands while multiway checks profit $C." | | Silent otherwise. |
Impact
| Steal leak + c-bet leak "Steals that don't work preflop need to work postflop. Neither is happening." | | Steal on target + 3-bet defence weak "Your steals are well-selected but you give them up to any 3-bet. CO and BTN are 3-betting light against you and getting paid." |
So what
Templated with the relevant P&L figures.

11.6 Story: Cutoff
Opening statement
"From CO you play X% of hands and steal Y% when folded to. Net P&L from CO is Z across N hands."
Pillar 1: steal frequency when folded to
Metric: steal % when folded to CO vs 35-42% target. P&L slice: P&L of CO steals.
| Leak: steal % below 35% + steals profitable "When folded to CO you steal X%. The steals you make profit $A per hand. CO with only the BTN and blinds behind is one of the most profitable seats. You are not using it." | | Leak: steal % above 42% + wider portion losing State P&L. | | Silent otherwise. |
Pillar 2: response to BTN 3-bets
Metric: fold to 3-bet, 4-bet %, isolating BTN 3-bets when opening from CO. P&L slice: P&L on CO-opens-then-BTN-3-bet hands, split by response.
| Leak: fold to BTN 3-bet above 65% + alternative responses profitable Same shape as elsewhere. | | Leak: 4-bet % below 10% + 4-bets profitable when made State P&L gap. | | Silent otherwise. |
Pillar 3: 3-bet frequency vs HJ opens
Metric: 3-bet % from CO when facing HJ open, vs 7-10% target. P&L slice: P&L of CO 3-bets vs flat-calls of HJ opens.
| Leak: 3-bet % below 7% + 3-bets profitable, flats less so State P&L. | | Leak: 3-bet % above 10% + 3-bets losing State P&L. | | Silent otherwise. |
Impact
| Steal leak + 3-bet vs HJ leak + 3-bet defence weak "CO should be among your most profitable seats. All three of its pillars are underused or actively losing." |
So what
Templated with figures.

11.7 Story: Button
Opening statement
"From BTN you play X% of hands and steal Y% when folded to. Net P&L from BTN is Z across N hands."
Pillar 1: steal frequency when folded to
Metric: steal % when folded to BTN vs 45-55% target. P&L slice: P&L of BTN steals.
| Leak: steal % below 45% + steals profitable State P&L gap. | | Leak: steal % above 55% + wider portion losing to blind 3-bets State P&L. | | Silent otherwise. |
Pillar 2: postflop aggression in position
Metric: c-bet % when BTN is preflop raiser, single-barrel and double-barrel frequency. P&L slice: P&L on BTN-raised pots reaching flop, split by c-bet vs check; turn barrels split by barrel vs check-back.
| Leak: c-bet % below 65% heads-up + c-bet hands profit, checked-back hands lose State P&L. | | Leak: turn barrel % below 45% + barrels profit, checks lose State P&L. | | Silent otherwise. |
Pillar 3: defence vs blind 3-bets
Metric: fold to 3-bet, call %, 4-bet % when opening BTN, isolating SB/BB 3-bets. P&L slice: P&L on BTN-opens-then-blind-3-bet hands, split by response.
| Leak: fold to blind 3-bet above 55% + continuing hands profitable "Blinds 3-bet light into BTN. Your continuing hands profit; you are folding the wins away." | | Leak: 4-bet % below 10% + 4-bets profitable when made State P&L. | | Silent otherwise. |
Pillar 4: cold-call vs raise when facing an open
BTN-specific pillar. When facing a CO or HJ open, BTN can flat or 3-bet. Cold-calling is often a leak because it pulls the blinds in. Metric: ratio of flat-calls to 3-bets when facing late-position open from BTN. P&L slice: P&L of BTN flat-calls vs 3-bets of late-position opens.
| Leak: flat-call rate high + flat-calls losing meaningfully more than 3-bets on the same hand subsets "You flat-call CO/HJ opens from BTN X% of the time. These flats have lost $A; comparable 3-bets profit $B. Flatting from BTN pulls the blinds in and reduces your positional advantage." | | Silent otherwise. |
Impact
| All four pillars firing "BTN is the best seat at the table. When all four pillars underperform, the seat is not being played as a button at all." | | Steal on target + postflop weak "Your steals work preflop but the postflop followthrough is missing. BTN's edge is positional; it needs c-bets and barrels to materialise." |
So what
Templated with figures.

11.8 Story: Small Blind
Opening statement
"From SB you play X% of hands. Net P&L from SB is Z across N hands. (P&L from SB is typically negative due to forced blind; relevant comparison is to expected blind loss.)"
Pillar 1: cold-call rate vs 3-bet rate when facing an open
Metric: ratio of cold-calls to 3-bets from SB when facing a raise. P&L slice: P&L of SB cold-calls vs SB 3-bets, on the same hand subsets where both are options.
| Leak: cold-call rate high + cold-calls losing meaningfully more than 3-bets "You cold-call X% of opens from SB. These calls have lost $A per hand against $B per hand when you 3-bet instead. SB cold-calls invite the BB to come along and play three-way out of position." | | Leak: 3-bet rate low across the board + when made they profit State P&L gap. | | Silent otherwise. |
Pillar 2: steal frequency when folded to (BvB)
Metric: SB open % when folded to (BvB spot) vs 35-45% target. P&L slice: P&L of SB BvB opens.
| Leak: steal % below 35% + BvB opens profitable "When folded to SB you open X%. BvB opens profit $A per hand. You are leaving uncontested pots and heads-up postflop spots on the table." | | Leak: steal % above 45% + BB 3-bets you off the wider portion at meaningful cost State P&L. | | Silent otherwise. |
Pillar 3: postflop play when defending
Metric: fold to c-bet, WWSF when defending from SB. P&L slice: P&L on SB-defended pots, split by fold-to-flop vs continue.
| Leak: fold to c-bet above 60% + continuing hands profitable "You fold to c-bets at X% after defending SB. The hands you do continue with profit $A per hand." | | Leak: WWSF low + saw-flop hands losing meaningfully State P&L. | | Silent otherwise. |
Impact
| Cold-call leak + postflop weak "SB is the worst non-BB seat. Cold-calling here while folding postflop is the most exploitable line: in for chips preflop, out under any pressure." |
So what
Templated with figures.

11.9 Story: The Big Blind Problem
Already drafted in section 10. Branches require updating to the same P&L-gated structure: each defend-frequency, raiser-context, and postflop-behaviour branch needs to gate on comparative P&L within the relevant slice. I can rewrite that one in the same shape if you want, or leave the original as a separate revision pass.


Cards section
Cards covers how the player performs by hand strength held at the moment of decision postflop. The section has six stories, grouped by strategic identity: premium made hands, strong made hands, marginal made hands, strong draws, weak draws, and air or overcards.
Hand strength is recomputed at each street's decision point. An overpair on the flop that becomes second pair on the turn is classified as overpair for flop decisions and second pair for turn decisions.
Branches are gated by comparative P&L within the category and slice. A pillar fires as a leak only when the metric is off and the P&L on the flagged slice is meaningfully below the P&L on the comparator slice within the same category. Monitor, play problem, and silent states follow the Position section pattern. MIN_CELL volume required on the flagged slice.

12.1 Story: Premium Made Hands
Set or better. Includes sets, trips, straights, flushes, full houses, quads, straight flushes.
Opening statement
"You hold a premium made hand on N postflop decisions across your sample. Net P&L on these hands is $Z."
Pillar 1: value extraction
Metric: bet/raise frequency when holding the category, by street. P&L slice: P&L on bet/raise lines vs check/call lines within the category, by street.
| Leak: bet frequency below target on flop + bet lines profit meaningfully more than check lines "You bet only X% of premium made hands on the flop. Bet lines profit $A per hand against $B for check lines. You are slowplaying hands that need to be building pots." | | Leak: bet frequency below target on turn + same P&L pattern "Turn betting with premium hands is at X%. The lines where you do bet profit substantially more than the lines where you check the turn." | | Leak: bet frequency below target on river + bet lines profit more "River value bets with premium hands run at X%. Missed river value costs $A across B hands." | | Play problem: bet frequency on target + bet lines unprofitable "You bet premium hands at the right frequency but they are losing. Check whether opponents are folding too readily, in which case sizing is the issue, not frequency." | | Silent otherwise. |
Pillar 2: protection
Less critical for true premium hands (set+ rarely needs protection in the same way an overpair does), but flush vs straight or set on a wet board can still be drawn out on. Metric: bet size as fraction of pot on wet vs dry boards when holding the category, flop and turn. P&L slice: P&L by bet size on wet boards within the category.
| Leak: bet size on wet boards below 66% pot + larger sizes when used profit meaningfully more "On wet boards you size your premium hands at X% pot. Larger sizes profit $A per hand against $B for smaller. Wet boards drew out at a rate that bigger sizing would have suppressed." | | Silent otherwise. |
Pillar 3: going too far
Almost never relevant for premium hands but included for completeness. Fires only when the player is somehow folding premium hands or losing big on call-down lines (e.g. a flush facing a higher flush).
| Leak: fold frequency above 5% facing river bet with category + folded hands would have won Rare but possible with weak flushes or low straights. State P&L. | | Silent otherwise. |
Impact
| Value extraction leaks across streets "Premium hands have to pay for the times you miss. Slowplaying them and undersizing on wet boards leaves the section's biggest pots smaller than they should be." | | Protection leak on wet boards "Big hands get drawn out on. Sizing is the only protection you control." |
So what
| Bet frequency low + P&L gap confirmed "Bet your premium hands more often, on every street. The check-call line is leaving $A on the table per hand across your sample." | | Wet-board sizing low + P&L gap confirmed "Size up on wet boards with premium hands. Anything below 66% pot is giving draws a price they should not be getting." |

12.2 Story: Strong Made Hands
Overpair, top pair, two pair.
Opening statement
"You hold a strong made hand on N postflop decisions across your sample. Net P&L on these hands is $Z."
Pillar 1: value extraction
Metric: bet/raise frequency by street. P&L slice: P&L on bet vs check lines within the category, by street.
| Leak: flop c-bet frequency below 65% with the category + bet lines profit meaningfully more State P&L gap. | | Leak: turn barrel frequency below 50% + bet lines profit more "Turn aggression with strong made hands runs at X%. Check-back lines profit $A per hand; turn bets profit $B." | | Leak: river bet frequency below target + value being left State P&L. | | Silent otherwise. |
Pillar 2: protection
This is the central question for strong made hands. Top pair on a wet board needs to charge draws. Metric: bet size as fraction of pot on wet boards (two-tone, connected, or both) with the category. P&L slice: P&L by bet size on wet boards within the category; P&L on wet-board lines vs dry-board lines for the same category.
| Leak: wet-board bet size below 66% pot + larger sizes profit meaningfully more on wet "On wet boards your sizing with strong made hands averages X% pot. Lifting to 66%+ profits $A more per hand. Draws are realising equity that bigger sizing would suppress." | | Leak: same sizing on wet and dry boards + wet-board P&L meaningfully below dry-board P&L "Your sizing does not adjust to board texture. Wet-board outcomes are $A below dry-board outcomes on equivalent hand strength." | | Silent otherwise. |
Pillar 3: going too far
The key leak for strong made hands. Top pair good kicker is rarely the best hand by the river when stacks go in. Metric: call-down frequency facing turn and river bets with the category. P&L slice: P&L on call-down lines vs fold lines facing turn raises or river bets with the category.
| Leak: call frequency facing turn raise above 60% + call lines lose meaningfully more than fold lines "You call turn raises with top pair / overpair at X%. Call-downs lose $A per hand; folds break even by losing only the chips already invested. Opponents who raise the turn rarely do it light." | | Leak: call frequency facing river bet above 70% with one pair + same P&L pattern State P&L. | | Leak: stack-off frequency on raised turns with overpair + losing meaningfully "Stacking off with overpair on raised turns has cost $A across B hands. Overpair is one pair." | | Silent otherwise. |
Impact
| Value leak + going too far leak "Strong made hands need bet, bet, evaluate. You are doing the opposite: too cautious early, too committed late. Both lose chips for the same reason — failing to read where one pair stops being good." |
So what
| Flop/turn bet frequency low + call-down high "Bet more on flop and turn with one pair. Fold more to turn raises and river bets. The frequencies need to flip: aggressive when the hand is likely best, disciplined when it is likely not." | | Wet-board sizing flat "Size up on wet boards. Dry-board sizing on a flush draw board prices the draw in." |

12.3 Story: Marginal Made Hands
Second pair, third pair, bottom pair, weak pocket pairs below the board.
Opening statement
"You hold a marginal made hand on N postflop decisions across your sample. Net P&L on these hands is $Z."
Pillar 1: showdown value vs bluff catching
The central question for marginal hands. They have showdown value against bluffs but lose to most value bets. Metric: call frequency facing bets with the category, by street. P&L slice: P&L on call lines vs fold lines within the category, split by street.
| Leak: river call frequency above 50% with the category + call lines lose meaningfully "You call river bets with second pair or worse at X%. Call lines lose $A per hand; folds avoid the loss. Bluff catching with marginal hands works when opponents bluff often; in this sample they are betting for value." | | Leak: turn float frequency above 30% + float lines lose State P&L. | | Monitor: call frequency above target + P&L holds "You call wide with marginal hands but the catches are working. Worth tracking; this often reverses." | | Silent otherwise. |
Pillar 2: avoiding the trap of building pots
Marginal hands should not build pots. Betting them as if they were strong creates expensive spots. Metric: bet/raise frequency with the category. P&L slice: P&L on bet/raise lines vs check lines within the category.
| Leak: flop lead frequency above 20% with the category + lead lines lose meaningfully more than check lines "You lead the flop with marginal made hands at X%. Lead lines lose $A per hand; checks lose $B. Building a pot with second pair gives opponents a chance to raise you off the hand or extract from you when they have you crushed." | | Leak: raise frequency on flop above 10% with the category + raise lines losing "Flop raises with marginal hands have lost $A across B hands. Raising a marginal hand turns it into a bluff with weak equity behind." | | Silent otherwise. |
Pillar 3: position-driven adjustment
Marginal hands play differently in position (where you control pot size by checking back) vs out of position (where you cannot). Metric: P&L with the category in position vs out of position. P&L slice: same.
| Leak: P&L out of position meaningfully worse than in position + OOP call frequency high "Marginal hands out of position have cost $A per hand against $B in position. Out of position you cannot control the pot size on later streets, and your calls invite barrels." | | Silent otherwise. |
Impact
| All three pillars firing "Marginal hands need pot control, not pot building. You are bluff-catching when behind, leading when you should check, and doing it out of position. Each pillar compounds the others." |
So what
| River call high + losing "Tighten river call-downs with marginal hands. Bluff-catching only works when the opponent is bluffing, and the P&L says they are not." | | Leading flop + losing "Check marginal made hands. Let the preflop raiser bet so you can call cheaply. Leading these hands turns them into either bluffs or value-betting hands they are not." |

12.4 Story: Strong Draws
Combo draws, flush draws, open-ended straight draws.
Opening statement
"You hold a strong draw on N postflop decisions across your sample. Net P&L on these draws is $Z."
Pillar 1: pricing
Metric: call frequency facing bets with the draw, vs the price being offered. P&L slice: P&L on calls when priced in (pot odds meet equity) vs calls when priced out, within the category.
| Leak: call frequency above 80% when priced out + call lines lose meaningfully "You call X% of bets with strong draws regardless of price. Calls when the price exceeds your equity have lost $A per hand; calls when priced in profit $B. Pot odds are not optional." | | Leak: fold frequency above 30% when priced in + folded hands would have won at expected equity rate "You fold strong draws X% when the price is right. You are passing up profitable continues." | | Silent otherwise. |
Pillar 2: semi-bluffing
Strong draws are the best semi-bluffing hands because they have equity if called. Metric: raise/bet frequency with strong draws facing a bet, vs passive continuation. P&L slice: P&L on aggressive lines vs passive call lines within the category.
| Leak: raise frequency below 15% with strong draws facing flop bet + raise lines profit meaningfully more than calls "You raise X% of strong draws facing a flop bet. Raise lines profit $A per hand; calls return $B. Strong draws have the equity to raise and the fold equity to make raising profitable beyond the equity alone." | | Leak: lead frequency below 20% with strong draws when checked to + lead lines profit more "When checked to with a strong draw you lead X%. Leads profit; checks behind concede the pot when neither side connects." | | Silent otherwise. |
Pillar 3: realising equity
Once continuing, does the player get to showdown the times they should? Metric: WWSF with the category, and frequency of folding pre-showdown when still drawing. P&L slice: P&L on hands that reach showdown vs hands folded on turn or river while still drawing.
| Leak: fold frequency on turn with live strong draw above 30% + fold lines forfeit positive equity "You fold strong draws on the turn at X% while still live. Folding a flush draw with one card to come throws away 19% equity plus implied odds." | | Leak: WWSF below 40% with the category + reaching showdown profits more than not State P&L. | | Silent otherwise. |
Impact
| Pricing leak + semi-bluff leak "Strong draws need to be played aggressively because they have equity if called. Calling passively at any price is the worst of both worlds: no fold equity, no price discipline." |
So what
| Raise frequency low + raises profitable "Raise more with strong draws facing a flop bet. Combo draws and flush draws on connected boards have the equity and the fold equity to make raising the highest-EV line." | | Folding turn draws "Stop folding live draws on the turn unless the price genuinely fails. With a flush draw and one card to come you need roughly 4:1 to call profitably; most turn bets give you that." |

12.5 Story: Weak Draws
Gutshots, backdoor flush draws, weak overcards with backdoor equity.
Opening statement
"You hold a weak draw on N postflop decisions across your sample. Net P&L on these draws is $Z."
Pillar 1: pricing
Weak draws need very good prices because their equity is thin. Gutshot is roughly 8% per street. Metric: call frequency facing bets with the draw. P&L slice: P&L on calls vs folds within the category.
| Leak: call frequency above 50% with gutshot + call lines lose meaningfully "You call X% of bets with gutshots. Gutshots have 8-9% equity per street and need a 10:1 or better price plus implied odds. Calls have lost $A per hand." | | Silent otherwise. |
Pillar 2: implied odds discipline
Weak draws are about implied odds, not direct odds. They only work when stacks are deep and the hand can pay you off if you hit. Metric: call frequency with weak draws against short stacks (where implied odds are limited). P&L slice: P&L on weak-draw calls vs stack depth of opponent.
| Leak: call frequency above 30% with weak draws against short stacks + losing meaningfully "You call weak draws against short stacks at X%. Without implied odds, the math does not support continuation. Cost: $A across B hands." | | Silent otherwise. |
Pillar 3: semi-bluffing weak draws
Weak draws can be turned into semi-bluffs when the fold equity is high enough to justify it. Metric: raise/lead frequency with weak draws. P&L slice: P&L on aggressive lines vs passive lines with the category.
| Leak: raise frequency 0% with weak draws + occasions where the equity + fold equity would have profited This is harder to evaluate from P&L alone since the data shows what happened, not what could have. Fires only as a directional note when other pillars are clean. | | Monitor: aggressive lines with weak draws profitable in sample "Your weak-draw raises in this sample have profited. Keep an eye on whether opponents adjust." | | Silent otherwise. |
Impact
| Pricing leak + implied odds leak "Weak draws are the most expensive hands to call without discipline. They win rarely, and when they do not win, they cost you a bet on every street." |
So what
| Gutshot calls high + losing "Fold gutshots without the right price. The math is unforgiving: 8% equity needs 11:1 odds plus implied to justify." | | Calling against short stacks "Drop weak draws against short stacks. The implied odds that make them playable are not there." |

12.6 Story: Air or Overcards
No pair, no draw, or two overcards with backdoor equity only.
Opening statement
"You hold air or overcards on N postflop decisions across your sample. Net P&L on these hands is $Z."
Pillar 1: giving up vs bluffing
The central question. Air can be folded or bluffed; calling with air is rarely correct. Metric: bet/raise frequency vs fold frequency vs call frequency with the category. P&L slice: P&L on bluff lines vs fold lines vs call lines within the category.
| Leak: call frequency above 15% with air + call lines lose meaningfully more than fold lines "You call bets with air at X%. Calling with no pair and no draw has lost $A per hand. Air does not have showdown value." | | Leak: bluff frequency below 10% as preflop raiser with air on flop + bluff lines profit meaningfully more than check lines "As the preflop raiser you bluff air on the flop at X%. Bluff lines profit $A per hand; check lines lose $B. Initiative is currency; air with initiative is the spot to spend it." | | Silent otherwise. |
Pillar 2: spot selection for bluffs
Bluffs work in some spots and not others. Multiway air bluffs against multiple opponents are different from heads-up bluffs against a single opponent. Metric: bluff frequency by context (heads up vs multiway, in position vs out of position, board texture). P&L slice: P&L on bluff lines by context within the category.
| Leak: bluff frequency high multiway + multiway bluff lines lose meaningfully "You bluff air in multiway pots at X%. Multiway bluffs have lost $A per hand against $B for heads-up bluffs. Multiple opponents means at least one connected with the board." | | Leak: bluff frequency out of position high + OOP bluff lines lose "Out-of-position bluffs with air have lost $A per hand. Without position you cannot see what opponents do before committing chips." | | Silent otherwise. |
Pillar 3: barrel discipline
Once you bluff the flop, do you barrel turns and rivers profitably or give up on the wrong streets? Metric: turn barrel frequency after flop bluff with air. P&L slice: P&L on barrel lines vs check-back lines after flop bluff.
| Leak: turn barrel frequency below 35% after flop bluff with air + barrels when made profit more "After flop-bluffing air you give up on the turn at X%. The barrels you do fire profit $A per hand. One-and-done bluffs reward opponents for floating." | | Leak: turn barrel frequency above 70% after flop bluff with air + barrels losing meaningfully "You barrel turn after flop bluffs at X%. Without equity to back the bluff, turn barrels into ranges that called the flop are calling at a rate that loses chips." | | Silent otherwise. |
Impact
| Calling air + bluff selection poor "Air should be folded or bluffed, never called. Calling with air is paying to see if you got lucky." | | Bluff selection poor across contexts "Bluffs need the right conditions: heads up, in position, on boards that favour your range. Multiway and out of position turn bluffs into donations." |
So what
| Call frequency high with air "Stop calling with air. The only profitable lines with air are folding and bluffing. Choose between them and commit." | | Bluff frequency low + bluffs profitable when made "Bluff more, but selectively. As preflop raiser, on dry boards, heads up, in position. The profile is narrow but the EV is real." |
Trends section
Trends covers how the player's game shifts over time. It does not look at static patterns in their play; it looks at whether those patterns are moving. Direction of travel and session swings are the two stories. Direction of Travel asks what has changed across the player's history. Session Swings asks what shifts within and between sessions.
Trends has two stories: Direction of Travel and Session Swings.

Direction of Travel
Opening statement
A neutral statement of how the player's headline metrics have moved across their tracked history. Plain — VPIP was X early on, is Y now, stated across the key metrics (VPIP, PFR, aggression, c-bet, win rate, P&L per hand). Metrics with sufficient sample at both ends only.
Interrogation
Runs across four dimensions: time window (early vs middle vs recent), session (within vs across), metric (which are moving, which are flat), and cause (what shifted underneath when a metric moved). All dimensions evaluated together. Findings grouped into one coherent statement.
Branches per dimension
Coherent direction. Metric is moving in one direction, sustained.
Flat. No notable movement.
Volatile. Moving but with no sustained direction.
For cause specifically:
Single cause identified. The move traces to one underlying shift.
Multiple causes. Move comes from several shifts together.
No clear cause. No single underlying shift accounts for it.
Impact
Finding
Statement
Headline metric trending up
Your {metric} has been climbing across your history. Whether that is good or bad depends on what it is doing to your results.
Headline metric trending down
Your {metric} has been dropping across your history. Whether that is good or bad depends on what it is doing to your results.
Headline metric flat
Your {metric} has held steady across your history. Your game is consistent on this dimension.
Headline metric volatile
Your {metric} swings widely between sessions or stretches with no sustained direction. The volatility means your game is inconsistent on this dimension, which makes it harder to spot what is working.
Win rate or P&L trending up
Your results are improving. Your game is moving in the right direction overall.
Win rate or P&L trending down
Your results are getting worse. Something is moving against you, even if you cannot feel it session to session.
Within-session decline
You play worse the longer you sit. Fatigue or tilt is shifting your game later in sessions. Sessions should be shorter, or breaks longer.
Across-session shift
Your game has genuinely changed across your history. The early version of you played differently from the current version. Whether the new version is better or worse is the question.
Metric moved with identifiable cause
Your {metric} moved because {underlying shift}. The change is real and traceable, which means it is fixable or worth keeping depending on direction.
Metric moved with no clear cause
Your {metric} has moved but no single thing accounts for it. Drift, not a deliberate shift. Easier to lose track of and harder to correct.
Multiple metrics moving together
Several parts of your game are moving in the same direction at once, which usually means a real change in how you are playing. Look at what you are doing differently across the board.
One metric moving against the others
One part of your game is shifting while the rest holds. That single shift is the one to look at because it is the active change.

So what
Combination
Statement
Win rate up + multiple metrics moving together
Your game has shifted across the board and your results are following. Whatever you are doing differently, keep doing it.
Win rate down + multiple metrics moving together
Your game has shifted across the board and your results are getting worse. Identify what changed and pull it back to where you were.
Win rate down + metric moved with identifiable cause
Your results are getting worse, and {metric} moving because of {cause} is the trail to follow. Fix that, see if the results follow.
Win rate down + no clear cause
Your results are getting worse but nothing single is driving it. Look at within-session vs across-session next to narrow it down.
Within-session decline + flat across sessions
Your game holds up session to session but degrades within each one. Shorter sessions or breaks will recover more value than working on technique.
Across-session shift + win rate flat
Your game has changed but your results have not. The new version of you is neither better nor worse on net, but it is different, which is worth knowing.
One metric moving against the others + win rate flat
Most of your game is steady but {metric} is drifting. It has not hurt results yet but it is the early warning, worth pulling back deliberately.
All metrics flat + win rate flat
Your game is consistent. Direction of travel is not the story to spend time on right now.
Volatile + win rate down
Your game swings widely and results are dropping. The swings are likely the cause. Steadier sessions will fix more than any single technical adjustment.


Session Swings
Opening statement
A neutral statement of how the player's results vary session to session, plus how their play shifts within a session. Plain — sessions range from {worst} to {best}, you play {X} on average when up vs {Y} when down. No target, no judgment.
Interrogation
Runs across five dimensions: session result (winning vs losing vs break-even), within-session state (fresh vs deep), running stack (up significantly, down significantly, near starting), streak (after a big win, big loss, or steady stretch), and session length (short vs long). All dimensions evaluated together. Findings grouped into one coherent statement.
Branches per dimension
Coherent shift. Play shifts in a sensible direction along the dimension. State the direction.
Flat. No notable change along the dimension.
Volatile or incoherent. Variation without a sensible direction.
Impact
Finding
Statement
Plays looser when losing
You loosen up when you are down, which usually means trying to win it back. The hands you add are not the ones that win pots, and the discipline you had earlier in the session goes with them.
Plays tighter when losing
You tighten up when you are down, which protects you from compounding losses but also means you stop finding spots when opponents are at their loosest.
Plays looser when winning
You loosen up when you are ahead, treating your winnings as house money. The looseness costs back what you built up.
Plays tighter when winning
You tighten up when you are ahead, locking in profits. Disciplined but means you stop pressing when opponents are giving up chips.
More aggressive when losing
You raise and bet more often when you are down. The aggression is reactive, not strategic, and opponents pick up on it.
More passive when losing
You check and call more often when you are down. You are playing scared, not solving the spots, and giving up initiative when you most need it.
Decline within session
Your play gets worse the longer you sit. Concentration, discipline, or both are dropping. Shorter sessions recover more value than any technical fix.
Steady within session
Your play holds across the length of a session. Concentration and discipline are not a leak.
Plays differently when stack is deep vs shallow
Stack depth changes your decisions. Whether that is correct adaptation or unwanted drift depends on the direction.
After a big loss, play shifts notably
Big losses change the next stretch of play. You are carrying the loss into the next hands, which is the textbook tilt pattern.
After a big win, play shifts notably
Big wins change the next stretch of play. Confidence is loosening you up, or caution is tightening you. Either way, the previous hand is shaping the next one.
Long sessions perform worse than short ones
Your win rate drops as sessions get longer. The chips you earn in the first stretch are being given back later. Cap your sessions where the curve turns.
Long sessions perform same as short ones
Session length is not affecting your results. No fatigue leak here.

So what
Combination
Statement
Plays looser when losing + more aggressive when losing + decline within session
You tilt. When sessions go badly, you loosen up and start swinging, and the longer you sit the worse it gets. The fix is not technical, it is leaving the table earlier.
Plays looser when losing + steady within session
You react to losing by widening your range, but your play does not collapse beyond that. Recognise the pattern in the moment and hold your starting range when you are down.
Plays tighter when winning + plays looser when losing
Your range is upside down. You should be pressing when running good and not chasing when running bad, and you are doing the reverse. Tighten when down, widen when up.
Decline within session + long sessions perform worse
Session length is the leak. The longer you play, the worse you play, and the worse you do. Cap session length, or take real breaks before the curve turns.
After a big loss, play shifts notably + plays looser when losing
You carry losses into the next stretch and widen your range with them. The hand that just happened is shaping the next one. Force yourself to reset before continuing.
Plays tighter when losing + more passive when losing
You shrink when down. The defensive shell protects the stack but stops finding the spots that recover it. Look for spots to push, not just spots to fold.
Long sessions perform same as short + steady within session + flat across session result
Your game is not shifting with state. Session swings are not the story to spend time on right now.
Plays differently when stack is deep vs shallow + win rate down at one of them
Stack depth is exposing a leak. The depth you are losing at is where the work needs to go, not the depth you are winning at.
After a big win, play shifts notably + plays looser when winning
You loosen up after winning hands. Confidence is widening your range when you should be holding it. The win does not change the spot, but it is changing how you play it.


Showdown section
Showdown covers what happens when hands reach the river and the player commits to a result. The unit of analysis is the showdown event and the hand-end outcome, not the decision point. The section asks three questions: how often the player gets to showdown, how often they win when they do, and how their winnings are split between hands shown down and hands won without showdown.
Branches are gated by comparative P&L on the relevant slice. MIN_CELL volume required.

13.1 Story: Going to Showdown
Opening statement
"You see X% of flops go to showdown. Across N showdown events, net P&L is $Z."
Pillar 1: WTSD frequency
Metric: WTSD (Went To ShowDown) percentage, aggregated and by position. P&L slice: P&L on hands reaching showdown vs hands folded pre-showdown, within the same starting-hand cohorts where possible.
| Leak: WTSD above 30% + showdown P&L per hand meaningfully below non-showdown P&L per hand "You go to showdown at X%, above the 24-30% target band. Hands you take to showdown are returning $A per hand against $B per hand for hands you fold earlier. You are paying to see opponents' hands when the math says fold." | | Leak: WTSD below 24% + the showdowns you reach profit meaningfully more than the average non-showdown outcome "You go to showdown at X%, below target. The showdowns you do reach profit $A per hand. You are folding hands that would have won." | | Monitor: WTSD off target + P&L holds "WTSD is off target but the outcomes are not punishing it. Worth watching." | | Play problem: WTSD on target + showdown P&L poor "Your showdown frequency is fine but the showdowns themselves are losing. The selection is right; the hands you arrive with are wrong." | | Silent otherwise. |
Pillar 2: WTSD by position
Metric: WTSD split by position (in position vs out of position). P&L slice: P&L on showdowns IP vs OOP within the same cohort.
| Leak: WTSD OOP meaningfully higher than IP + OOP showdowns lose meaningfully more than IP showdowns "You go to showdown more often out of position than in position. OOP showdowns lose $A per hand; IP showdowns profit $B. Out of position you cannot control the pot size, and getting to showdown there costs more." | | Leak: WTSD IP below target + IP showdowns profitable "Your in-position WTSD is X%. The IP showdowns you do reach profit meaningfully. You are giving up profitable spots where you have positional control of the pot." | | Silent otherwise. |
Pillar 3: WTSD by pot size at the river
Metric: WTSD frequency split by river pot size bands (small, medium, large). P&L slice: P&L on showdowns in each band.
| Leak: WTSD in large pots above target + large-pot showdowns lose meaningfully "In large pots you reach showdown at X%. Large-pot showdowns lose $A per hand. Opponents inflate pots with strong hands; getting there often means paying off." | | Leak: WTSD in small pots below target + small-pot showdowns profit "In small pots your WTSD is X%. Small-pot showdowns profit. Folding cheap rivers to small bets gives up hands that win the showdown." | | Silent otherwise. |
Impact
| WTSD high overall + OOP leak + large-pot leak "You are reaching showdown too often, in the worst spots, in the biggest pots. Every dimension is compounding: more showdowns, more out of position, more expensive." | | WTSD low overall + showdowns profitable "You are folding rivers that would have won. The discipline is overcorrecting." |
So what
| WTSD high + losing "Fold more rivers. The hands you are arriving with do not have the equity to justify the chips it costs to see them through. Tighten continuation on turn and river with marginal holdings." | | WTSD low + winning "Call more rivers in the spots where you are currently folding. Your read on when to continue is too tight; the showdowns you reach are profitable, which means more would also be." | | OOP showdowns losing "Cut continuation out of position on turn and river. The pot-control problem makes OOP showdowns more expensive than the same hand strength would be in position." |

13.2 Story: Winning at Showdown
Opening statement
"When you reach showdown you win X% of the time. Across N showdowns, net showdown P&L is $Z."
Pillar 1: WSD frequency
Metric: WSD ($Won at ShowDown) percentage. P&L slice: P&L on showdowns where the player won vs lost; comparative against a cohort benchmark for the player population.
| Leak: WSD below 50% + showdown P&L net negative meaningfully below break-even "You win X% of showdowns. WSD below 50% means you are arriving at the river with second-best hands more often than not. Net showdown P&L is $A negative." | | Leak: WSD above 60% + WTSD also low This is the inverse: very high WSD often means the player only gets to showdown with monster hands and folds everything else, missing pots they would have won. "You win X% of showdowns but reach showdown only Y%. You are only showing down nuts; the times you fold the river, you may be folding winners." | | Silent: WSD in 50-60% band + showdown P&L positive No reading. |
Pillar 2: WSD by hand strength at the river
Metric: WSD split by hand strength at river (premium made hand, strong made hand, marginal made hand, missed draw, air). P&L slice: P&L on showdowns by river hand strength.
| Leak: WSD with marginal made hands above 40% + marginal-hand showdowns profit "You win X% of showdowns with second pair or weaker. That portion of showdowns profits. You are correctly bluff catching with marginal hands at the river." Note: this is the rare 'good' branch, included for completeness. | | Leak: WSD with marginal made hands below 30% + marginal-hand showdowns lose meaningfully "Showdowns with second pair or weaker win X% and have lost $A per hand. You are calling rivers with hands that cannot beat a value-betting range." | | Leak: WSD with missed draws above 0% only if you are bluffing successfully at showdown — not a standard fire pattern Skip; this is captured better in non-showdown winnings. | | Silent otherwise. |
Pillar 3: WSD by opponent count
Metric: WSD heads-up vs multiway showdowns. P&L slice: P&L on heads-up vs multiway showdowns.
| Leak: WSD multiway below 30% + multiway showdowns lose meaningfully "You win X% of multiway showdowns. Multiway showdowns lose $A per hand. Multiway pots demand stronger hands to win; arriving with one pair in a three-way pot rarely works." | | Leak: WSD heads-up below 45% + heads-up showdowns lose "You win X% of heads-up showdowns. Below 45% heads-up means your river-calling range is too wide for the bets being made." | | Silent otherwise. |
Impact
| WSD low overall + marginal-hand showdowns losing + multiway showdowns losing "You are showing up at showdown with hands that cannot beat the ranges of opponents who bet into you. The pattern is consistent: too wide on turn and river, too willing to call down with showdown value that does not actually beat bets." | | WSD high but WTSD low "Your showdowns win because you only get there with the goods. The cost is in the river folds you made along the way; some of those would have won." |
So what
| WSD low + marginal hands losing "Cut marginal hands from your river-calling range. Second pair gets there only when opponents are bluffing; in this sample they are not." | | WSD low + multiway losing "Tighten continuation in multiway pots. Strong made hands only. Marginal hands check or fold." | | WSD high + WTSD low "Widen your river continuation in the spots where you are currently folding strong holdings. You are only showing down monsters; lower the threshold." |

13.3 Story: Showdown vs Non-Showdown Winnings
Opening statement
"Your winnings split: $A from hands that reached showdown, $B from hands won without showdown. Total: $Z."
This story diagnoses the overall shape of how the player makes money. There are three patterns that map to player types: showdown-heavy (calling station / passive), non-showdown-heavy (aggressive bettor), and balanced.
Pillar 1: split direction
Metric: ratio of showdown winnings to non-showdown winnings. P&L slice: aggregate split.
| Leak: non-showdown winnings strongly negative + showdown winnings carrying the player + overall profit modest or negative "Your non-showdown line is losing $A. Your showdown winnings of $B are subsidising it. Hands you don't get to showdown on are costing money — you are betting and being called or raised off pots without seeing the river." | | Leak: showdown winnings strongly negative + non-showdown winnings carrying the player + overall profit modest or negative "Your showdown line loses $A. Your non-showdown winnings of $B are subsidising it. You make money when opponents fold but lose money when they do not. The bluffs work; the value hands do not extract." | | Healthy: both positive "Both lines profit. You win when you show down and you win when you don't. This is the structural shape of a profitable player." | | Both negative "Both lines are losing. The leak is not in one area; it is across the game. Refer to position, range, and cards sections for where the bleeding is happening." |
Pillar 2: non-showdown winnings by aggression line
Metric: non-showdown P&L split by aggressive vs passive lines. P&L slice: P&L on hands won without showdown split by whether the player was the aggressor or the passive party.
| Leak: non-showdown winnings negative + losing on aggressive lines (c-bets, barrels, raises) that don't get folds "You are betting and not getting folds. The aggressive line costs $A per hand on hands that don't reach showdown. Opponents are calling or raising and you are giving up before the river." | | Healthy: non-showdown winnings positive + aggressive lines profitable "Your aggressive lines win pots without showdown. Fold equity is real for you." | | Silent otherwise. |
Pillar 3: showdown winnings by river action
Metric: showdown P&L split by whether the player was the river bettor, river caller, or river checker. P&L slice: P&L on showdowns split by river action.
| Leak: showdown winnings negative + river-call line losing meaningfully "You lose $A on showdowns where you called the river. Your call-down range is wider than the bets are bluffing. Most river bets in this sample are value." | | Leak: showdown winnings negative + river-bet line losing (i.e. value betting into better hands) "You lose $A on showdowns where you bet the river. You are value-betting hands that are not actually best at the river." | | Healthy: showdown winnings positive + river bets profit "Your river value bets get called by worse. Value extraction is working." | | Silent otherwise. |
Impact
| Non-showdown losing + showdown carrying "You are a profitable showdown player and an unprofitable bettor. The instinct to bet is there; the execution is leaking. Cut bets that don't get folds." | | Showdown losing + non-showdown carrying "You are a profitable aggressor and an unprofitable caller. Your bluffs work; your hero calls don't. Tighten what you take to showdown when you are not the aggressor." | | Both losing "The diagnosis here is not enough. Look across position, cards, and streets sections to find which combinations of seat and street are doing the damage." |
So what
| Non-showdown negative + aggressive lines losing "Fewer c-bets and barrels, especially in spots where opponents are calling. Pick bluff spots where folds are likely: dry boards, heads up, in position. The current pattern is betting into ranges that don't fold." | | Showdown negative + river calls losing "Tighten river call-downs. Your bluff-catching frequency is wider than opponents are bluffing. Without the bluffs in their range, your calls are paying off value." | | Both healthy "Keep playing. Both income streams are working." |
Players section
Players covers how the hero performs against opponents. The section has two subsections: playstyle stories (five) that aggregate across all opponents classified into a given type, and specific-opponent stories (two) that look at named villains the hero plays repeatedly.
Opponents are classified into playstyle types using VPIP and aggression frequency:
TAG: low VPIP (18-25%), high aggression (2.0+ AF)
LAG: high VPIP (28-40%), high aggression (2.5+ AF)
Nit: very low VPIP (<18%), low aggression (<1.5 AF)
Calling Station: high VPIP (28%+), low aggression (<1.0 AF)
Maniac: very high VPIP (40%+), very high aggression (3.0+ AF)
Classification requires 50+ hands per opponent. Opponents below this threshold are unclassified and excluded from playstyle aggregates. Specific-opponent stories require 30+ hands per opponent.
Branches are gated by comparative P&L. MIN_CELL volume required on the flagged slice.

14.1 Story: Versus TAGs
Opening statement
"Against TAGs you have played N hands across M classified opponents. Net P&L vs TAGs is $Z."
TAGs are tight and aggressive. Their opens are strong; their bets are credible; their bluffs are infrequent. Beating them requires respecting their ranges, picking spots to apply pressure when they show weakness, and not paying off their value.
Pillar 1: respecting their preflop ranges
Metric: hero's call/3-bet frequency facing a TAG open vs facing other opens. P&L slice: P&L on hands where hero called or 3-bet a TAG open vs the same actions against non-TAG opens.
| Leak: hero calls TAG opens at the same rate as non-TAG opens + TAG-call P&L meaningfully below non-TAG-call P&L "You call TAG opens at X%, the same rate as you call wider opens. Calls against TAGs profit $A per hand against $B per hand for calls against the average opener. Their range is stronger and your equity is worse." | | Leak: hero 3-bets TAGs at the same rate as everyone else + 3-bets vs TAG losing meaningfully "Your 3-bet frequency does not adjust to TAG opens. 3-bets vs TAG cost $A per hand against $B vs non-TAG. TAGs 4-bet light enough to punish wide 3-bets, and their flat-call range is strong enough that you play dominated postflop." | | Silent otherwise. |
Pillar 2: not paying off their value
Metric: hero's call frequency facing TAG bets on turn and river. P&L slice: P&L on call-down lines vs fold lines facing TAG aggression on turn/river.
| Leak: river call frequency vs TAG above 50% + call lines lose meaningfully "You call rivers against TAGs at X%. Call lines lose $A per hand; folds avoid the loss. TAGs rarely bluff rivers. Calling is paying off." | | Leak: turn call frequency vs TAG above 60% + call lines lose State P&L. | | Silent otherwise. |
Pillar 3: pressuring their weakness
TAGs check-fold a lot when they miss. Picking those spots is where money comes from against them. Metric: hero's bet/raise frequency when TAG checks to them on flop or turn. P&L slice: P&L on aggressive lines vs passive lines when TAG checks to hero.
| Leak: bet frequency when TAG checks to hero below 60% + bet lines profit meaningfully more than checks "When TAGs check to you, you bet X%. Bet lines profit $A per hand; check-back lines profit $B. TAGs check what they intend to fold. You are not collecting the free money." | | Silent otherwise. |
Impact
| All three pillars firing "TAGs are the most beatable opponents at the table because they play predictably. Calling their bets, 3-betting their opens without adjustment, and not pressuring their checks turns a profitable matchup into a losing one." |
So what
| Calling rivers vs TAG + losing "Fold more rivers against TAGs. Their river bets are value at a much higher rate than the table average." | | Not pressuring checks + missed profit "Bet flops and turns when TAGs check to you. Their check means they missed; your bet takes the pot." |

14.2 Story: Versus LAGs
Opening statement
"Against LAGs you have played N hands across M classified opponents. Net P&L vs LAGs is $Z."
LAGs are loose and aggressive. They open wide, bet often, and apply pressure on every street. Beating them requires tightening up, not escalating into their aggression, and being willing to call down with hands you would fold against tighter opponents.
Pillar 1: tightening preflop
Metric: hero's open/call/3-bet frequency in pots where a LAG is yet to act vs pots without a LAG. P&L slice: P&L on hands played to flop with a LAG involved vs without.
| Leak: hero plays the same width with a LAG yet to act as without + multi-way-with-LAG P&L meaningfully below same-spot P&L without LAG "You play the same width when a LAG is behind you. Hands going to flop with a LAG involved have lost $A per hand against $B for the same spots without one. LAGs will 3-bet you and play postflop aggressively. Your range needs to be stronger to handle that." | | Silent otherwise. |
Pillar 2: not escalating into their aggression
LAGs want a war. Bluff-raising them and re-bluffing usually loses because they have wider continuing ranges than tight opponents. Metric: hero's raise frequency facing a LAG bet. P&L slice: P&L on raise lines vs call lines vs fold lines facing LAG aggression.
| Leak: raise frequency facing LAG bet above 15% + raise lines lose meaningfully more than calls "You raise LAG bets at X%. Raise lines lose $A per hand; calls return $B. LAGs do not fold to raises at the rate tighter opponents do. Raising them as a bluff usually fails." | | Silent otherwise. |
Pillar 3: calling wider with showdown value
Against LAGs, marginal made hands have more value because LAGs bluff more. Metric: hero's fold frequency facing river bets vs LAG. P&L slice: P&L on river call lines vs fold lines facing LAG aggression.
| Leak: river call frequency vs LAG below 35% + call lines profit meaningfully more than folds (i.e. the calls catch bluffs) "You fold rivers against LAGs at X%. The calls you make profit $A per hand. LAGs bluff rivers more than the table average; you are folding into their bluffs." | | Leak: hero plays vs LAG identically to vs TAG + LAG P&L meaningfully below TAG P&L "Your line against LAGs matches your line against TAGs. They are different opponents. LAG-call lines should be wider, LAG-raise lines tighter." | | Silent otherwise. |
Impact
| Pre-flop too wide + raising their bluffs + folding to their bluffs "You are playing LAGs in exactly the wrong direction: loose where you should tighten, aggressive where you should call, passive where you should call. The whole posture is inverted." |
So what
| Folding rivers vs LAG + missed catches "Call more rivers against LAGs. The catches profit because they bluff often. Treat LAG rivers as a different bet than TAG rivers." | | Raising LAG bets + losing "Stop raising LAG bets as bluffs. They will call or 3-bet you. Reserve raises for value." |

14.3 Story: Versus Nits
Opening statement
"Against nits you have played N hands across M classified opponents. Net P&L vs nits is $Z."
Nits play very tight and very passive. When they bet, they have it. When they don't, they fold to pressure. Beating them is about stealing their blinds, folding when they show interest, and not paying off their rare value.
Pillar 1: stealing from them
Metric: hero's open/steal frequency when a nit is in the blinds. P&L slice: P&L on steals where a nit is in the blinds vs non-nit blinds.
| Leak: hero opens at the same rate with a nit in the blinds + nit-blind P&L meaningfully below non-nit-blind P&L because nit blinds aren't being stolen as much as they should This branch fires inversely: when stealing wider against nits would profit more but isn't happening. Required slice: hero's open frequency when nit is in BB vs when non-nit is in BB. "You open at X% with a nit in the blinds, the same as when a non-nit is in the blinds. Nit blinds fold to opens at much higher rates. The steals you do make against nit blinds profit $A per hand." | | Silent otherwise. |
Pillar 2: folding when they show interest
Nits don't bet without a hand. If they bet, fold unless you have something strong. Metric: hero's call frequency facing a nit bet on flop/turn/river. P&L slice: P&L on call-down lines vs fold lines facing nit aggression.
| Leak: call frequency facing nit bet above 30% on any street + call lines lose meaningfully "You call nit bets at X% on [street]. Call lines lose $A per hand. When nits bet they have it. Calling is paying off." | | Silent otherwise. |
Pillar 3: not paying off their 3-bets
Nit 3-bets are QQ+/AK. Almost nothing else. Metric: hero's call/4-bet frequency facing a nit 3-bet. P&L slice: P&L vs nit 3-bets by response.
| Leak: call frequency facing nit 3-bet above 30% + call lines lose meaningfully "You call nit 3-bets at X%. Calls lose $A per hand. Nit 3-bets are the tightest 3-betting range at the table." | | Silent otherwise. |
Impact
| Under-stealing + paying off their bets + paying off their 3-bets "Nits are the easiest opponents at the table to extract from preflop and the hardest to extract from postflop. Doing the inverse — letting them keep their blinds and paying them off when they bet — is the worst possible matchup posture." |
So what
| Under-stealing nit blinds "Open wider with a nit in the blinds. Any two reasonable cards from late position. They will fold." | | Paying off nit bets "Fold to nit bets unless you have a strong hand. Their range is the strongest at the table." |

14.4 Story: Versus Calling Stations
Opening statement
"Against calling stations you have played N hands across M classified opponents. Net P&L vs calling stations is $Z."
Calling stations play loose and passive. They call too much and bet too little. Beating them is about value-betting thin, cutting bluffs entirely, and sizing up for value because they don't fold.
Pillar 1: cutting bluffs
Metric: hero's bluff frequency (bets without showdown value) facing or initiating action with a calling station in the hand. P&L slice: P&L on bluff lines vs check lines when a calling station is in the hand.
| Leak: bluff frequency vs calling station above 15% + bluff lines lose meaningfully "You bluff into calling stations at X%. Bluff lines lose $A per hand against $B for check lines. Calling stations call. Bluffing them is donating chips." | | Silent otherwise. |
Pillar 2: value betting thinner
Metric: hero's bet frequency with marginal made hands (second pair, weak top pair) against calling stations. P&L slice: P&L on thin-value bet lines vs check lines vs calling stations.
| Leak: bet frequency with marginal made hands vs calling station below target + bet lines profit meaningfully more than checks "You bet marginal made hands against calling stations at X%. Bet lines profit $A per hand; check lines profit $B. Calling stations call with worse hands than you would expect. Top pair weak kicker is a value bet, not a bluff catch." | | Silent otherwise. |
Pillar 3: sizing up for value
Calling stations don't fold to big bets the way tighter opponents do. Value bets can size up significantly. Metric: hero's bet size as fraction of pot for value bets against calling stations vs against others. P&L slice: P&L by bet size against calling stations.
| Leak: bet size against calling stations same as against others + larger sizes vs calling stations profit meaningfully more "Your sizing against calling stations matches your sizing against other types. Larger bets against calling stations profit $A per hand more than smaller ones. They call almost regardless of size." | | Silent otherwise. |
Impact
| Bluffing + thin value missed + sizing flat "Calling stations are the most profitable opponent type when played correctly: no bluffs, more thin value, bigger sizing. You are doing the opposite." |
So what
| Bluffing into stations + losing "Cut bluffs entirely against calling stations. They cannot fold. Bet only when you can win at showdown." | | Thin value missed "Bet thinner against calling stations. Top pair weak kicker, second pair good kicker, even ace high in some spots. They will call with worse." | | Sizing flat "Size up against calling stations. They call 2/3 pot at almost the same rate as 1/2 pot." |

14.5 Story: Versus Maniacs
Opening statement
"Against maniacs you have played N hands across M classified opponents. Net P&L vs maniacs is $Z."
Maniacs play very wide and very aggressive. They bet, raise, and re-raise with weak hands. Beating them is about waiting for hands, calling down wide, and letting them hang themselves.
Pillar 1: letting them bluff
Metric: hero's bet frequency when in a hand with a maniac vs check frequency. P&L slice: P&L on hero-bet lines vs hero-check lines when maniac is in the hand.
| Leak: hero leads/c-bets at normal frequency vs maniacs + bet lines profit meaningfully less than check lines (because checks induce maniac bluffs) "You bet into maniacs at X%, similar to your overall bet frequency. Check lines vs maniacs profit $A per hand; bet lines profit $B. Maniacs will bet for you. Checking with strong hands induces bigger pots than betting does." | | Silent otherwise. |
Pillar 2: calling down wider
Maniac bets are weak more often than any other type's. Marginal hands have more value because maniacs bluff so much. Metric: hero's call frequency facing maniac bets on turn and river. P&L slice: P&L on call lines vs fold lines facing maniac aggression.
| Leak: river call frequency vs maniac below 50% + call lines profit meaningfully more than folds "You fold rivers against maniacs at X%. The calls you make profit $A per hand. Maniacs bluff rivers far more often than the table average; your fold rate is too high for this opponent." | | Silent otherwise. |
Pillar 3: not getting drawn into their aggression
The trap with maniacs is escalating into their bluffs with hands that can't withstand a 4-bet or shove. Strong hands trap better than aggressive plays. Metric: hero's 3-bet/raise frequency facing maniac action with marginal hands. P&L slice: P&L on raise/3-bet lines vs flat-call lines facing maniac aggression with marginal hands.
| Leak: 3-bet frequency vs maniac open above 12% with non-premium hands + 3-bet lines lose meaningfully "You 3-bet maniacs at X% with hands outside the premium range. 3-bet lines lose $A per hand against $B for flat-call lines. Maniacs 4-bet light. 3-betting them light invites a 4-bet you cannot handle." | | Silent otherwise. |
Impact
| Betting into them + folding to them + 3-betting them light "Maniacs profit from opponents who try to match their aggression. The winning posture is the opposite: trap with strong hands, call down with marginal ones, fold the in-between hands rather than 3-bet them." |
So what
| Betting into maniacs + losing to checks profiting "Check strong hands against maniacs. Let them bet. They will." | | Folding rivers vs maniac "Call rivers wider against maniacs. Their bluff frequency makes second pair a profitable call." | | 3-betting light vs maniac "Flat-call maniac opens with hands you would 3-bet against TAGs. Save 3-bets for premiums where you can stack off." |

14.6 Story: Profitable Opponents
Opening statement
"You profit against N classified opponents with 30+ hands each. Total profit from these opponents: $Z."
This story diagnoses the pattern across opponents you beat. The question is whether the wins are concentrated in one type of opponent (suggesting you're well-matched for that profile) or spread (suggesting consistent edge).
Pillar 1: classification of profitable opponents
Metric: distribution of profitable opponents across playstyle types. P&L slice: P&L per playstyle aggregated only across opponents where hero is in profit.
| Pattern: profits concentrated in one playstyle "Your profits come predominantly from [playstyle], where you have made $A across N opponents. You are well-matched against this type." | | Pattern: profits spread across types "Your profits are distributed across opponent types. You have a consistent edge rather than a type-specific one." | | Silent otherwise. |
Pillar 2: source of profit
Metric: showdown vs non-showdown winnings against profitable opponents. P&L slice: split of profit by showdown vs non-showdown line.
| Pattern: profits primarily non-showdown "You beat these opponents by winning pots without showdown. Your aggression works against them; they fold under pressure." | | Pattern: profits primarily showdown "You beat these opponents at showdown. You show down better hands than they do." | | Pattern: balanced "Your profits split evenly between showdown and non-showdown. You win pots both ways against these opponents." |
Pillar 3: replicability
Metric: whether the conditions of profit (position, stack depth, seat count) are replicable. P&L slice: P&L vs profitable opponents split by context.
| Pattern: profits driven by specific contexts (e.g. heads-up only, deep stacks only) "Profits against these opponents are concentrated in [context]. The matchup is profitable in the right conditions; the same opponents may not be profitable in different contexts." | | Pattern: profits across contexts "Profits against these opponents hold across positions, stack depths, and seat counts. The edge is structural." |
Impact
| Concentrated profits in one type + non-showdown driven "Your edge is type-specific and aggression-driven. It scales when you can find more of that opponent type and applies less well elsewhere." | | Spread profits across types + balanced source "Your edge is general. Whatever you are doing works across opponent profiles." |
So what
| Profits concentrated in [type] + non-showdown driven "Seek tables with more [type] opponents. Your aggression works against them. Avoid tables dominated by [opposite type]." | | Profits spread + balanced "Keep playing. Your edge is not dependent on opponent type, which means it scales with volume." |

14.7 Story: Unprofitable Opponents
Opening statement
"You lose against N classified opponents with 30+ hands each. Total losses to these opponents: $Z."
This story diagnoses the pattern across opponents you lose to. Unlike profitable opponents, the so-what here is closer to risk management: avoid the matchup, change how you play it, or accept it as a long-term study target.
Pillar 1: classification of unprofitable opponents
Metric: distribution of unprofitable opponents across playstyle types. P&L slice: P&L per playstyle aggregated only across opponents where hero is at a loss.
| Pattern: losses concentrated in one playstyle "Your losses come predominantly from [playstyle], where you have lost $A across N opponents. This matchup is consistently negative for you." | | Pattern: losses concentrated specifically in maniacs or LAGs Common pattern. "Aggressive opponents are taking money from you. The pattern suggests you are not adjusting to their wider ranges." | | Pattern: losses concentrated in TAGs or nits Different problem. "Tight opponents are taking money from you. The pattern suggests you are paying off their value or failing to steal from them." | | Silent otherwise. |
Pillar 2: source of losses
Metric: showdown vs non-showdown losses against unprofitable opponents. P&L slice: split of losses by line.
| Pattern: losses primarily showdown "You lose to these opponents at showdown. You arrive at the river with worse hands and pay them off." | | Pattern: losses primarily non-showdown "You lose to these opponents without showdown. Your bets are not getting through; their bets are taking pots from you." | | Pattern: both lines losing "Both showdown and non-showdown lines lose against these opponents. The matchup is bad across the board." |
Pillar 3: position and context
Metric: P&L vs unprofitable opponents split by position and stack depth. P&L slice: same.
| Pattern: losses concentrated when out of position to them "Losses against these opponents come primarily from spots where you are out of position. The positional disadvantage compounds whatever else is going wrong." | | Pattern: losses concentrated in deep-stack play "Losses against these opponents come primarily from deep-stack pots. The variance of deep play is exposing the matchup leak." | | Pattern: losses across contexts "Losses against these opponents hold across positions and stack depths. The leak is in the matchup itself, not a specific context." |
Impact
| Losses to aggressive types + non-showdown driven + out of position "Aggressive opponents in position against you are running the table. Your line is folding too often to their bets and losing the pots without showdown." | | Losses to tight types + showdown driven "Tight opponents are getting value from you. You are calling their bets when they have it." | | Losses across types + across contexts "The losses are not matchup-specific. Refer to position, cards, and showdown sections for where the structural leak is, because no opponent type is helping you." |
So what
| Losses to one type concentrated "Either avoid tables dominated by [type] or change how you play them. Review the relevant playstyle story for the specific adjustments." | | Losses out of position "Cut hands you would play in position when out of position against these opponents. The matchup is bad enough that the positional cost cannot be absorbed." | | Losses across types and contexts "The opponent isn't the problem. Look at position, range, and cards for what is leaking regardless of who you face." |
Tables section
Tables covers which tables the player makes money at and which they lose at. The unit is the table as a whole, not individual opponents (which belong in Players). The two stories interrogate the P&L picture by table and whether the player is staying at the right ones long enough or the wrong ones too long.
Tables has two stories: Table Selection and Time at Table.

Table Selection
Opening statement
A neutral statement of the player's P&L by table across their tracked history. Plain — your most profitable table is X, your worst is Y, your overall spread across tables is Z. No target, no judgment.
Interrogation
Runs across four dimensions: P&L per table, hands played per table, win rate per table, and table characteristics (size, stake, average stack). All dimensions evaluated together. Findings grouped into one coherent statement.
Branches per dimension
Coherent pattern. A consistent shape along the dimension. State the pattern.
Flat. No notable variation.
Scattered or incoherent. Variation without a sensible direction.
Impact
Finding
Statement
Most volume at profitable tables
You are putting your hands where they win. Table selection is working for you.
Most volume at losing tables
You are spending most of your time at tables where you lose. The selection is upside down: the games that beat you are the ones you keep sitting at.
Volume spread evenly regardless of P&L
You play the same volume everywhere, ignoring which tables make money. Selection is not part of your game. The profitable tables are getting the same share of your time as the losing ones.
High win rate on low-volume tables
The tables you win at most, you barely play. You have found edges and walked away from them. Put more volume where you are winning.
Low win rate on high-volume tables
The tables you play most, you win at least. Whatever is keeping you at these tables is costing you. Move volume away from them.
Profitable on small tables, losing on big ones (or vice versa)
Your edge depends on table size. The size where you lose is the one to either drop or work on; the size where you win is where the volume should go.
Profitable at one stake, losing at another
Your edge varies by stake. The stake where you lose is either above your current game or below the level of attention you give it.
One table dominates P&L
Your results are being driven by a single table. Whether good or bad, the picture is not the average game, it is one specific environment. Worth understanding what makes that table different.
P&L spread evenly
No standout winners or losers. Your game travels evenly across tables, which means table selection is not the lever to pull right now.

So what
Combination
Statement
Most volume at losing tables + low win rate on high-volume tables
You are doubling down on the games that beat you. The fix is the easiest in poker: stop sitting at those tables, start sitting at the ones you win at.
Most volume at profitable tables + high win rate on low-volume tables
Selection is good but you are leaving edges on the floor. The tables you win at most should get more of your time, not less.
Profitable on small tables, losing on big ones
Your game works at one size and breaks at the other. Either drop the bigger size or work on what is failing there. Do not split volume evenly between them.
Profitable on big tables, losing on small ones
Same shape, opposite direction. The small tables are leaking, and there is no reason to keep playing them when the bigger ones work.
Profitable at one stake, losing at another
Pick the stake where you have an edge and put your volume there. The losing stake is not a development opportunity unless you are deliberately working on it.
One table dominates P&L (winning)
A single table is carrying your results. The general picture of your game is not as strong as the headline number. Find what makes that table different and look for similar ones.
One table dominates P&L (losing)
A single table is dragging your results. Without it, your game looks fine. Drop the table.
Volume spread evenly + P&L spread evenly
Selection is not the story. Your game is roughly the same wherever you sit. The leak is elsewhere.
Most volume at losing tables + high win rate on low-volume tables
You are at the wrong tables. The data already tells you which ones to move to: the ones you barely play and win at.



