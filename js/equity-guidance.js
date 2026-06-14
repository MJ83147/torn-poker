function getHeroStreetActions(hand) {
  var parsed = parseActions(hand.actions);
  var streets = {};
  var potRunning = 0;
  var heroFoldedOn = null;

  var streetOrder = STREETS;
  var streetActions = { Preflop: [], Flop: [], Turn: [], River: [] };

  for (var i = 0; i < parsed.length; i++) {
    var act = parsed[i];
    if (streetActions[act.street]) {
      streetActions[act.street].push(act);
    }
  }

  for (var si = 0; si < streetOrder.length; si++) {
    var st = streetOrder[si];
    var acts = streetActions[st];
    if (!acts || !acts.length) continue;
    if (heroFoldedOn) break;

    var potBefore = potRunning;
    var heroAction = null;
    var amountToCall = 0;
    var potAtHeroAction = potRunning;

    var villainAction = null;
    var lastVillainBet = null;

    var activePlayers = {};
    var foldedPlayers = {};

    var allHeroActions = [];
    for (var ai = 0; ai < acts.length; ai++) {
      var a = acts[ai];
      if (a.type !== 'won') {
        activePlayers[a.author] = true;
      }
      if (a.type === 'fold') {
        foldedPlayers[a.author] = true;
      }
      if (!a.isMe && (a.type === 'bet' || a.type === 'raise') && a.amount) {
        lastVillainBet = a;
      }
      if (a.isMe && a.type !== 'won' && a.type !== 'sb' && a.type !== 'bb') {
        allHeroActions.push({ action: a, potAtAction: potRunning, facingAction: lastVillainBet });
      }
      if (a.amount && a.type !== 'won') {
        potRunning += a.amount;
      }
      if (a.isMe && a.type === 'fold') {
        heroFoldedOn = st;
      }
    }

    var numActive = 0;
    for (var ap in activePlayers) {
      if (!foldedPlayers[ap]) numActive++;
    }

    if (allHeroActions.length > 0) {
      var picked = allHeroActions[allHeroActions.length - 1];
      for (var hi = 0; hi < allHeroActions.length; hi++) {
        if (allHeroActions[hi].action.type === 'fold') {
          picked = allHeroActions[hi];
          break;
        }
      }
      heroAction = picked.action;
      potAtHeroAction = picked.potAtAction;
      villainAction = picked.facingAction;
    }

    if (!heroAction) {
      for (var bi = 0; bi < acts.length; bi++) {
        if (acts[bi].isMe && (acts[bi].type === 'sb' || acts[bi].type === 'bb')) {
          heroAction = acts[bi];
          potAtHeroAction = potBefore;
          break;
        }
      }
    }

    if (heroAction) {
      if (heroAction.type === 'call') {
        amountToCall = heroAction.amount;
      } else if (heroAction.type === 'raise' || heroAction.type === 'bet') {
        amountToCall = heroAction.amount;
      } else if (heroAction.type === 'fold') {
        for (var fi = acts.length - 1; fi >= 0; fi--) {
          if (!acts[fi].isMe && (acts[fi].type === 'raise' || acts[fi].type === 'bet') && acts[fi].amount) {
            amountToCall = acts[fi].amount;
            villainAction = acts[fi];
            break;
          }
        }
      }

      var potOdds = amountToCall > 0 ? amountToCall / (potAtHeroAction + amountToCall) : 0;

      var villainBetPct = null;
      if (villainAction && villainAction.amount && potBefore > 0) {
        villainBetPct = Math.round((villainAction.amount / potBefore) * 100);
      }

      var callersBefore = 0;
      for (var ci = 0; ci < acts.length; ci++) {
        if (acts[ci].isMe) break;
        if (acts[ci].type === 'call') callersBefore++;
      }

      streets[st] = {
        action: heroAction,
        potBefore: potAtHeroAction,
        amountToCall: amountToCall,
        potOdds: potOdds,
        villainAction: villainAction,
        villainBetPct: villainBetPct,
        playersActive: numActive,
        callersBefore: callersBefore
      };
    }
  }

  return { streets: streets, foldedOn: heroFoldedOn };
}

function generateGuidance(equity, streetInfo, texture, madeHand, villainProfile, priorStreets) {
  var eq = equity * 100;
  var act = streetInfo.action;
  var potOdds = streetInfo.potOdds * 100;
  var pot = streetInfo.potBefore || 0;
  var text = '';
  var quality = 'neutral';
  priorStreets = priorStreets || [];

  var betPotPct = (act.amount && pot > 0 && (act.type === 'bet' || act.type === 'raise'))
    ? Math.round((act.amount / pot) * 100) : null;

  var vAct = streetInfo.villainAction;
  var vBetPct = streetInfo.villainBetPct;
  var playersActive = streetInfo.playersActive || 0;
  var callersBefore = streetInfo.callersBefore || 0;
  var multiway = playersActive > 2;

  var vName = villainProfile ? villainProfile.name : null;
  var vFolds = villainProfile && villainProfile.foldToRaise !== null ? villainProfile.foldToRaise : null;
  var vLoose = villainProfile && (villainProfile.type === 'LAG' || villainProfile.type === 'Cannon' || villainProfile.type === 'Station' || villainProfile.type === 'Maniac');
  var vAgg = villainProfile && (villainProfile.type === 'LAG' || villainProfile.type === 'Maniac' || (villainProfile.agg !== null && villainProfile.agg >= 40));
  var vCalls = villainProfile && villainProfile.wtsd !== null && villainProfile.wtsd >= 55;
  var vPassive = villainProfile && villainProfile.agg !== null && villainProfile.agg < 15;
  var vHands = villainProfile ? villainProfile.hands : 0;

  var heroActionLine = priorStreets.map(function (ps) { return ps.heroActionType || ''; });
  var villainActionLine = priorStreets.map(function (ps) { return ps.villainActionType || ''; });
  var heroCallCount = heroActionLine.filter(function (a) { return a === 'call'; }).length;
  var heroCheckCount = heroActionLine.filter(function (a) { return a === 'check'; }).length;
  var villainBetCount = villainActionLine.filter(function (a) { return a === 'bet' || a === 'raise'; }).length;
  var heroPassiveStreets = heroCallCount + heroCheckCount;
  var isPassiveLine = heroPassiveStreets >= 2;

  var isBoardPairHand = madeHand && madeHand.label.indexOf('board') !== -1;
  var isEffectivelyHighCard = isBoardPairHand || (madeHand && madeHand.tier === 0);
  var boardIsPaired = texture && texture.label && (texture.label.indexOf('Paired') !== -1 || texture.label.indexOf('paired') !== -1);
  var boardIsDoublePaired = false;
  if (texture && texture.boardRankCounts) {
    var bpCount = 0;
    for (var brk in texture.boardRankCounts) {
      if (texture.boardRankCounts[brk] >= 2) bpCount++;
    }
    boardIsDoublePaired = bpCount >= 2;
  }

  var facingDesc = '';
  if (vAct) {
    var vSizeDesc = '';
    if (vBetPct !== null) {
      if (vBetPct <= 33) vSizeDesc = ' (small, ' + vBetPct + '% pot)';
      else if (vBetPct <= 75) vSizeDesc = ' (' + vBetPct + '% pot)';
      else if (vBetPct <= 100) vSizeDesc = ' (large, ' + vBetPct + '% pot)';
      else vSizeDesc = ' (overbet, ' + vBetPct + '% pot)';
    }
    facingDesc = 'Facing ' + vAct.author + '\'s ' + fmt(vAct.amount) + ' ' + vAct.type + vSizeDesc + '. ';
  }

  var mwDesc = '';
  if (multiway) {
    mwDesc = playersActive + '-way pot' + (callersBefore > 0 ? ' (' + callersBefore + ' caller' + (callersBefore > 1 ? 's' : '') + ' before you)' : '') + '. ';
  }

  var vLineDesc = '';
  if (villainBetCount >= 2 && vName) {
    vLineDesc = vName + ' has bet ' + villainBetCount + ' street' + (villainBetCount > 1 ? 's' : '') + ' so far. ';
  }

  if (act.type === 'sb' || act.type === 'bb') {
    if (eq > 55) { text = 'Strong starting hand.'; quality = 'good'; }
    else if (eq >= 40) { text = 'Playable hand from the blinds.'; quality = 'neutral'; }
    else { text = 'Weak hand. Defend selectively.'; quality = 'bad'; }

  } else if (act.type === 'check') {
    if (isEffectivelyHighCard && boardIsPaired) {
      text = facingDesc + mwDesc + heroHighCardCheckText(eq, madeHand, boardIsDoublePaired, vName, vFolds, vCalls, vHands);
      quality = eq >= 40 ? 'neutral' : 'good';
    } else if (eq > 65 && vFolds !== null && vFolds >= 60) {
      text = facingDesc + vLineDesc + Math.round(eq) + '% equity but you checked. ' + vName + ' folds to raises ' + vFolds + '% (' + vHands + ' hands): missed value.';
      quality = 'bad';
    } else if (eq > 65 && vCalls) {
      text = facingDesc + vLineDesc + Math.round(eq) + '% equity but you checked. ' + vName + ' calls to showdown ' + villainProfile.wtsd + '%. Bet big, they pay.';
      quality = 'bad';
    } else if (eq > 65 && vPassive) {
      text = facingDesc + vLineDesc + Math.round(eq) + '% equity but you checked. ' + vName + ' is passive. Take the lead.';
      quality = 'bad';
    } else if (eq > 65) {
      text = facingDesc + vLineDesc + 'Strong hand (' + Math.round(eq) + '% equity) but you checked. Betting for value is usually correct.';
      quality = 'bad';
    } else if (eq >= 40 && multiway) {
      text = mwDesc + vLineDesc + 'Decent equity (' + Math.round(eq) + '%) but checking multiway is reasonable: harder to get folds from multiple opponents.';
      quality = 'neutral';
    } else if (eq >= 40 && vFolds !== null && vFolds >= 60) {
      text = facingDesc + vLineDesc + Math.round(eq) + '% equity. ' + vName + ' folds to raises ' + vFolds + '% (' + vHands + ' hands): a bet could take this down.';
      quality = 'neutral';
    } else if (eq >= 40) {
      if (isPassiveLine) {
        text = vLineDesc + 'You\'ve played passively through ' + (heroPassiveStreets + 1) + ' streets with ' + Math.round(eq) + '% equity. Without a bet at some point, you\'re letting villain control the pot and set the price.';
        quality = 'neutral';
      } else {
        text = vLineDesc + Math.round(eq) + '% equity. Checking is reasonable if you plan to call a bet.';
        quality = 'neutral';
      }
    } else {
      text = 'Weak hand. Checking is correct.';
      quality = 'good';
    }

  } else if (act.type === 'call') {
    text = facingDesc;

    if (heroCallCount >= 1 && isEffectivelyHighCard && !multiway) {
      text += vLineDesc + 'You\'ve called ' + (heroCallCount + 1) + ' streets with ' + (madeHand ? madeHand.label : 'a marginal hand') + '. ';
      if (boardIsDoublePaired) {
        text += 'On a double-paired board, any pocket pair beats you. ';
      }
      if (vFolds !== null && vFolds >= 60 && vHands >= 5) {
        text += vName + ' folds to raises ' + vFolds + '% (' + vHands + ' hands): raising was better than calling.';
        quality = 'bad';
      } else if (vAgg) {
        text += vName + ' is aggressive (AFq ' + villainProfile.agg + '%). Could be bluffing, but calling passively lets them barrel you off.';
        quality = 'neutral';
      } else {
        text += 'A raise at some point would test whether villain actually has a hand.';
        quality = 'neutral';
      }
    } else if (eq > potOdds + 10 && vFolds !== null && vFolds >= 60) {
      text += vLineDesc + Math.round(eq) + '% equity justified a call, but ' + vName + ' folds to raises ' + vFolds + '% (' + vHands + ' hands): raising wins the pot outright.';
      quality = 'neutral';
    } else if (eq > potOdds + 10 && vAgg) {
      text += vLineDesc + vName + ' is aggressive. Calling with ' + Math.round(eq) + '% equity is fine. Let them bluff into you.';
      quality = 'good';
    } else if (eq > potOdds + 10 && multiway && callersBefore > 0) {
      text += mwDesc + vLineDesc + 'Good call with ' + Math.round(eq) + '% equity, but ' + callersBefore + ' caller' + (callersBefore > 1 ? 's' : '') + ' already in means someone likely has a real hand.';
      quality = 'good';
    } else if (eq > potOdds + 10) {
      text += vLineDesc + 'Good price. ' + Math.round(eq) + '% equity beats the ' + Math.round(potOdds) + '% needed.';
      quality = 'good';
    } else if (eq >= potOdds - 10) {
      text += vLineDesc + 'Borderline. ' + Math.round(eq) + '% equity roughly matches the ' + Math.round(potOdds) + '% needed. Implied odds decide this.';
      quality = 'neutral';
    } else {
      text += vLineDesc + 'Unprofitable call. ' + Math.round(eq) + '% equity but needed ' + Math.round(potOdds) + '%.';
      quality = 'bad';
    }
    if (vBetPct !== null) {
      if (vBetPct <= 33) {
        text += ' Small sizing: you\'re getting a great price.';
      } else if (vBetPct > 100) {
        text += ' Overbet usually means polarised: nuts or bluff.';
      }
    }

  } else if (act.type === 'raise') {
    text = facingDesc + vLineDesc;
    if (eq > 55) {
      text += 'Value raise with ' + Math.round(eq) + '% equity.';
      quality = 'good';
      if (isPassiveLine) {
        text += ' Good to finally take initiative after playing passively.';
      }
    } else if (eq >= 35) {
      text += 'Semi-bluff raise with ' + Math.round(eq) + '% equity: pressure plus outs.';
      quality = 'neutral';
    } else if (vFolds !== null && vFolds >= 60) {
      text += 'Bluff raise targeting ' + vName + ' who folds ' + vFolds + '% to raises (' + vHands + ' hands): justified even with weak equity.';
      quality = 'good';
    } else if (multiway) {
      text += mwDesc + 'Aggressive raise into multiple opponents with ' + Math.round(eq) + '% equity: risky, but isolates.';
      quality = 'neutral';
    } else {
      text += 'Bluff raise with ' + Math.round(eq) + '% equity. Relying on fold equity.';
      quality = 'neutral';
    }
    if (betPotPct !== null) {
      if (vCalls && betPotPct < 60 && eq > 55) {
        text += ' Your ' + betPotPct + '% pot sizing is small. ' + vName + ' goes to showdown ' + villainProfile.wtsd + '%, size up.';
      } else if (vFolds !== null && vFolds >= 60 && betPotPct > 80) {
        text += ' ' + betPotPct + '% pot is large. ' + vName + ' folds ' + vFolds + '% anyway, a smaller raise risks less.';
      }
    }

  } else if (act.type === 'bet') {
    text = vLineDesc;
    if (eq > 55) {
      text += 'Value bet with ' + Math.round(eq) + '% equity.';
      quality = 'good';
    } else if (eq >= 35) {
      text += 'Thin value or semi-bluff with ' + Math.round(eq) + '% equity.';
      quality = 'neutral';
    } else if (vFolds !== null && vFolds >= 60) {
      text += 'Bluff targeting ' + vName + ' who folds ' + vFolds + '% to raises (' + vHands + ' hands).';
      quality = 'good';
    } else if (multiway) {
      text += mwDesc + 'Betting into ' + playersActive + ' opponents with ' + Math.round(eq) + '% equity. Someone likely has something.';
      quality = 'neutral';
    } else {
      text += 'Bluff bet with ' + Math.round(eq) + '% equity. Need villain to fold.';
      quality = 'neutral';
    }
    if (betPotPct !== null) {
      if (vCalls && betPotPct < 60 && eq > 55) {
        text += ' Your ' + betPotPct + '% pot sizing is small. ' + vName + ' goes to showdown ' + villainProfile.wtsd + '%, size up.';
      } else if (vFolds !== null && vFolds >= 60 && betPotPct > 80) {
        text += ' ' + betPotPct + '% pot is large. ' + vName + ' folds ' + vFolds + '% anyway, smaller works.';
      } else if (vLoose && betPotPct < 50 && eq > 55) {
        text += ' ' + betPotPct + '% pot is small. ' + vName + ' plays loose (VPIP ' + villainProfile.vpip + '%), size up.';
      }
    }

  } else if (act.type === 'fold') {
    text = facingDesc + vLineDesc;
    if (eq > 40 && vLoose) {
      text += 'Folded ' + Math.round(eq) + '% equity against ' + vName + ' (VPIP ' + villainProfile.vpip + '%). Their range is wide. This fold was likely too tight.';
      quality = 'bad';
    } else if (eq > 40 && vFolds !== null && vFolds >= 60) {
      text += 'Folded ' + Math.round(eq) + '% equity but ' + vName + ' folds to raises ' + vFolds + '% (' + vHands + ' hands): raising was better than folding.';
      quality = 'bad';
    } else if (eq > 40 && multiway) {
      text += mwDesc + 'Folded with ' + Math.round(eq) + '% equity. In a multiway pot the fold is more defensible.';
      quality = 'neutral';
    } else if (eq > 40) {
      text += 'Folded with ' + Math.round(eq) + '% equity. May have been too tight unless villain\'s range here is very strong.';
      quality = 'bad';
    } else if (eq >= 25) {
      text += 'Marginal fold with ' + Math.round(eq) + '% equity.';
      quality = 'neutral';
      if (vAgg) text += ' ' + vName + ' is aggressive though. Calling could be defensible.';
      if (vBetPct !== null && vBetPct <= 33) text += ' Small sizing gave a good price. Consider calling more against small bets.';
    } else {
      text += 'Clean fold. ' + Math.round(eq) + '% equity isn\'t enough to continue.';
      quality = 'good';
    }
  }

  if (texture) {
    if (texture.wetness === 'dry' && act.type === 'fold' && eq > 40) {
      text += ' Dry board makes this fold worse: fewer draws threaten you.';
    }
    if (texture.wetness === 'wet' && act.type === 'check' && eq > 65 && !isEffectivelyHighCard) {
      text += ' Wet board. You need to charge draws here.';
      if (quality !== 'bad') quality = 'bad';
    }
    if (texture.wetness === 'wet' && (act.type === 'bet' || act.type === 'raise') && eq >= 35 && eq <= 55) {
      text += ' Good aggression on a wet board: fold equity plus draw equity.';
      if (quality === 'neutral') quality = 'good';
    }
  }

  if (madeHand && madeHand.draws.length > 0) {
    if (act.type === 'call' && potOdds > 0) {
      var totalOuts = 0;
      for (var oi = 0; oi < madeHand.draws.length; oi++) {
        var m = madeHand.draws[oi].match(/(\d+) outs/);
        if (m) totalOuts += parseInt(m[1], 10);
      }
      if (totalOuts > 0) {
        var drawEquity = totalOuts * 2;
        if (drawEquity >= potOdds) text += ' Draw odds (' + totalOuts + ' outs ≈ ' + (totalOuts * 2) + '%) justified the call.';
        else text += ' Draw odds (' + totalOuts + ' outs ≈ ' + (totalOuts * 2) + '%) were thin for this price.';
      }
    }
  }

  if (madeHand && texture && !isEffectivelyHighCard) {
    if (madeHand.label === 'Top Pair' && texture.wetness === 'wet' && act.type === 'check') {
      text += ' Top pair on a wet board: bet to deny free cards.';
    } else if (madeHand.label === 'Overpair' && texture.wetness === 'dry' && act.type === 'check') {
      text += ' Overpair on dry board: bet for value, villain has few outs.';
    } else if (madeHand.label === 'Set' && (act.type === 'check' || (act.type === 'call' && betPotPct === null))) {
      text += ' Set is disguised. Consider raising to build the pot.';
    } else if ((madeHand.label === 'Full House' || madeHand.label === 'Quads' || madeHand.label === 'Straight Flush') && act.type === 'check') {
      text += ' Top of your range. Consider trapping if villain is aggressive, or bet small to induce.';
    }
  }

  return { text: text, quality: quality };
}

function heroHighCardCheckText(eq, madeHand, boardIsDoublePaired, vName, vFolds, vCalls, vHands) {
  var label = madeHand ? madeHand.label : 'high card';
  var text = '';
  if (boardIsDoublePaired) {
    text = 'You have ' + label + ' on a double-paired board. Any pocket pair beats you. ';
    if (eq >= 40) {
      text += 'Checking is fine. You have showdown value against missed draws, but betting accomplishes little since worse hands fold and better hands call.';
    } else {
      text += 'Checking is correct. You can\'t get called by worse here.';
    }
  } else {
    text = 'You have ' + label + ' on a paired board. ';
    if (vFolds !== null && vFolds >= 60 && vName) {
      text += vName + ' folds to raises ' + vFolds + '% (' + vHands + ' hands): a bet could take this down, but if called you\'re usually behind.';
    } else if (vCalls && vName) {
      text += vName + ' calls down often. Don\'t bluff, check for showdown value.';
    } else {
      text += 'Checking makes sense. Most hands that call a bet have you beat.';
    }
  }
  return text;
}

function generateHandSummary(results, hand, villainProfile) {
  if (!results || results.length < 2) return null;

  var invested = 0;
  if (typeof getInvested === 'function') {
    invested = getInvested(hand);
  } else if (typeof calcInvestmentFromActions === 'function') {
    invested = calcInvestmentFromActions(hand.actions);
  }

  var outcome = hand.outcome || {};
  var won = outcome.result === 'won';
  var folded = outcome.result === 'folded';
  var pnl = won ? (outcome.amount || 0) - invested : -invested;

  var heroActions = [];
  var villainActions = [];
  for (var i = 0; i < results.length; i++) {
    var r = results[i];
    if (r.street === 'Preflop') {
      heroActions.push(r.actionDesc || '');
      continue;
    }
    heroActions.push(r.actionDesc || '');
    if (r.villainActionType) villainActions.push(r.street + ': ' + r.villainActionType);
  }

  var postflopResults = results.filter(function (r) { return r.street !== 'Preflop'; });
  var heroPostflopTypes = postflopResults.map(function (r) { return r.heroActionType || ''; });
  var allCalls = heroPostflopTypes.every(function (t) { return t === 'call'; });
  var allChecks = heroPostflopTypes.every(function (t) { return t === 'check'; });
  var allPassive = heroPostflopTypes.every(function (t) { return t === 'call' || t === 'check'; });
  var streetsPlayed = postflopResults.length;

  var villainPostflopTypes = postflopResults.map(function (r) { return r.villainActionType || ''; });
  var villainBets = villainPostflopTypes.filter(function (t) { return t === 'bet' || t === 'raise'; }).length;

  var vName = villainProfile ? villainProfile.name : null;
  var vHands = villainProfile ? villainProfile.hands : 0;

  var villainRevealed = null;
  var villainHandDesc = null;
  if (hand.actions) {
    for (var ai = 0; ai < hand.actions.length; ai++) {
      var line = hand.actions[ai] || '';
      if (line.indexOf(' reveals ') !== -1 && line.indexOf('>>') === -1 && line.indexOf('&gt;&gt;') === -1) {
        var revealMatch = line.match(/reveals \[([^\]]+)\]/);
        var strengthMatch = line.match(/\(([^)]+)\)/);
        if (revealMatch) villainRevealed = revealMatch[1];
        if (strengthMatch) villainHandDesc = strengthMatch[1];
      }
    }
  }

  var finalMadeHand = postflopResults.length > 0 ? postflopResults[postflopResults.length - 1].madeHand : null;
  var finalLabel = finalMadeHand ? finalMadeHand.label : '';

  var parts = [];

  if (allCalls && streetsPlayed >= 2) {
    parts.push('You called ' + streetsPlayed + ' streets' + (finalLabel ? ' with ' + finalLabel : '') + ', investing ' + fmt(invested) + '.');
  } else if (allChecks && streetsPlayed >= 2) {
    parts.push('You checked ' + streetsPlayed + ' streets' + (finalLabel ? ' with ' + finalLabel : '') + '.');
  } else if (allPassive && streetsPlayed >= 2) {
    parts.push('You played passively through ' + streetsPlayed + ' streets' + (finalLabel ? ' with ' + finalLabel : '') + ', investing ' + fmt(invested) + '.');
  } else if (folded) {
    parts.push('You folded on the ' + (outcome.foldStreet || '').toLowerCase() + ', saving further investment after putting in ' + fmt(invested) + '.');
  }

  if (vName && villainBets >= 2) {
    parts.push(vName + ' bet ' + villainBets + ' of ' + streetsPlayed + ' streets, applying consistent pressure.');
  } else if (vName && villainBets === 1 && streetsPlayed >= 2) {
    var checkStreets = streetsPlayed - villainBets;
    parts.push(vName + ' bet once then checked ' + checkStreets + ' street' + (checkStreets > 1 ? 's' : '') + '.');
  }

  if (villainRevealed && villainHandDesc && vName) {
    parts.push(vName + ' showed ' + villainRevealed + ' (' + villainHandDesc + ').');
    if (postflopResults.length > 0) {
      var lastTex = postflopResults[postflopResults.length - 1].texture;
      if (lastTex && lastTex.label && lastTex.label.indexOf('Paired') !== -1) {
        var vhd = villainHandDesc.toLowerCase();
        if (vhd.indexOf('pair') !== -1 && vhd.indexOf('two pair') === -1) {
          parts.push('A pocket pair on a paired board is exactly the hand that continues through multiple streets.');
        }
      }
    }
  }

  if (villainProfile && vHands >= 10) {
    var exploitNote = '';
    if (allPassive && villainProfile.foldToRaise !== null && villainProfile.foldToRaise >= 60) {
      exploitNote = 'In ' + vHands + ' hands, ' + vName + ' folds to raises ' + villainProfile.foldToRaise + '%. A raise on any street likely wins this pot without showdown.';
    } else if (allPassive && villainProfile.wtsd !== null && villainProfile.wtsd >= 55) {
      exploitNote = vName + ' goes to showdown ' + villainProfile.wtsd + '% of the time. Against a station, passive play without a strong hand is expensive.';
    } else if (villainProfile.agg !== null && villainProfile.agg >= 40 && allCalls) {
      exploitNote = vName + ' is aggressive (AFq ' + villainProfile.agg + '%). Calling down can be correct if you have a real hand, but ' + finalLabel + ' wasn\'t strong enough to justify it.';
    }
    if (exploitNote) parts.push(exploitNote);
  }

  if (won) {
    parts.push('Result: won ' + fmt(outcome.amount) + ' (profit ' + fmt(pnl) + ').');
  } else if (folded) {
    parts.push('Result: folded, losing ' + fmt(invested) + '.');
  } else {
    parts.push('Result: lost ' + fmt(invested) + ' at showdown.');
  }

  var overallQuality = 'neutral';
  var goodCount = 0, badCount = 0;
  for (var qi = 0; qi < results.length; qi++) {
    if (results[qi].guidance.quality === 'good') goodCount++;
    if (results[qi].guidance.quality === 'bad') badCount++;
  }
  if (badCount > goodCount) overallQuality = 'bad';
  else if (goodCount > badCount) overallQuality = 'good';

  return { text: parts.join(' '), quality: overallQuality };
}

