(function() {
  var MIN_PROFILE_HANDS = 50;   // hands needed before classifying an opponent
  var MIN_NAMED_HANDS = 30;     // hands needed to enter profitable/unprofitable
  var MIN_TYPE_OPPONENTS = 3;   // opponents of one type required to fire story

  function safePct(num, den) {
    if (!den) return null;
    return Math.round((num / den) * 1000) / 10;
  }

  // Thresholds must stay in sync with helpers/styleDetector.js so labels match
  // across welcome target picker, My Game and Style Map.
  function classifyVillain(vpip, af) {
    if (vpip == null || af == null) return 'Unknown';
    if (vpip >= 45 && af >= 40) return 'Maniac';
    if (vpip >= 28) {
      if (af >= 30) return 'LAG';
      if (af >= 20) return 'Cannon';
      return 'Station';
    }
    if (vpip < 14) return 'Nit';
    if (af >= 35) return 'Shark';
    if (af >= 25) return 'TAG';
    return 'Rock';
  }

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

    var profiles = [];
    for (var name in nameToHandIdx) {
      var idxs = nameToHandIdx[name];
      if (!idxs || !idxs.length) continue;

      var stats = computeOpponentStats(hands, name);
      if (!stats) continue;

      var vpip = (typeof pct === 'function') ? pct(stats.vpipHands, stats.hands) : null;
      var af = (typeof calcAggression === 'function')
        ? calcAggression(stats.totalRaises, stats.totalCalls, stats.totalChecks)
        : null;
      var type = classifyVillain(vpip, af);

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
      losingSoWhat: 'Avoid hero calls against sharks. Pick your battles, fold dominated hands, and only put chips in with strong value or clear bluff-catchers.',
      winningSoWhat: 'Stay disciplined against sharks. Avoid fancy lines, stick to value, and pick off only the spots where the board clearly favours you.'
    },
    TAG: {
      name: 'vs Tight-Aggressive opponents',
      shortPlural: 'TAGs',
      shortSingle: 'a TAG',
      losingImpact: 'TAGs only get involved with strong holdings and apply pressure when they do. Calling wide against them pays off their value range.',
      losingSoWhat: 'Tighten up the calls against TAG raises. Fold dominated hands and three-bet the spots where you do continue.',
      winningSoWhat: 'Keep doing what works against TAGs. Stay disciplined on calls and pick off their thin barrels when the board favours your range.'
    },
    Rock: {
      name: 'vs Rocks',
      shortPlural: 'rocks',
      shortSingle: 'a rock',
      losingImpact: 'Rocks only continue with value, but you may be paying off their rare aggression too often.',
      losingSoWhat: 'When a rock bets or raises, fold marginal hands. Use their tightness against them by stealing pots when they show weakness.',
      winningSoWhat: 'Keep attacking when a rock checks or limps. They give up easily, so apply pressure on safe boards.'
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
    var avgPerHand = totalHands > 0 ? totalPnl / totalHands : 0;
    var perHandThreshold = 2;

    var severity;
    if (avgPerHand <= -perHandThreshold) severity = 'r';
    else if (avgPerHand < 0) severity = 'a';
    else severity = 'g';

    var openingText = 'Across ' + matching.length + ' ' + meta.shortPlural +
      ' with ' + MIN_PROFILE_HANDS + '+ hands each you have played ' + totalHands +
      ' hands. Net P&L vs this group: ' + fmtPnl(totalPnl) +
      ' (' + fmtPnl(avgPerHand) + ' per hand)' +
      (winRate != null ? ', win rate ' + Math.round(winRate) + '%' : '') + '.';

    var branchTexts = [];

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
    return {
      id: 'players-vs-' + type.toLowerCase(),
      name: meta.name,
      panel: 'Players',
      sectionId: 'players',
      severity: severity,
      score: Sections.score(severity, deltaUnits),
      openingText: openingText,
      branchTexts: branchTexts,
      impactText: impactText,
      soWhatText: soWhatText,
      examples: examples,
      meta: {
        type: type,
        opponents: matching.length,
        totalHands: totalHands,
        totalPnl: totalPnl,
        winRate: winRate,
        totalShowdown: totalShowdown,
        totalShowdownWon: totalShowdownWon
      }
    };
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
    if (isProfitable) {
      severity = 'g';
      impactText = 'These are the names paying your bills. The patterns that beat them are the ones to keep tightening.';
      soWhatText = 'Open the hands vs the top names and write down the line that keeps working. Then look for the same setup against other opponents in the pool.';
    } else {
      severity = totalPnl <= -20 ? 'r' : 'a';
      impactText = 'A small number of opponents are responsible for an outsized share of the losses. Fixing the line against them is higher-leverage than reworking the rest of the game.';
      soWhatText = 'Filter to the worst names and watch for the recurring spot: river call-downs, big-pot decisions, or barrel mistakes. That is the leak to fix first.';
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
    return {
      id: 'players-' + label,
      name: isProfitable ? 'Profitable Opponents' : 'Unprofitable Opponents',
      panel: 'Players',
      sectionId: 'players',
      severity: severity,
      score: Sections.score(severity, deltaUnits),
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
    };
  }

  Sections.defineSection({
    id: 'players',
    panel: 'Players',
    run: function(d, extras, hands) {
      if (!hands || !hands.length) return [];
      var profiles = buildProfiles(hands);
      if (!profiles.length) return [];

      var out = [];
      var styles = ['Shark', 'TAG', 'Rock', 'LAG', 'Cannon', 'Nit', 'Station', 'Maniac'];
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
