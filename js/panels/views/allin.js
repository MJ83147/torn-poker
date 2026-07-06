// All-In EV panel view: assembles the UI from shared components +
// allinCandidates/allinSummary.

var _allinChart = null;
var _allinHands = null;

var _ALLIN_TITLE = "All-In EV";
var _ALLIN_DESC = "Compares actual results vs expected value at all-in showdowns to measure variance.";

function _allinRow(ah, i, withEv) {
  var actCls = ah.actualResult >= 0 ? "c-pos" : "c-neg";
  var evCols = "";
  if (withEv) {
    var evCls = ah.evDiff >= 0 ? "c-pos" : "c-neg";
    evCols = `<td>${fmtPct(ah.equity * 100)}</td>
      <td>${fmt(Math.round(ah.fairShare))}</td>
      <td class="${actCls}">${fmtPnl(Math.round(ah.actualResult))}</td>
      <td class="${evCls}">${ah.evDiff >= 0 ? "+" : ""}${fmt(Math.round(ah.evDiff))}</td>`;
  } else {
    evCols = `<td>${fmt(ah.potAtAllIn)}</td>
      <td class="${actCls}">${fmtPnl(Math.round(ah.actualResult))}</td>`;
  }
  return `<tr class="allin-row link" data-allin-idx="${i}">
    <td>${i + 1}</td>
    <td>${displayCards(ah.heroHole)}</td>
    <td>${ah.opponents
      .map(function (opp) {
        return displayCards(opp);
      })
      .join("<br>")}</td>
    <td>${ah.fullBoard.length ? displayCards(ah.fullBoard) : "&mdash;"}</td>
    <td>${ah.street}</td>
    ${evCols}
  </tr>`;
}

function _wireAllinRows(container, list) {
  container.querySelectorAll(".allin-row").forEach(function (row) {
    row.onclick = function () {
      var idx = parseInt(row.getAttribute("data-allin-idx"));
      if (!isNaN(idx) && list[idx]) showExampleHandModal(list[idx].hand);
    };
  });
}

function renderAllIn(container, d, hands) {
  if (_allinChart) {
    _allinChart.destroy();
    _allinChart = null;
  }

  _allinHands = allinCandidates(hands);

  if (!_allinHands.length) {
    container.innerHTML =
      panelHeader(_ALLIN_TITLE, _ALLIN_DESC) + emptyState("No all-in showdown hands found yet. When you go all-in and both players show cards, those hands appear here with equity calculations.");
    return;
  }

  container.innerHTML =
    panelHeader(_ALLIN_TITLE, _ALLIN_DESC) +
    // Reads d.facedAllin etc, so it works without the Monte Carlo step.
    (d ? panelFindings("All-In EV", d, hands, "Not enough all-in spots yet to call out a pattern.") : "") +
    section(
      "All-In Showdowns",
      `<div class="card text-center">
        <div class="stat">
          <div class="title title-xl">${_allinHands.length}</div>
          <div class="eyebrow">all-in showdown hands detected</div>
        </div>
        <div class="list">
          <button class="btn btn-ghost" id="allin-run-btn">Run Equity Simulation</button>
          <div class="text-meta">Calculates equity for each hand using Monte Carlo simulation</div>
        </div>
      </div>`,
    ) +
    section(
      "Detected All-In Hands",
      `<div class="overflow-x"><table class="table">
        <thead><tr><th>#</th><th>Hole</th><th>vs</th><th>Board</th><th>Street</th><th>Pot</th><th>Result</th></tr></thead>
        <tbody>${_allinHands
          .map(function (ah, i) {
            return _allinRow(ah, i, false);
          })
          .join("")}</tbody>
      </table></div>`,
    );

  _wireAllinRows(container, _allinHands);

  var runBtn = document.getElementById("allin-run-btn");
  if (runBtn) {
    runBtn.onclick = function () {
      runBtn.disabled = true;
      runBtn.textContent = "Simulating… 0/" + _allinHands.length;
      var batchSize = 2;
      var idx = 0;

      function processBatch() {
        var end = Math.min(idx + batchSize, _allinHands.length);
        for (var i = idx; i < end; i++) {
          var ah = _allinHands[i];
          ah.equity = simulateStreet(ah.heroHole, ah.boardAtAllIn, 5000, ah.opponents).equity;
          ah.fairShare = ah.equity * ah.potAtAllIn;
          ah.expectedValue = ah.equity * ah.potAtAllIn - ah.heroInvested;
          ah.evDiff = ah.actualResult - ah.expectedValue;
        }
        idx = end;
        runBtn.textContent = "Simulating… " + idx + "/" + _allinHands.length;

        if (idx < _allinHands.length) {
          setTimeout(processBatch, 0);
        } else {
          showAllInResults(container);
        }
      }
      setTimeout(processBatch, 50);
    };
  }
}

function showAllInResults(container) {
  var allInHands = _allinHands;
  var sum = allinSummary(allInHands);
  var cashAllIns = sum.cashAllIns;

  container.innerHTML =
    panelHeader(_ALLIN_TITLE, _ALLIN_DESC) +
    section(
      "",
      renderMiniRow([
        { l: "All-In Hands", v: allInHands.length, c: "text" },
        { l: "EV Diff", v: (sum.totalEvDiff >= 0 ? "+" : "") + fmt(sum.totalEvDiff), c: sum.totalEvDiff >= 0 ? "g" : "r" },
        { l: "Equity Win Rate", v: sum.equityWinRate !== null ? sum.equityWinRate + "%" : "&mdash;", c: sum.equityWinRate >= 50 ? "g" : "a" },
        { l: "Actual Win Rate", v: sum.actualWinRate !== null ? sum.actualWinRate + "%" : "&mdash;", c: sum.actualWinRate >= 50 ? "g" : "r" },
      ]),
    ) +
    (cashAllIns.length >= 2 ? chartSection("Cumulative All-In Results vs Expected Value (Cash Hands)", "allin-ev-chart") : "") +
    (sum.variance ? emptyState(sum.variance) : "") +
    section(
      "All-In Hand Details",
      (cashAllIns.length < allInHands.length
        ? '<div class="card text-meta allin-caveat">Side pots are approximated using total pot. Tournament hands are included in the table but excluded from the cumulative graph.</div>'
        : "") +
        `<div class="overflow-x"><table class="table">
        <thead><tr><th>#</th><th>Hole</th><th>vs</th><th>Board</th><th>Street</th><th>Equity</th><th>Fair Share</th><th>Actual</th><th>EV Diff</th></tr></thead>
        <tbody>${allInHands
          .map(function (ah, i) {
            return _allinRow(ah, i, true);
          })
          .join("")}</tbody>
      </table></div>`,
    );

  _wireAllinRows(container, allInHands);

  if (cashAllIns.length >= 2) {
    var canvas = document.getElementById("allin-ev-chart");
    if (!canvas) return;

    var colors = getChartColors();

    var chartLabels = [],
      dataActual = [],
      dataExpected = [];
    var cumActual = 0,
      cumExpected = 0;
    for (var gi = 0; gi < cashAllIns.length; gi++) {
      cumActual += cashAllIns[gi].actualResult;
      cumExpected += cashAllIns[gi].expectedValue;
      chartLabels.push(gi + 1);
      dataActual.push(cumActual);
      dataExpected.push(cumExpected);
    }

    if (_allinChart) {
      _allinChart.destroy();
      _allinChart = null;
    }
    _allinChart = createChart(
      canvas,
      "line",
      {
        labels: chartLabels,
        datasets: [
          {
            label: "Actual Results",
            data: dataActual,
            borderColor: colors.gold,
            borderWidth: 2,
            pointRadius: 0,
            pointHitRadius: 6,
            tension: 0.3,
            order: 1,
          },
          {
            label: "Expected (EV)",
            data: dataExpected,
            borderColor: colors.dim,
            borderWidth: 2,
            borderDash: [5, 3],
            pointRadius: 0,
            pointHitRadius: 6,
            tension: 0.3,
            order: 2,
          },
        ],
      },
      {
        interaction: { mode: "index", intersect: false },
        legend: chartLegend(colors),
        tooltip: chartTooltip(colors, {
          title: function (items) {
            return "All-In #" + items[0].label;
          },
          label: function (ctx) {
            return " " + ctx.dataset.label + ": " + fmtPnl(ctx.parsed.y);
          },
        }),
        scales: {
          x: chartXScale(colors, { title: "All-In Hands", tickSize: 9, maxTicksLimit: 8 }),
          y: chartYScaleZeroLine(colors, {
            tickCallback: function (val) {
              return fmt(val);
            },
          }),
        },
      },
    );
  }
}
