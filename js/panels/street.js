// ── STREET PANEL ──────────────────────────────────────────────────────────────

var _streetChart = null;

function renderStreet(container, d, hands) {
  if (_streetChart) { _streetChart.destroy(); _streetChart = null; }

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

  // Chart: Action breakdown by street
  stHtml += '<div class="sec-subtitle">Action Breakdown by Street</div>';
  stHtml += '<div style="position:relative;width:100%;max-width:720px;"><canvas id="street-action-chart"></canvas></div>';

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

  // ── Render Chart.js stacked bar chart ──
  var canvas = document.getElementById('street-action-chart');
  if (!canvas) return;

  var styles = getComputedStyle(document.documentElement);
  var dimColor = styles.getPropertyValue('--dim').trim() || '#666';
  var borderColor = styles.getPropertyValue('--border').trim() || '#333';
  var redColor = styles.getPropertyValue('--red').trim() || '#e74c3c';
  var greenColor = styles.getPropertyValue('--green').trim() || '#2ecc71';
  var amberColor = styles.getPropertyValue('--amber').trim() || '#e67e22';
  var goldColor = styles.getPropertyValue('--gold').trim() || '#f1c40f';

  var foldData = [], checkData = [], callData = [], raiseData = [];
  for (var si = 0; si < streets.length; si++) {
    var ss = d.ss[streets[si]];
    var tot = ss.f + ss.ch + ss.ca + ss.ra;
    foldData.push(tot > 0 ? Math.round(ss.f / tot * 100) : 0);
    checkData.push(tot > 0 ? Math.round(ss.ch / tot * 100) : 0);
    callData.push(tot > 0 ? Math.round(ss.ca / tot * 100) : 0);
    raiseData.push(tot > 0 ? Math.round(ss.ra / tot * 100) : 0);
  }

  _streetChart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: streets,
      datasets: [
        {
          label: 'Fold',
          data: foldData,
          backgroundColor: redColor + '99',
          borderColor: redColor,
          borderWidth: 1,
          borderRadius: 2,
        },
        {
          label: 'Check',
          data: checkData,
          backgroundColor: dimColor + '66',
          borderColor: dimColor,
          borderWidth: 1,
          borderRadius: 2,
        },
        {
          label: 'Call',
          data: callData,
          backgroundColor: goldColor + '99',
          borderColor: goldColor,
          borderWidth: 1,
          borderRadius: 2,
        },
        {
          label: 'Raise/Bet',
          data: raiseData,
          backgroundColor: greenColor + '99',
          borderColor: greenColor,
          borderWidth: 1,
          borderRadius: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      aspectRatio: 2.8,
      plugins: {
        legend: {
          display: true,
          position: 'top',
          align: 'start',
          labels: {
            color: dimColor,
            font: { family: 'IBM Plex Mono', size: 11 },
            boxWidth: 14,
            boxHeight: 2,
            padding: 16,
          },
        },
        tooltip: {
          backgroundColor: 'rgba(20,20,28,0.95)',
          titleColor: '#aaa',
          bodyColor: '#eee',
          borderColor: borderColor,
          borderWidth: 1,
          titleFont: { family: 'IBM Plex Mono', size: 11 },
          bodyFont: { family: 'IBM Plex Mono', size: 11 },
          padding: 10,
          callbacks: {
            label: function(ctx) {
              var streetIdx = ctx.dataIndex;
              var ss = d.ss[streets[streetIdx]];
              var counts = [ss.f, ss.ch, ss.ca, ss.ra];
              return ' ' + ctx.dataset.label + ': ' + ctx.parsed.y + '% (' + counts[ctx.datasetIndex] + ' actions)';
            },
          },
        },
      },
      scales: {
        x: {
          stacked: true,
          ticks: {
            color: dimColor,
            font: { family: 'IBM Plex Mono', size: 10 },
          },
          grid: { color: 'transparent' },
          border: { color: borderColor },
        },
        y: {
          stacked: true,
          max: 100,
          ticks: {
            color: dimColor,
            font: { family: 'IBM Plex Mono', size: 9 },
            callback: function(val) { return val + '%'; },
          },
          grid: { color: 'rgba(255,255,255,0.04)' },
          border: { display: false },
        },
      },
    },
  });
}
