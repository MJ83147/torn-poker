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
      losingImpact: 'Cannons see too many flops and call too far without the hand to back it up. Your losses come from getting outdrawn in cheap pots or paying off the one time they actually have it.',
      losingSoWhat: 'Bet top pair and better for three streets and cut the bluffs, since they rarely fold. Charge their draws by sizing up on wet boards, and when a cannon suddenly raises big, give them credit and let the marginal hands go.',
      winningSoWhat: 'Keep value-betting cannons across all three streets and skip the bluffs. Push your sizing up while they keep calling, and still step off the gas the rare time they raise into you.'
    },
    LAG: {
      name: 'vs Loose-Aggressive opponents',
      shortPlural: 'LAGs',
      shortSingle: 'a LAG',
      losingImpact: 'LAGs bet and raise with wide ranges, and you are either folding the best hand or paying off the spots where they happen to have it. Their pressure is working because your responses are too clean.',
      losingSoWhat: 'Call down lighter and stop folding pairs and strong draws to a single barrel, since most of their bets are not value. Three-bet your good hands preflop to play bigger pots in position, and let them keep firing into your made hands instead of folding.',
      winningSoWhat: 'Keep playing back at LAG aggression and calling down with mid-strength hands. Trap your strong holdings by letting them barrel, and three-bet the spots where they open too wide.'
    },
    Nit: {
      name: 'vs Nits',
      shortPlural: 'nits',
      shortSingle: 'a nit',
      losingImpact: 'Nits only put chips in with premium hands, so paying off their bets and raises is where the money goes.',
      losingSoWhat: 'When a nit bets or raises, fold top pair and anything weaker, because that line is value almost every time. Win it back by stealing their blinds and betting whenever they check, since they fold everything but premiums.',
      winningSoWhat: 'Keep stealing blinds and small pots from nits and keep folding to their raises. Bet the flops they check to you, and skip the hero calls when they finally wake up with a hand.'
    },
    Station: {
      name: 'vs Stations',
      shortPlural: 'stations',
      shortSingle: 'a station',
      losingImpact: 'Stations call far too wide and almost never fold, so every bluff you fire just hands them the pot. The losses come from betting hands that cannot get called by worse.',
      losingSoWhat: 'Drop the bluffs entirely and bet top pair or better for three streets, since they will pay off with much weaker. Size up your value bets rather than checking, and stop trying to make them fold.',
      winningSoWhat: 'Keep value-betting stations thin and across all three streets. Cut any leftover bluffs and push your sizing larger while they keep calling.'
    },
    Maniac: {
      name: 'vs Maniacs',
      shortPlural: 'maniacs',
      shortSingle: 'a maniac',
      losingImpact: 'Maniacs bet and raise relentlessly with almost any two cards, so folding too much leaks chips while the rare big hand catches you out. Most of their barrels are air.',
      losingSoWhat: 'Call down with any pair or strong draw and stop folding one-pair hands to a single barrel. Three-bet your premiums for value rather than slow-playing, and let them keep bluffing into your made hands instead of trying to outplay them.',
      winningSoWhat: 'Keep calling maniacs down with showdown-strength hands and let them bluff off their chips. Three-bet your strongest holdings for value and avoid fancy plays; a straightforward call-down beats them.'
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

    // unionIdxs dedupes hands that contained more than one opponent of this
    // type, so it is the honest set of distinct hands. distinctPnl sums each
    // distinct hand once; totalPnl (summed per opponent above) double-counts a
    // hand shared by two of them, so the headline must use distinctPnl.
    var unionIdxs = combineHandIdxs(matching);
    var distinctPnl = 0;
    for (var u = 0; u < unionIdxs.length; u++) {
      var h = hands[unionIdxs[u]];
      if (!h || !h.outcome) continue;
      distinctPnl += getHandPnlValue(h);
      if (heroSawShowdown(h)) {
        totalShowdown++;
        if (h.outcome.result === 'won') totalShowdownWon++;
      }
    }

    var winRate = safePct(totalWon, totalContested);
    var distinctHands = unionIdxs.length;
    var avgPerHand = distinctHands > 0 ? distinctPnl / distinctHands : 0;
    var perHandThreshold = 2;

    var severity;
    if (avgPerHand <= -perHandThreshold) severity = 'r';
    else if (avgPerHand < 0) severity = 'a';
    else severity = 'g';

    var openingText = 'You have faced a group of ' + matching.length + ' ' +
      meta.shortPlural + ' (' + MIN_PROFILE_HANDS + '+ hands each) across ' + distinctHands + ' hands. ' +
      (distinctPnl < 0 ? 'You are down ' : 'You are up ') + fmt(Math.abs(distinctPnl)) +
      ' against them overall, about ' + fmt(Math.abs(avgPerHand)) + ' a hand.';

    var branchTexts = [];

    if (winRate != null) {
      if (winRate >= 50 && distinctPnl < 0) {
        branchTexts.push('You win ' + Math.round(winRate) + '% of the pots you contest with this group but still lose overall, so the pots you lose are bigger than the ones you win.');
      } else if (winRate < 50 && distinctPnl > 0) {
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
      if (wsd != null) {
        branchTexts.push('You reached showdown ' + totalShowdown + ' times against this group and won ' +
          Math.round(wsd) + '% of them.');
      }
    }

    var impactText = null;
    var soWhatText = null;
    if (severity === 'r' || severity === 'a') {
      impactText = meta.losingImpact;
      soWhatText = meta.losingSoWhat;
    } else if (distinctPnl > 0) {
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
        distinctPnl: distinctPnl,
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

    var leadNames = top.slice(0, 3).map(function(p) {
      return p.name + ' (' + fmtPnl(p.heroPnl) + ' across ' + p.hands + ' hands)';
    });
    var openingText = (isProfitable
        ? 'You are showing a profit against ' + matching.length + ' opponents'
        : 'You are losing to ' + matching.length + ' opponents') +
      ' with ' + MIN_NAMED_HANDS + '+ hands each. The biggest swings: ' + joinList(leadNames) + '.';

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
    var topNames = joinList(top.slice(0, Math.min(3, top.length)).map(function(p) { return p.name; }));
    // Only name a channel (showdown vs before showdown) when that channel
    // genuinely carries the result for the top names. The dominant channel must
    // have the right sign: a profit channel is the larger positive number, a
    // loss channel is the more negative number. When both channels point the
    // same way (e.g. the loss sits with opponents outside the top few), stay
    // neutral rather than claim the money landed somewhere it did not.
    var channel = 'neither';
    if (isProfitable) {
      if (topShowdownPnl > 0 && topShowdownPnl > topNonShowdownPnl) channel = 'showdown';
      else if (topNonShowdownPnl > 0 && topNonShowdownPnl > topShowdownPnl) channel = 'preshowdown';
    } else {
      if (topShowdownPnl < 0 && topShowdownPnl < topNonShowdownPnl) channel = 'showdown';
      else if (topNonShowdownPnl < 0 && topNonShowdownPnl < topShowdownPnl) channel = 'preshowdown';
    }
    if (isProfitable) {
      severity = 'g';
      if (channel === 'showdown') {
        impactText = 'Most of the profit against ' + topNames + ' comes at showdown: your value hands are getting paid.';
        soWhatText = 'Keep betting your strong hands for value against ' + topNames + ' rather than slowing down. They are paying you off, so make the bets bigger when they keep calling.';
      } else if (channel === 'preshowdown') {
        impactText = 'Most of the profit against ' + topNames + ' comes before showdown: your bets and raises are taking pots down.';
        soWhatText = 'Keep applying pressure to ' + topNames + '. They fold too much, so keep barrelling the spots where they give up rather than checking back.';
      } else {
        impactText = 'You are showing a clear profit against ' + topNames + ', at showdown and before it.';
        soWhatText = 'Keep doing what works against ' + topNames + ': bet your strong hands for value and keep pressuring the spots where they fold.';
      }
    } else {
      severity = totalPnl <= -20 ? 'r' : 'a';
      if (channel === 'showdown') {
        impactText = 'Most of the loss against ' + topNames + ' lands at showdown: you are calling the river and paying off their value.';
        soWhatText = 'Against ' + topNames + ', fold more rivers when they bet big. Stop turning marginal pairs into bluff-catchers; their value range gets there too often for the call to be profitable.';
      } else if (channel === 'preshowdown') {
        impactText = 'Most of the loss against ' + topNames + ' lands before showdown: you are folding too much or firing bluffs that do not get through.';
        soWhatText = 'Against ' + topNames + ', tighten the spots where you give up to a bet and cut the bluffs they do not fold to. The leak is in the streets before the river, not at showdown.';
      } else {
        impactText = 'The losses against ' + topNames + ' are split fairly evenly between showdown and the streets before it.';
        soWhatText = 'Against ' + topNames + ', work both ends: fold more rivers when they bet big, and cut the earlier bluffs they will not fold to.';
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
