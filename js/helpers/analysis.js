// ── PER-HAND ANALYSIS (pure data, no DOM) ─────────────────────────────────────

// True if a poker-hand strength string represents a "strong" hand at showdown.
// Used by opponent-stats.js and opponent-examples.js so the keyword set lives
// in one place.
function isStrongShowdownHand(strength) {
  if (!strength) return false;
  var s = String(strength).toLowerCase();
  // 'straight flush' and 'royal flush' are caught by 'straight' / 'flush'.
  return s.indexOf('two pair') !== -1 ||
         s.indexOf('three of a kind') !== -1 ||
         s.indexOf('straight') !== -1 ||
         s.indexOf('flush') !== -1 ||
         s.indexOf('full house') !== -1 ||
         s.indexOf('four of a kind') !== -1;
}

// Get the amount the hero invested in a hand
function getInvested(h) {
  return h.invested || calcInvestmentFromActions(h.actions || []);
}

// Get hero actions from a hand (parsed + filtered)
function getHeroActions(h) {
  return parseActions(h.actions).filter(function(a) { return a.isMe; });
}

// Get a short summary string of hero actions ("call · raise · fold")
function getActsSummary(h) {
  return getHeroActions(h).map(function(a) { return a.type; }).join(' · ');
}

// Compute the real profit/loss for a hand.
// In multi-pot scenarios, a "won" hand can have negative profit (excess returned).
function getHandPnl(h) {
  if (!h.outcome) return { cls: 'u', text: '?' };
  var invested = getInvested(h);
  if (h.outcome.result === 'won') {
    var profit = (h.outcome.amount || 0) - invested;
    if (profit >= 0) return { cls: 'w', text: '+' + fmt(profit) };
    // Multi-pot: won but net negative (excess returned, lost side pot)
    return { cls: 'l', text: '-' + fmt(Math.abs(profit)) };
  }
  if (h.outcome.result === 'folded') {
    return { cls: 'l', text: invested > 0 ? '-' + fmt(invested) : 'folded' };
  }
  // lost
  return { cls: 'l', text: '-' + fmt(invested) };
}

// Numeric P&L value for a hand (positive = profit, negative = loss).
function getHandPnlValue(h) {
  if (!h.outcome) return 0;
  var invested = getInvested(h);
  if (h.outcome.result === 'won') return (h.outcome.amount || 0) - invested;
  return -invested;
}

// Infer TC table id from hand metadata and blind sizes
function inferTable(hand) {
  // Use the tableId field from TM script (e.g. "holdem21")
  if (hand.tableId) {
    const num = String(hand.tableId).replace(/\D/g, '');
    if (num && TABLE_META[num]) return Number(num);
  }
  // Fall back to hand.table if present
  if (hand.table) {
    const num = String(hand.table).replace(/\D/g, '');
    if (num && TABLE_META[num]) return Number(num);
  }
  // Fall back to bigBlind field if present
  if (hand.bigBlind) {
    const candidates = BB_TO_TABLES[hand.bigBlind];
    if (candidates && candidates.length === 1) return candidates[0].id;
    if (candidates && candidates.length > 1 && hand.tableSize) {
      const match = candidates.find(c => c.max >= hand.tableSize);
      if (match) return match.id;
    }
  }
  // Last resort: parse blind from action text
  if (hand.actions && hand.actions.length) {
    let bb = 0;
    const players = new Set();
    for (let i = 0; i < hand.actions.length; i++) {
      const line = hand.actions[i];
      // Extract big blind amount
      const bbMatch = line.match(/posted big blind \$([0-9,]+)/);
      if (bbMatch) bb = parseInt(bbMatch[1].replace(/,/g, ''), 10);
      // Count unique players from action lines (name is word chars, spaces, underscores before first colon)
      const authorMatch = line.match(/^\s*(?:>> )?([A-Za-z0-9_ -]+?):\s/);
      if (authorMatch && !authorMatch[1].startsWith('The ')) {
        players.add(authorMatch[1]);
      }
    }
    if (bb && BB_TO_TABLES[bb]) {
      const candidates = BB_TO_TABLES[bb];
      if (candidates.length === 1) return candidates[0].id;
      // Disambiguate by player count - pick smallest max that fits
      const playerCount = players.size;
      const sorted = candidates.slice().sort((a, b) => a.max - b.max);
      const match = sorted.find(c => c.max >= playerCount);
      if (match) return match.id;
      // If player count exceeds all candidates, use the largest table
      return sorted[sorted.length - 1].id;
    }
  }
  return null;
}

// True if a hand should be treated as cash game rather than tournament
function isCashHand(hand) {
  const tid = inferTable(hand);
  if (tid === null) return true; // legacy hands without table data, assume cash
  return CASH_TABLE_IDS.has(tid);
}

function getHandBB(hand) {
  var tid = inferTable(hand);
  if (tid !== null && TABLE_META[tid]) return TABLE_META[tid].bb;
  return null;
}

function getTableLabel(tableId) {
  if (!tableId || !TABLE_META[tableId]) return 'Unknown Table';
  const t = TABLE_META[tableId];
  const prefix = t.tournament ? 'T: ' : '';
  return prefix + t.name + ' (' + fmt(t.sb) + '/' + fmt(t.bb) + ')';
}

// Try to detect player name from action lines (fallback for old exports)
// Classify position into broad category for analysis
function getPositionCategory(position) {
  if (!position) return null;
  var p = position.toUpperCase().replace(/[^A-Z0-9+]/g, '');
  if (p === 'UTG' || p === 'UTG+1') return 'EP';
  if (p === 'MP' || p === 'LJ') return 'MP';
  if (p === 'HJ' || p === 'CO' || p === 'BTN') return 'LP';
  if (p === 'SB' || p === 'BB') return 'Blinds';
  return null;
}

// Bucket a hand by hero's preflop action. Returns one of:
//   'rfi'                - hero raised first in (no prior raise)
//   'vs-rfi-call'        - hero called an open raise (no 3-bet by hero)
//   'vs-rfi-3bet'        - hero 3-bet over an open raise
//   'rfi-vs-3bet-fold'   - hero opened, got 3-bet, folded
//   'rfi-vs-3bet-call'   - hero opened, got 3-bet, called
//   'rfi-vs-3bet-4bet'   - hero opened, got 3-bet, 4-bet
//   'squeeze'            - hero 3-bet after an open and at least one cold-caller
//   'limp-open'          - hero open-limped (called BB amount, no raise yet)
//   'limp-behind'        - hero limped behind one or more limpers
//   'folded-pre'         - hero folded preflop
//   'walked'             - BB folded around to (hero made no voluntary action)
function classifyPreflopAction(h) {
  if (!h || !h.actions) return null;
  if (h._preActionDone) return h._preAction;
  var result = _classifyPreflopActionUncached(h);
  h._preAction = result;
  h._preActionDone = true;
  return result;
}

function _classifyPreflopActionUncached(h) {
  var acts = parseActions(h.actions).filter(function(a) { return a.street === 'Preflop'; });
  if (!acts.length) return null;
  var heroAuthor = null;
  for (var i = 0; i < acts.length; i++) { if (acts[i].isMe) { heroAuthor = acts[i].author; break; } }
  // Hero's first voluntary action (skip blind posts, payouts, reveals).
  var firstHero = null;
  for (var i = 0; i < acts.length; i++) {
    var a = acts[i];
    if (!a.isMe) continue;
    if (a.type === 'sb' || a.type === 'bb' || a.type === 'won') continue;
    firstHero = a;
    break;
  }
  // Count raises/limps before hero's first voluntary action.
  var raisesBefore = 0;
  var callsBefore = 0;
  if (firstHero) {
    for (var i = 0; i < acts.length; i++) {
      var a = acts[i];
      if (a === firstHero) break;
      if (a.isMe) continue;
      if (a.type === 'raise' || a.type === 'bet') raisesBefore++;
      else if (a.type === 'call') callsBefore++;
    }
  }
  // No voluntary action by hero before the street ended. If hero posted BB and
  // everyone folded around, that's a walk. Otherwise hero must have folded.
  if (!firstHero) {
    var heroIsBB = acts.some(function(a) { return a.isMe && a.type === 'bb'; });
    var heroFolded = acts.some(function(a) { return a.isMe && a.type === 'fold'; });
    if (heroIsBB && !heroFolded && raisesBefore === 0) return 'walked';
    return 'folded-pre';
  }
  if (firstHero.type === 'fold') return 'folded-pre';
  // Hero opened (raise with no prior raisers).
  if (raisesBefore === 0 && (firstHero.type === 'raise' || firstHero.type === 'bet')) {
    // Did hero face a 3-bet after opening? Walk forward.
    var sawThreeBet = false;
    var heroResponse = null;
    var heroOwn3betCount = 0;
    var startedAfter = false;
    for (var i = 0; i < acts.length; i++) {
      var a = acts[i];
      if (a === firstHero) { startedAfter = true; continue; }
      if (!startedAfter) continue;
      if (!a.isMe && (a.type === 'raise' || a.type === 'bet')) sawThreeBet = true;
      if (sawThreeBet && a.isMe) {
        if (a.type === 'fold') { heroResponse = 'fold'; break; }
        if (a.type === 'call') { heroResponse = 'call'; break; }
        if (a.type === 'raise' || a.type === 'bet') { heroResponse = '4bet'; break; }
      }
    }
    if (sawThreeBet) {
      if (heroResponse === 'fold') return 'rfi-vs-3bet-fold';
      if (heroResponse === 'call') return 'rfi-vs-3bet-call';
      if (heroResponse === '4bet') return 'rfi-vs-3bet-4bet';
      return 'rfi-vs-3bet-fold';
    }
    return 'rfi';
  }
  // Hero faced a raise.
  if (raisesBefore >= 1) {
    if (firstHero.type === 'raise' || firstHero.type === 'bet') {
      // 3-bet (or squeeze if a cold-caller stepped in between the open and hero).
      if (callsBefore >= 1) return 'squeeze';
      return 'vs-rfi-3bet';
    }
    if (firstHero.type === 'call') return 'vs-rfi-call';
    return 'folded-pre';
  }
  // No raises before hero. Hero called -> limp.
  if (firstHero.type === 'call') {
    return callsBefore >= 1 ? 'limp-behind' : 'limp-open';
  }
  return null;
}

function detectPlayerFromActions(hands) {
  // First check if any hand has an explicit player field
  for (let i = 0; i < hands.length; i++) {
    if (hands[i].player && hands[i].player !== 'Unknown') {
      return hands[i].player;
    }
  }
  // Count occurrences of names from >> prefixed lines to find most common
  const nameCounts = {};
  for (let i = 0; i < hands.length; i++) {
    const actions = hands[i].actions || [];
    for (let j = 0; j < actions.length; j++) {
      const line = (actions[j] || '');
      // Check both >> prefix and HTML-encoded version
      const isMe = line.indexOf('>>') === 0 || line.indexOf('&gt;&gt;') === 0;
      if (isMe) {
        const clean = line.replace(/^(>>|&gt;&gt;)\s*/, '').trim();
        const ci = clean.indexOf(': ');
        if (ci > 0) {
          const name = clean.slice(0, ci);
          nameCounts[name] = (nameCounts[name] || 0) + 1;
        }
      }
    }
  }
  // Return the most frequently occurring name
  let bestName = null;
  let bestCount = 0;
  for (const name in nameCounts) {
    if (nameCounts[name] > bestCount) {
      bestCount = nameCounts[name];
      bestName = name;
    }
  }
  return bestName;
}
