// ── PER-HAND ANALYSIS (pure data, no DOM) ─────────────────────────────────────

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
      // Disambiguate by player count — pick smallest max that fits
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
