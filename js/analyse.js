// ── ANALYSE (pure data-in/data-out) ───────────────────────────────────────────

function analyse(hands) {
  const n = hands.length;
  const posMap = {};
  const htMap = {};
  const rangeMap = {};

  const ss = {
    Preflop: { seen: 0, f: 0, ch: 0, ca: 0, ra: 0 },
    Flop:    { seen: 0, f: 0, ch: 0, ca: 0, ra: 0 },
    Turn:    { seen: 0, f: 0, ch: 0, ca: 0, ra: 0 },
    River:   { seen: 0, f: 0, ch: 0, ca: 0, ra: 0 },
  };

  let handsWon = 0;
  let handsWithOutcome = 0;
  let totalWonAmount = 0;
  let totalInvested = 0;

  let folds = 0;
  let checks = 0;
  let calls = 0;
  let raises = 0;
  let totalActs = 0;

  const betAmts = {
    Preflop: [],
    Flop:    [],
    Turn:    [],
    River:   [],
  };

  const betOpps = {
    Preflop: { b: 0, t: 0 },
    Flop:    { b: 0, t: 0 },
    Turn:    { b: 0, t: 0 },
    River:   { b: 0, t: 0 },
  };

  let facedAllin = 0;
  let foldAllin = 0;
  let callAllin = 0;
  let wonAllin = 0;

  let faced3bet = 0;
  let fold3bet = 0;
  let vpip = 0;

  for (const h of hands) {
    const p = h.position || '?';
    const cash = isCashHand(h);
    if (!posMap[p]) {
      posMap[p] = {
        hands: 0,
        vpip: 0,
        foldPre: 0,
        won: 0,
        pot: 0,
        pnl: 0,
      };
    }
    posMap[p].hands++;
    if (cash) posMap[p].pot += h.pot || 0;

    if (h.outcome) {
      handsWithOutcome++;
      // Use stored investment if available, otherwise calculate from actions
      const invested = h.invested || calcInvestmentFromActions(h.actions || []);
      if (cash) totalInvested += invested;
      const a = h.outcome.amount || 0;
      if (h.outcome.result === 'won') {
        handsWon++;
        const profit = a - invested;
        if (cash) totalWonAmount += a;
        posMap[p].won++;
        if (cash) posMap[p].pnl += profit;
      } else {
        // folded or lost: investment is the loss
        if (cash) posMap[p].pnl -= invested;
      }
    }

    const hkey = parseHoleKey(h.hole);
    if (hkey) {
      if (!rangeMap[hkey]) {
        rangeMap[hkey] = { dealt: 0, played: 0, won: 0 };
      }
      rangeMap[hkey].dealt++;

      const acts = parseActions(h.actions);
      const myActs = acts.filter(a => a.isMe);
      const didPlay = myActs.some(a => a.type === 'call' || a.type === 'raise');
      if (didPlay) {
        rangeMap[hkey].played++;
        vpip++;
        posMap[p].vpip++;
      }
      if (didPlay && h.outcome && h.outcome.result === 'won') {
        rangeMap[hkey].won++;
      }
      const pfFold = myActs.find(a => a.street === 'Preflop' && a.type === 'fold');
      if (pfFold) posMap[p].foldPre++;

      const ht = classifyKey(hkey);
      if (!htMap[ht]) {
        htMap[ht] = { dealt: 0, played: 0, won: 0 };
      }
      htMap[ht].dealt++;
      if (didPlay) htMap[ht].played++;
      if (didPlay && h.outcome && h.outcome.result === 'won') htMap[ht].won++;
    }

    // Street-level and action stats
    const acts = parseActions(h.actions);
    const heroSeenStreets = new Set();
    let allinCountedThisHand = false;
    for (const a of acts) {
      // Only count hero actions for aggregate action stats
      if (a.isMe) {
        totalActs++;
        if (a.type === 'fold') folds++;
        else if (a.type === 'check') checks++;
        else if (a.type === 'call') calls++;
        else if (a.type === 'raise') raises++;
      }

      // Track which streets the hero reached (exclude blind posts — they don't indicate voluntary street play)
      if (a.isMe && a.type !== 'sb' && a.type !== 'bb' && !heroSeenStreets.has(a.street)) {
        heroSeenStreets.add(a.street);
        if (ss[a.street]) ss[a.street].seen++;
      }
      // Street-level action breakdown (hero only)
      if (a.isMe && ss[a.street]) {
        if (a.type === 'fold') ss[a.street].f++;
        else if (a.type === 'check') ss[a.street].ch++;
        else if (a.type === 'call') ss[a.street].ca++;
        else if (a.type === 'raise') ss[a.street].ra++;
      }

      if (a.type === 'raise' || a.type === 'bet') {
        if (a.amount > 0 && betAmts[a.street]) {
          betAmts[a.street].push(a.amount);
        }
      }

      // Bet opportunity tracking: when hero acts post-flop, count as opportunity; raises/bets count as betting
      if (a.isMe && a.street !== 'Preflop' && betOpps[a.street] && a.type !== 'sb' && a.type !== 'bb' && a.type !== 'won') {
        betOpps[a.street].t++;
        if (a.type === 'raise') betOpps[a.street].b++;
      }

      // All-in detection: opponent raise with no "to $X" in the message indicates a shove
      if (!allinCountedThisHand && !a.isMe && a.type === 'raise' && a.msg && a.msg.indexOf(' to ') === -1) {
        const heroResp = acts.filter(b => b.isMe && b.street === a.street);
        const foldResp = heroResp.find(b => b.type === 'fold');
        const callResp = heroResp.find(b => b.type === 'call' || b.type === 'raise');
        if (foldResp || callResp) {
          allinCountedThisHand = true;
          facedAllin++;
          if (foldResp) foldAllin++;
          if (callResp) {
            callAllin++;
            if (h.outcome && h.outcome.result === 'won') wonAllin++;
          }
        }
      }
    }

    // 3-bet detection (preflop raises against hero)
    const preActs = acts.filter(a => a.street === 'Preflop');
    let raiseCount = 0;
    let faced3ThisHand = false;
    for (const a of preActs) {
      if (!a.isMe && a.type === 'raise') {
        raiseCount++;
        if (raiseCount >= 2) faced3ThisHand = true;
      }
      if (faced3ThisHand && a.isMe && (a.type === 'fold' || a.type === 'call')) {
        faced3bet++;
        if (a.type === 'fold') fold3bet++;
        break;
      }
    }
  }

  return {
    n,
    posMap,
    htMap,
    rangeMap,
    ss,
    handsWon,
    handsWithOutcome,
    totalWonAmount,
    totalInvested,
    folds,
    checks,
    calls,
    raises,
    totalActs,
    betAmts,
    betOpps,
    facedAllin,
    foldAllin,
    callAllin,
    wonAllin,
    faced3bet,
    fold3bet,
    vpip,
  };
}

