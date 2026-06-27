(function() {
  var F = Sections.section('players', 'Players');
  var MIN_PROFILE_HANDS = 50;   // hands needed before classifying an opponent
  var MIN_NAMED_HANDS = 30;     // hands needed to enter profitable/unprofitable
  var MIN_TYPE_OPPONENTS = 3;   // opponents of one type required to fire story

  function buildProfiles(hands) {
    if (!hands || !hands.length) return [];

    var nameToHandIdx = {};
    for (var i = 0; i < hands.length; i++) {
      var acts = parseActions(hands[i].actions);
      var seen = {};
      for (var j = 0; j < acts.length; j++) {
        var a = acts[j];
        if (a.isMe || !a.author || seen[a.author]) continue;
        seen[a.author] = true;
        if (!nameToHandIdx[a.author]) nameToHandIdx[a.author] = [];
        nameToHandIdx[a.author].push(i);
      }
    }

    // One pass over all hands for every opponent's stats. Calling the
    // per-opponent computeOpponentStats in this loop was O(opponents x hands),
    // which froze the insight pass for sessions with many opponents.
    var statsByName = computeAllOpponentStats(hands);
    var profiles = [];
    for (var name in nameToHandIdx) {
      var idxs = nameToHandIdx[name];
      if (!idxs || !idxs.length) continue;

      var stats = statsByName[name];
      if (!stats) continue;

      var vpip = (typeof pct === 'function') ? pct(stats.vpipHands, stats.hands) : null;
      var af = (typeof calcAggression === 'function')
        ? calcAggression(stats.totalRaises, stats.totalCalls, stats.totalChecks)
        : null;
      var type = _styleClassify(vpip, af) || 'Unknown';

      var heroPnl = 0;
      var heroWon = 0;
      var heroLost = 0;
      var heroFolded = 0;
      for (var k = 0; k < idxs.length; k++) {
        var h = hands[idxs[k]];
        if (!h || !h.outcome) continue;
        if (h.outcome.result === 'won') heroWon++;
        else if (h.outcome.result === 'folded') heroFolded++;
        else heroLost++;
        heroPnl += getHandPnlValue(h);
      }

      profiles.push({
        name: name,
        hands: stats.hands,
        vpip: vpip,
        af: af,
        type: type,
        heroPnl: heroPnl,
        heroWon: heroWon,
        heroLost: heroLost,
        heroFolded: heroFolded,
        heroContested: heroWon + heroLost,
        handIdxs: idxs
      });
    }

    return profiles;
  }

  function handsFromIdxs(hands, idxs, cap) {
    var out = [];
    if (!hands || !idxs) return out;
    var limit = cap || idxs.length;
    for (var i = idxs.length - 1; i >= 0 && out.length < limit; i--) {
      var h = hands[idxs[i]];
      if (h) out.push(h);
    }
    return out;
  }

  function combineHandIdxs(profiles, cap) {
    var seen = {};
    var idxs = [];
    for (var i = 0; i < profiles.length; i++) {
      var pIdxs = profiles[i].handIdxs || [];
      for (var j = 0; j < pIdxs.length; j++) {
        if (!seen[pIdxs[j]]) {
          seen[pIdxs[j]] = true;
          idxs.push(pIdxs[j]);
        }
      }
    }
    idxs.sort(function(a, b) { return a - b; });
    if (cap && idxs.length > cap) idxs = idxs.slice(idxs.length - cap);
    return idxs;
  }

  function heroSawShowdown(h) {
    return !!isShowdown(h);
  }

  var STYLE_META = {
    Shark: {
      name: 'vs Sharks',
      shortPlural: 'sharks',
      shortSingle: 'a shark',
      losingImpact: 'Sharks pick spots well and apply heavy pressure when they do get involved. Marginal hands are dominated against their range.',
      losingSoWhat: 'Three-bet or fold preflop against sharks rather than flat-calling out of position. Postflop, fold marginal hands to their aggression and only stack off with strong value or a clear bluff-catcher you have a read on.',
      winningSoWhat: 'Stick to a tight value game against sharks. Skip thin bluffs, bet your strong hands for value, and only call them down where the board clearly favours your range.'
    },
    TAG: {
      name: 'vs Tight-Aggressive opponents',
      shortPlural: 'TAGs',
      shortSingle: 'a TAG',
      losingImpact: 'TAGs only get involved with strong holdings and apply pressure when they do. Calling wide against them pays off their value range.',
      losingSoWhat: 'Fold dominated hands to TAG opens instead of flat-calling, and three-bet the hands you do continue with to deny them position. When they fire a second barrel, believe it unless the board favours you.',
      winningSoWhat: 'Keep folding the weak calls against TAG raises and three-betting your continues. Pick off only their thin river barrels on boards that hit your range, not theirs.'
    },
    Rock: {
      name: 'vs Rocks',
      shortPlural: 'rocks',
      shortSingle: 'a rock',
      losingImpact: 'Rocks only continue with value, but you may be paying off their rare aggression too often.',
      losingSoWhat: 'When a rock bets or raises, fold top pair and worse: that line is value almost every time. Win it back by raising their limps and betting whenever they check, since they fold everything but premiums.',
      winningSoWhat: 'Keep stealing from rocks when they check or limp, and keep folding to their raises. Bet most flops they check to you on safe boards; they only continue with a made hand.'
    },
    Cannon: {
      name: 'vs Cannons',
      shortPlural: 'cannons',
      shortSingle: 'a cannon',
      losingImpact: 'Cannons play too many flops without enough follow-through. The losses come from getting outdrawn or paying off the rare big bet.',
      losingSoWhat: 'Value-bet thinner against cannons. They will call light on flops and turns, so bet for value and avoid bluffing.',
      winningSoWhat: 'Keep value-betting cannons. They pay off too often; size up when they keep calling.'
    },
    LAG: {
      name: 'vs Loose-Aggressive opponents',
      shortPlural: 'LAGs',
      shortSingle: 'a LAG',
      losingImpact: 'LAGs are pressuring you with wide ranges and you are folding or paying too often. The aggression is doing its job.',
      losingSoWhat: 'Widen the calling and three-betting range against LAG aggression. Stop folding pairs and strong draws to one barrel.',
      winningSoWhat: 'Keep playing back at LAG aggression. Their wide value range means you can stand your ground with mid-strength holdings.'
    },
    Nit: {
      name: 'vs Nits',
      shortPlural: 'nits',
      shortSingle: 'a nit',
      losingImpact: 'Nits only put chips in with premium holdings. Paying them off on the river is the most common leak.',
      losingSoWhat: 'Fold more rivers when a nit suddenly bets or raises. They are not bluffing; that line is value, every time.',
      winningSoWhat: 'Stay disciplined against nits. Pick spots to steal blinds and small pots; avoid hero calls when they wake up.'
    },
    Station: {
      name: 'vs Stations',
      shortPlural: 'stations',
      shortSingle: 'a station',
      losingImpact: 'Stations call too wide. Bluffing them is expensive and the only path through is value.',
      losingSoWhat: 'Drop the bluffs against stations and value-bet thinner. Bet for three streets with top pair or better.',
      winningSoWhat: 'Keep value-betting stations. Cut any leftover bluffs and size up when they keep calling.'
    },
    Maniac: {
      name: 'vs Maniacs',
      shortPlural: 'maniacs',
      shortSingle: 'a maniac',
      losingImpact: 'Maniacs are firing wide and you are folding too often or running into their occasional value. Variance compounds when calls are wrong-sized.',
      losingSoWhat: 'Widen the call-down range against maniacs and pick the right spots to three-bet for value. Stop folding strong one-pair hands to one barrel.',
      winningSoWhat: 'Keep calling down maniacs with showdown-strength hands. Let them bluff into your value range and avoid getting fancy.'
    }
  };

  function buildPlaystyleStory(type, profiles, hands) {
    var matching = profiles.filter(function(p) {
      return p.type === type && p.hands >= MIN_PROFILE_HANDS;
    });
    if (matching.length < MIN_TYPE_OPPONENTS) return null;

    var meta = STYLE_META[type];
    if (!meta) return null;

    var totalHands = 0;
    var totalPnl = 0;
    var totalWon = 0;
    var totalContested = 0;
    var totalShowdown = 0;
    var totalShowdownWon = 0;
    for (var i = 0; i < matching.length; i++) {
      totalHands += matching[i].hands;
      totalPnl += matching[i].heroPnl;
      totalWon += matching[i].heroWon;
      totalContested += matching[i].heroContested;
    }

    var unionIdxs = combineHandIdxs(matching);
    for (var u = 0; u < unionIdxs.length; u++) {
      var h = hands[unionIdxs[u]];
      if (!h || !h.outcome) continue;
      if (heroSawShowdown(h)) {
        totalShowdown++;
        if (h.outcome.result === 'won') totalShowdownWon++;
      }
    }

    var winRate = safePct(totalWon, totalContested);
    // unionIdxs dedupes hands that contained more than one opponent of this
    // type, so it is the honest count of distinct hands. totalHands sums each
    // opponent's hand count and double-counts any hand shared by two of them.
    var distinctHands = unionIdxs.length;
    var avgPerHand = distinctHands > 0 ? totalPnl / distinctHands : 0;
    var perHandThreshold = 2;

    var severity;
    if (avgPerHand <= -perHandThreshold) severity = 'r';
    else if (avgPerHand < 0) severity = 'a';
    else severity = 'g';

    var openingText = 'You have faced a group of ' + matching.length + ' ' +
      meta.shortPlural + ' (' + MIN_PROFILE_HANDS + '+ hands each) across ' + distinctHands + ' hands. ' +
      (totalPnl < 0 ? 'You are down ' : 'You are up ') + fmt(Math.abs(totalPnl)) +
      ' against them overall, about ' + fmt(Math.abs(avgPerHand)) + ' a hand.';

    var branchTexts = [];

    if (winRate != null) {
      if (winRate >= 50 && totalPnl < 0) {
        branchTexts.push('You win ' + Math.round(winRate) + '% of the pots you contest with this group but still lose overall, so the pots you lose are bigger than the ones you win.');
      } else if (winRate < 50 && totalPnl > 0) {
        branchTexts.push('You win only ' + Math.round(winRate) + '% of contested pots here yet still come out ahead, so your winning pots are the bigger ones.');
      } else {
        branchTexts.push('You win ' + Math.round(winRate) + '% of the pots you contest against this group.');
      }
    }

    var sortedByPnl = matching.slice().sort(function(a, b) { return a.heroPnl - b.heroPnl; });
    if (sortedByPnl.length >= 2) {
      var worstVs = sortedByPnl[0];
      var bestVs = sortedByPnl[sortedByPnl.length - 1];
      if (worstVs.heroPnl < 0 && bestVs.heroPnl > 0) {
        branchTexts.push('Within the group you are doing best vs ' + bestVs.name +
          ' (' + fmtPnl(bestVs.heroPnl) + ' across ' + bestVs.hands + ' hands) and worst vs ' +
          worstVs.name + ' (' + fmtPnl(worstVs.heroPnl) + ' across ' + worstVs.hands + ' hands).');
      } else if (worstVs.heroPnl < 0) {
        branchTexts.push('Worst result in the group is vs ' + worstVs.name +
          ' at ' + fmtPnl(worstVs.heroPnl) + ' across ' + worstVs.hands + ' hands.');
      } else if (bestVs.heroPnl > 0) {
        branchTexts.push('Best result in the group is vs ' + bestVs.name +
          ' at ' + fmtPnl(bestVs.heroPnl) + ' across ' + bestVs.hands + ' hands.');
      }
    }

    if (totalShowdown >= 10) {
      var wsd = safePct(totalShowdownWon, totalShowdown);
      branchTexts.push('You reached showdown ' + totalShowdown + ' times against this group and won ' +
        (wsd != null ? Math.round(wsd) + '%' : '-') + ' of them.');
    }

    var impactText = null;
    var soWhatText = null;
    if (severity === 'r' || severity === 'a') {
      impactText = meta.losingImpact;
      soWhatText = meta.losingSoWhat;
    } else if (totalPnl > 0) {
      impactText = null;
      soWhatText = meta.winningSoWhat;
    }

    var examples = [];
    if (sortedByPnl[0] && sortedByPnl[0].heroPnl < 0) {
      var ex = handsFromIdxs(hands, sortedByPnl[0].handIdxs, 12);
      if (ex.length) {
        examples.push({
          id: 'players-' + type.toLowerCase() + '-worst',
          label: 'Hands vs ' + sortedByPnl[0].name,
          hands: ex,
          coachingNote: 'Worst result in your ' + meta.shortPlural + ' group. ' +
            'Look for the recurring pattern: where you are giving up too easily or paying off the value range.'
        });
      }
    }
    var grpHands = handsFromIdxs(hands, unionIdxs, 15);
    if (grpHands.length) {
      examples.push({
        id: 'players-' + type.toLowerCase() + '-group',
        label: 'Recent hands vs ' + meta.shortPlural,
        hands: grpHands,
        coachingNote: 'A cross-section of recent hands against ' + meta.shortPlural + '. ' +
          'Use this to spot the line you fall into automatically against this opponent type.'
      });
    }

    var deltaUnits = Math.min(2, Math.abs(avgPerHand) / Math.max(1, perHandThreshold));
    return F({
      id: 'players-vs-' + type.toLowerCase(),
      name: meta.name,
      severity: severity,
      magnitude: deltaUnits,
      openingText: openingText,
      branchTexts: branchTexts,
      impactText: impactText,
      soWhatText: soWhatText,
      examples: examples,
      meta: {
        type: type,
        opponents: matching.length,
        totalHands: totalHands,
        distinctHands: distinctHands,
        totalPnl: totalPnl,
        winRate: winRate,
        totalShowdown: totalShowdown,
        totalShowdownWon: totalShowdownWon
      }
    });
  }

  function buildNamedOpponentStory(direction, profiles, hands) {
    var qualifying = profiles.filter(function(p) { return p.hands >= MIN_NAMED_HANDS; });
    var matching = qualifying.filter(function(p) {
      return direction === 'profitable' ? p.heroPnl > 0 : p.heroPnl < 0;
    });
    if (matching.length < 2) return null;

    matching.sort(function(a, b) {
      return direction === 'profitable' ? b.heroPnl - a.heroPnl : a.heroPnl - b.heroPnl;
    });

    var totalPnl = 0;
    var totalHands = 0;
    var typeCounts = {};
    var topShowdown = 0;
    var topShowdownPnl = 0;
    var topNonShowdownPnl = 0;
    var top = matching.slice(0, Math.min(5, matching.length));
    for (var i = 0; i < matching.length; i++) {
      totalPnl += matching[i].heroPnl;
      totalHands += matching[i].hands;
      var t = matching[i].type || 'Unknown';
      typeCounts[t] = (typeCounts[t] || 0) + 1;
    }

    var topIdxs = combineHandIdxs(top);
    for (var x = 0; x < topIdxs.length; x++) {
      var h = hands[topIdxs[x]];
      if (!h || !h.outcome) continue;
      var pnl = getHandPnlValue(h);
      if (heroSawShowdown(h)) {
        topShowdown++;
        topShowdownPnl += pnl;
      } else {
        topNonShowdownPnl += pnl;
      }
    }

    var isProfitable = direction === 'profitable';
    var label = isProfitable ? 'profitable' : 'unprofitable';
    var verbLine = isProfitable ? 'up against' : 'down against';

    var leadNames = top.slice(0, 3).map(function(p) {
      return p.name + ' (' + fmtPnl(p.heroPnl) + ', ' + p.hands + ' hands)';
    });
    var openingText = 'You are ' + verbLine + ' ' + matching.length + ' opponents with ' + MIN_NAMED_HANDS +
      '+ hands. The leaders: ' + joinList(leadNames) + '.';

    var branchTexts = [];

    var types = Object.keys(typeCounts).sort(function(a, b) { return typeCounts[b] - typeCounts[a]; });
    if (types.length) {
      var topType = types[0];
      var topShare = matching.length > 0 ? (typeCounts[topType] / matching.length) * 100 : 0;
      if (topType !== 'Unknown' && topShare >= 50) {
        var styleLabel = (typeof expandOpponentType === 'function') ? expandOpponentType(topType) : topType;
        branchTexts.push('The ' + label + ' group is concentrated in ' +
          styleLabel + ' opponents (' + typeCounts[topType] + ' of ' + matching.length + ').');
      } else if (types.length >= 2) {
        var styleLabels = types.slice(0, 3).map(function(t) {
          var lbl = (typeof expandOpponentType === 'function') ? expandOpponentType(t) : t;
          return lbl + ' (' + typeCounts[t] + ')';
        });
        branchTexts.push('The ' + label + ' group spreads across styles: ' + joinList(styleLabels) + '.');
      }
    }

    if (topShowdown >= 10 || Math.abs(topShowdownPnl) + Math.abs(topNonShowdownPnl) > 0) {
      var sdLabel = fmtPnl(topShowdownPnl);
      var nsdLabel = fmtPnl(topNonShowdownPnl);
      if (isProfitable) {
        if (topShowdownPnl > topNonShowdownPnl && topShowdownPnl > 0) {
          branchTexts.push('Most of the profit against these names comes at showdown (' + sdLabel + ' showdown vs ' + nsdLabel + ' non-showdown).');
        } else if (topNonShowdownPnl > topShowdownPnl && topNonShowdownPnl > 0) {
          branchTexts.push('Most of the profit against these names comes without reaching showdown (' + nsdLabel + ' non-showdown vs ' + sdLabel + ' showdown).');
        }
      } else {
        if (topShowdownPnl < topNonShowdownPnl && topShowdownPnl < 0) {
          branchTexts.push('Most of the loss against these names lands at showdown (' + sdLabel + ' showdown vs ' + nsdLabel + ' non-showdown).');
        } else if (topNonShowdownPnl < topShowdownPnl && topNonShowdownPnl < 0) {
          branchTexts.push('Most of the loss against these names happens before showdown (' + nsdLabel + ' non-showdown vs ' + sdLabel + ' showdown).');
        }
      }
    }

    var severity;
    var impactText = null;
    var soWhatText = null;
    var worstNames = joinList(top.slice(0, Math.min(3, top.length)).map(function(p) { return p.name; }));
    // Where the money moves tells you what to change. Showdown-weighted losses
    // mean you are paying off value; pre-showdown losses mean bluffs are not
    // getting through or you are folding the best hand before the river. The
    // comparison flips by sign: when winning, the bigger profit is the larger
    // positive number; when losing, the bigger loss is the more negative number.
    var showdownDominates = isProfitable
      ? (topShowdownPnl > topNonShowdownPnl)
      : (topShowdownPnl < topNonShowdownPnl);
    if (isProfitable) {
      severity = 'g';
      if (showdownDominates) {
        impactText = 'Most of the profit against ' + worstNames + ' comes at showdown: your value hands are getting paid.';
        soWhatText = 'Keep betting your strong hands for value against ' + worstNames + ' rather than slowing down. They are paying you off, so make the bets bigger when they keep calling.';
      } else {
        impactText = 'Most of the profit against ' + worstNames + ' comes before showdown: your bets and raises are taking pots down.';
        soWhatText = 'Keep applying pressure to ' + worstNames + '. They fold too much, so keep barrelling the spots where they give up rather than checking back.';
      }
    } else {
      severity = totalPnl <= -20 ? 'r' : 'a';
      if (showdownDominates) {
        impactText = 'Most of the loss against ' + worstNames + ' lands at showdown: you are calling the river and paying off their value.';
        soWhatText = 'Against ' + worstNames + ', fold more rivers when they bet big. Stop turning marginal pairs into bluff-catchers; their value range gets there too often for the call to be profitable.';
      } else {
        impactText = 'Most of the loss against ' + worstNames + ' lands before showdown: you are folding too much or firing bluffs that do not get through.';
        soWhatText = 'Against ' + worstNames + ', tighten the spots where you give up to a bet and cut the bluffs they do not fold to. The leak is in the streets before the river, not at showdown.';
      }
    }

    var examples = [];
    var topToShow = top.slice(0, 3);
    for (var t = 0; t < topToShow.length; t++) {
      var p = topToShow[t];
      var phs = handsFromIdxs(hands, p.handIdxs, 12);
      if (!phs.length) continue;
      var noteVerb = isProfitable ? 'beating' : 'losing to';
      examples.push({
        id: 'players-' + label + '-' + p.name.toLowerCase().replace(/\W+/g, '-'),
        label: 'Hands vs ' + p.name,
        hands: phs,
        coachingNote: 'You are ' + noteVerb + ' ' + p.name + ' for ' + fmtPnl(p.heroPnl) + ' across ' + p.hands + ' hands. ' +
          'Look for the pattern that repeats; that is where the result is coming from.'
      });
    }

    var deltaUnits = Math.min(2, Math.abs(totalPnl) / 100);
    return F({
      id: 'players-' + label,
      name: isProfitable ? 'Profitable Opponents' : 'Unprofitable Opponents',
      severity: severity,
      magnitude: deltaUnits,
      openingText: openingText,
      branchTexts: branchTexts,
      impactText: impactText,
      soWhatText: soWhatText,
      examples: examples,
      meta: {
        direction: direction,
        count: matching.length,
        totalPnl: totalPnl,
        totalHands: totalHands,
        typeCounts: typeCounts,
        topShowdownPnl: topShowdownPnl,
        topNonShowdownPnl: topNonShowdownPnl,
        top: top
      }
    });
  }

  Sections.defineSection({
    id: 'players',
    panel: 'Players',
    run: function(d, extras, hands) {
      if (!hands || !hands.length) return [];
      var profiles = buildProfiles(hands);
      if (!profiles.length) return [];

      var out = [];
      var styles = STYLE_LIST;
      for (var i = 0; i < styles.length; i++) {
        var s = buildPlaystyleStory(styles[i], profiles, hands);
        if (s) out.push(s);
      }

      var prof = buildNamedOpponentStory('profitable', profiles, hands);
      if (prof) out.push(prof);
      var unprof = buildNamedOpponentStory('unprofitable', profiles, hands);
      if (unprof) out.push(unprof);

      return out;
    }
  });
})();
