// ── STREET PANEL ──────────────────────────────────────────────────────────────

function renderStreet(container, d, hands) {
  var streets = ['Preflop', 'Flop', 'Turn', 'River'];
  var maxSeen = d.ss.Preflop.seen || 1;
  var stHtml = '<div class="two-col" style="margin-bottom:24px;">';
  stHtml += '<div><div class="sec-subtitle">Hands reaching street</div><div class="bar-group">' + streets.map(function(s) {
    var seen2 = d.ss[s].seen;
    return barRow(s, seen2, maxSeen, 'o', seen2, pct(seen2, d.n) + '%');
  }).join('') + '</div></div>';
  stHtml += '<div><div class="sec-subtitle">Your fold % by street</div><div class="bar-group">' + streets.map(function(s) {
    var ss2 = d.ss[s];
    var tot2 = ss2.f + ss2.ch + ss2.ca + ss2.ra;
    var fp2 = pct(ss2.f, tot2);
    return barRow(s, fp2 || 0, 100, fp2 > 55 ? 'r' : 'g', (fp2 !== null ? fp2 + '%' : '—'), ss2.f + ' folds');
  }).join('') + '</div></div>';
  stHtml += '</div>';

  // Average bet size by street
  var stAvgBets = {};
  var stBetDisplay = {};
  var stMaxAvg = 1;
  streets.forEach(function(s) {
    stAvgBets[s] = Math.round(avg(d.betAmts[s]));
    stBetDisplay[s] = _displayBB && d.betAmtsBB && d.betAmtsBB[s] && d.betAmtsBB[s].length
      ? avg(d.betAmtsBB[s]) : avg(d.betAmts[s]);
    if (stBetDisplay[s] > stMaxAvg) stMaxAvg = stBetDisplay[s];
  });
  if (stBetDisplay.Flop > 0 || stBetDisplay.Turn > 0 || stBetDisplay.River > 0) {
    stHtml += '<div class="sec-subtitle">Average bet size by street</div><div class="bar-group">' +
      streets.filter(function(s) { return stBetDisplay[s] > 0; }).map(function(s) {
        return barRow(s, stBetDisplay[s], stMaxAvg, 'o', fmtAvgAmount(d.betAmts[s], d.betAmtsBB ? d.betAmtsBB[s] : []), d.betAmts[s] ? d.betAmts[s].length + ' bets' : '');
      }).join('') + '</div>';
  }

  var sIns = [];
  var fr = pct(d.ss.Flop.seen, d.ss.Preflop.seen);
  var rr = pct(d.ss.River.seen, d.ss.Preflop.seen);
  if (fr !== null) {
    sIns.push(ins('n', 'Street Depth', 'You see the flop ' + fr + '% of hands and reach the river ' + rr + '% of the time.', [{
      v: 'Flop: ' + fr + '%',
    }, {
      v: 'River: ' + rr + '%',
    }]));
  }
  var flopFoldP = pct(d.ss.Flop.f, d.ss.Flop.f + d.ss.Flop.ch + d.ss.Flop.ca + d.ss.Flop.ra);
  var turnFoldP = pct(d.ss.Turn.f, d.ss.Turn.f + d.ss.Turn.ch + d.ss.Turn.ca + d.ss.Turn.ra);
  if (flopFoldP !== null && flopFoldP > 50) {
    var exFlopFold = findExampleHand(function(h) {
      return parseActions(h.actions).some(function(a) { return a.isMe && a.street === 'Flop' && a.type === 'fold'; });
    });
    sIns.push(insWithExample('a', 'Flop Folding', 'You fold ' + flopFoldP + '% on the flop. If you\'re calling pre and folding the flop often, your preflop range is too wide.', [{
      v: d.ss.Flop.f + ' flop folds',
    }], exFlopFold, 'You folded on the flop here. If you\'re entering pots preflop and folding the flop regularly, tighten your preflop range to hands that connect better with boards.'));
  }
  if (turnFoldP !== null && turnFoldP > 55) {
    var exTurnFold = findExampleHand(function(h) {
      return parseActions(h.actions).some(function(a) { return a.isMe && a.street === 'Turn' && a.type === 'fold'; });
    });
    sIns.push(insWithExample('r', 'Turn Folding', 'Folding ' + turnFoldP + '% on the turn. If you have a made hand, bet and protect it — don\'t check-fold to draws.', [{
      v: d.ss.Turn.f + ' turn folds',
    }], exTurnFold, 'You folded on the turn here. If you had a made hand, betting protects it from draws. Check-folding lets opponents draw cheaply and control the pot.'));
  }
  stHtml += renderInsights(sIns, 'Streets', 'Keep building the sample for street-level patterns.');
  container.innerHTML = stHtml;
}
