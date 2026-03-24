// ── BETS PANEL ────────────────────────────────────────────────────────────────

function renderBets(container, d, hands) {
  var betStreets = ['Preflop', 'Flop', 'Turn', 'River'];
  var avgBets = {};
  var avgBetsBB = {};
  betStreets.forEach(function(s) {
    avgBets[s] = Math.round(avg(d.betAmts[s]));
    avgBetsBB[s] = avg(d.betAmtsBB ? d.betAmtsBB[s] : []);
  });
  d.avgBetPre = avgBets.Preflop; d.avgBetFlop = avgBets.Flop;
  d.avgBetTurn = avgBets.Turn; d.avgBetRiver = avgBets.River;
  d.avgBetBBFlop = avgBetsBB.Flop; d.avgBetBBTurn = avgBetsBB.Turn; d.avgBetBBRiver = avgBetsBB.River;
  var betDisplay = {};
  betStreets.forEach(function(s) {
    betDisplay[s] = _displayBB && d.betAmtsBB && d.betAmtsBB[s] && d.betAmtsBB[s].length
      ? avg(d.betAmtsBB[s]) : avg(d.betAmts[s]);
  });
  var maxAvg = Math.max(betDisplay.Preflop, betDisplay.Flop, betDisplay.Turn, betDisplay.River, 1);
  var betHtml = '<div class="panel-title">Bets</div>';
  betHtml += '<div class="panel-desc">Average bet sizing across streets.</div>';
  betHtml += '<div class="p-row"><div class="two-col">';
  betHtml += '<div><div class="sec-subtitle">Average bet size by street</div><div class="bar-group">' +
    betStreets.filter(function(s) { return betDisplay[s] > 0; }).map(function(s) {
      return barRow(s, betDisplay[s], maxAvg, 'o', fmtAvgAmount(d.betAmts[s], d.betAmtsBB ? d.betAmtsBB[s] : []), d.betAmts[s] ? d.betAmts[s].length + ' bets' : '');
    }).join('') + '</div></div>';
  betHtml += '<div><div class="sec-subtitle">Bet frequency (when you had the option)</div><div class="bar-group">' +
    betStreets.map(function(s) {
      var bo = d.betOpps[s];
      if (!bo || !bo.t) return null;
      var fp2 = pct(bo.b, bo.t);
      var cls = fp2 < 25 ? 'r' : fp2 > 65 ? 'a' : 'g';
      return barRow(s, fp2 || 0, 100, cls, (fp2 !== null ? fp2 + '%' : '—'), bo.b + '/' + bo.t + ' opps');
    }).filter(Boolean).join('') + '</div></div>';
  betHtml += '</div></div>';

  var bIns = [];
  if (d.avgBetFlop > 0) {
    var exFlopBet = findExampleHand(function(h) {
      if (!h.board || h.board.length < 3) return false;
      return parseActions(h.actions).some(function(a) { return a.isMe && a.street === 'Flop' && (a.type === 'raise' || a.type === 'bet'); });
    });
    var flopDisp = fmtAvgAmount(d.betAmts.Flop, d.betAmtsBB ? d.betAmtsBB.Flop : []);
    bIns.push(insWithExample('o', 'Flop Sizing', 'Average flop bet: ' + flopDisp + '. In TC, aim for 60–80% of pot. Everyone calls so bet for maximum value.', [{
      v: 'Avg: ' + flopDisp,
      hi: true,
    }], exFlopBet, 'This hand shows your typical flop bet sizing. In TC where players call wide, sizing between 60–80% of pot extracts maximum value from weaker hands chasing draws.'));
  }
  if (d.avgBetTurn > 0) {
    var bigger = d.avgBetTurn >= d.avgBetFlop;
    var exTurnBet = findExampleHand(function(h) {
      if (!h.board || h.board.length < 4) return false;
      return parseActions(h.actions).some(function(a) { return a.isMe && a.street === 'Turn' && (a.type === 'raise' || a.type === 'bet'); });
    });
    var turnDisp = fmtAvgAmount(d.betAmts.Turn, d.betAmtsBB ? d.betAmtsBB.Turn : []);
    var flopDispT = fmtAvgAmount(d.betAmts.Flop, d.betAmtsBB ? d.betAmtsBB.Flop : []);
    bIns.push(insWithExample(bigger ? 'g' : 'a', 'Turn Sizing', bigger ? 'Turn bets (' + turnDisp + ') larger than flop — correct as the pot grows.' : 'Turn bets (' + turnDisp + ') smaller than flop (' + flopDispT + '). Size up on the turn.', [{
      v: 'Avg: ' + turnDisp,
      hi: true,
    }], exTurnBet, bigger ? 'Good turn sizing here — increasing your bet as the pot grows puts maximum pressure on drawing hands and builds value.' : 'Your turn bet here was smaller than your flop bet. As the pot grows, your bets should scale up to charge opponents for chasing.'));
  }
  if (d.avgBetRiver > 0) {
    var exRiverBet = findExampleHand(function(h) {
      if (!h.board || h.board.length < 5) return false;
      if (!h.outcome || h.outcome.result !== 'won') return false;
      return parseActions(h.actions).some(function(a) { return a.isMe && a.street === 'River' && (a.type === 'raise' || a.type === 'bet'); });
    });
    var riverDisp = fmtAvgAmount(d.betAmts.River, d.betAmtsBB ? d.betAmtsBB.River : []);
    bIns.push(insWithExample('o', 'River Sizing', 'Average river bet: ' + riverDisp + '. The river is where you get paid — bet big with the best hand.', [{
      v: 'Avg: ' + riverDisp,
      hi: true,
    }], exRiverBet, 'This winning hand shows the river paying off. Size up with strong hands — TC players will call with second-best hands more often than they should.'));
  }
  var fbo = d.betOpps['Flop'];
  if (fbo && fbo.t >= 3 && pct(fbo.b, fbo.t) < 30) {
    var exFlopPassive = findExampleHand(function(h) {
      if (!h.board || h.board.length < 3) return false;
      var ma = parseActions(h.actions).filter(function(a) { return a.isMe && a.street === 'Flop'; });
      return ma.some(function(a) { return a.type === 'check' || a.type === 'call'; }) && !ma.some(function(a) { return a.type === 'raise'; });
    });
    bIns.push(insWithExample('r', 'Flop Passivity', 'Only betting the flop ' + pct(fbo.b, fbo.t) + '% of the time. Checking strong hands gives free cards to draws.', [{
      v: fbo.b + '/' + fbo.t + ' opportunities',
    }], exFlopPassive, 'On this flop you checked or called instead of betting. Betting puts opponents on the defensive and charges draws. In TC where players call wide, you want to be the one setting the price.'));
  }
  betHtml += '<div class="p-row">' + renderInsights(bIns, 'Bets', 'More hands needed for bet sizing patterns.') + '</div>';
  container.innerHTML = betHtml;
}
