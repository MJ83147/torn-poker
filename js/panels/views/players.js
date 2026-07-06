// Players panel view: assembles the UI from shared components + playersModel.

function renderPlayers(container, d, hands) {
  var m = playersModel(hands);
  var oppMap = m.oppMap;
  var filtered = m.filtered;

  var _playerSearch = "";
  var _playerSort = { col: "hands", dir: "desc" };

  function toggleWatch(name) {
    var list = getWatchedPlayers();
    var idx = list.indexOf(name);
    if (idx >= 0) list.splice(idx, 1);
    else list.push(name);
    setWatchedPlayers(list);
    renderPlayerList();
  }

  function playerRow(o, maxH, isWatched) {
    var wr = pct(o.won, o.won + o.lost);
    var barW = Math.round((o.hands / maxH) * 100);
    return `<tr class="player-row link" data-player="${o.name}">
      <td class="watch-star${isWatched ? " watched" : ""}" data-watch="${o.name}" title="${isWatched ? "Unwatch" : "Watch"} player">${isWatched ? "&#9733;" : "&#9734;"}</td>
      <td>${o.name}</td><td>${o.hands}</td>
      <td class="spark-cell"><span class="spark" style="width:${barW}%;background:var(--gold2);"></span></td>
      <td class="${wrCls(wr)}">${wr !== null ? wr + "%" : "-"}</td>
      <td class="${pnlCls(o.profit)}">${fmtPnlAgg(o.profit, o.profitBBKnown ? o.profitBB : null)}</td>
    </tr>`;
  }

  function renderPlayerList() {
    if (!filtered.length) {
      container.innerHTML = panelHeader("Players", "Opponent records, head-to-head stats, and watch list.") + emptyState("Not enough shared hands to show opponent stats. Keep playing to build data.");
      return;
    }
    var watched = getWatchedPlayers();
    var searchFiltered = filtered;
    if (_playerSearch) {
      var q = _playerSearch.toLowerCase();
      searchFiltered = filtered.filter(function (o) {
        return o.name.toLowerCase().indexOf(q) !== -1;
      });
    }
    var maxH = Math.max.apply(
      null,
      filtered.map(function (o) {
        return o.hands;
      }),
    );
    var watchedOpps = filtered.filter(function (o) {
      return watched.indexOf(o.name) >= 0;
    });

    var watchedHtml = "";
    if (watchedOpps.length) {
      watchedHtml = section(
        "Watched Players",
        `<div class="list">
          <div class="text-meta">Click star to unwatch &middot; click row to view hands</div>
          <div class="overflow-x">
            <table class="table">
              <thead>${tableHead(["", "Player", "Hands", "", { tip: "Win Rate" }, "Net P&L"])}</thead>
              <tbody>${watchedOpps
                .map(function (o) {
                  return playerRow(o, maxH, true);
                })
                .join("")}</tbody>
            </table>
          </div>
        </div>`,
      );
    }

    var sortedOpps = sortOpponents(searchFiltered, _playerSort.col, _playerSort.dir);
    var metaLine =
      searchFiltered.length +
      " opponents" +
      (_playerSearch ? ' matching "' + _playerSearch.replace(/</g, "&lt;") + '"' : " with 2+ shared hands") +
      " &middot; click star to watch &middot; click row to view hands";

    container.innerHTML =
      panelHeader("Players", "Opponent records, head-to-head stats, and watch list.") +
      panelFindings("Players", d, hands, "Opponent pool is still forming.") +
      section(
        "Head-to-Head",
        `<div class="row between center">
          <div class="text-body">Compare any two players side by side: stats, head-to-head record, and exploit tips.</div>
          <button class="btn btn-primary" id="open-compare-btn">Compare Players</button>
        </div>`,
      ) +
      watchedHtml +
      section(
        "All Opponents",
        `<input type="text" id="player-search" placeholder="Search players&hellip;">
        <div class="list">
          <div class="text-meta">${metaLine}</div>
          <div>
            <table class="table">
              <thead>${tableHead(["", { label: "Player", sort: "name" }, { label: "Hands", sort: "hands" }, "", { tip: "Win Rate", sort: "wr" }, { label: "Net P&L", sort: "pnl" }], _playerSort)}</thead>
              <tbody>${sortedOpps
                .map(function (o) {
                  return playerRow(o, maxH, watched.indexOf(o.name) >= 0);
                })
                .join("")}</tbody>
            </table>
          </div>
        </div>`,
      );

    var searchEl = document.getElementById("player-search");
    if (searchEl) searchEl.value = _playerSearch || "";

    container.querySelectorAll(".watch-star").forEach(function (star) {
      star.onclick = function (e) {
        e.stopPropagation();
        toggleWatch(this.getAttribute("data-watch"));
      };
    });
    container.querySelectorAll(".player-row").forEach(function (row) {
      row.onclick = function () {
        renderPlayerHands(this.getAttribute("data-player"));
      };
    });
    if (searchEl) {
      searchEl.oninput = function () {
        _playerSearch = this.value;
        renderPlayerList();
        var si = document.getElementById("player-search");
        if (si) {
          si.focus();
          si.selectionStart = si.selectionEnd = si.value.length;
        }
      };
    }
    container.querySelectorAll(".sortable[data-sort-col]").forEach(function (th) {
      th.onclick = function () {
        var col = this.getAttribute("data-sort-col");
        if (_playerSort.col === col) {
          _playerSort.dir = _playerSort.dir === "asc" ? "desc" : "asc";
        } else {
          _playerSort.col = col;
          _playerSort.dir = col === "name" ? "asc" : "desc";
        }
        renderPlayerList();
      };
    });

    var cmpBtn = document.getElementById("open-compare-btn");
    if (cmpBtn) {
      cmpBtn.onclick = function () {
        var overlay = document.createElement("div");
        overlay.className = "overlay";
        var box = document.createElement("div");
        box.className = "modal modal-box-compare";
        var closeBtn = document.createElement("button");
        closeBtn.className = "modal-close";
        closeBtn.innerHTML = "&times;";
        function close() {
          overlay.classList.remove(CSS.SHOW);
          setTimeout(function () {
            overlay.remove();
          }, 200);
        }
        closeBtn.onclick = close;
        overlay.onclick = function (e) {
          if (e.target === overlay) close();
        };
        box.appendChild(closeBtn);
        var cmpContent = document.createElement("div");
        // Bare slot host: display:contents, so the compare header/sections
        // stack on the modal's own gap (same plumbing as panel slots).
        cmpContent.setAttribute("data-slot", "compare");
        renderCompare(cmpContent, d, hands);
        box.appendChild(cmpContent);
        overlay.appendChild(box);
        document.body.appendChild(overlay);
        requestAnimationFrame(function () {
          overlay.classList.add(CSS.SHOW);
        });
      };
    }
  }

  function renderPlayerHands(playerName) {
    var opp = oppMap[playerName];
    if (!opp) return;
    var playerHands = opp.handRefs.map(function (idx) {
      return hands[idx];
    });
    var phPage = 0;
    var PH_SIZE = 50;

    var oppStats = computeOpponentStats(hands, playerName);

    function renderPage() {
      var start = phPage * PH_SIZE;
      var end = Math.min(start + PH_SIZE, playerHands.length);
      var page = playerHands.slice(start, end);
      var totalPages = Math.ceil(playerHands.length / PH_SIZE);
      var wr = pct(opp.won, opp.won + opp.lost);

      var ph = `<div class="player-detail">
        <div class="row"><div class="container">
          <div class="row between center saved-section-divider">
            <div class="row center"><button class="btn btn-ghost" id="players-back">&laquo; All Players</button>
            <span class="c-gold fw-semibold">${playerName}</span></div>
            <div class="text-meta">${opp.hands} hands &middot; ${wr !== null ? wr + "% win" : "-"} &middot; ${fmtPnlAgg(opp.profit, opp.profitBBKnown ? opp.profitBB : null)}</div>
          </div>
        </div></div>`;

      var vpip = pct(oppStats.vpipHands, oppStats.hands);
      var pfr = pct(oppStats.pfrHands, oppStats.hands);
      var limp = pct(oppStats.limpHands, oppStats.hands);
      var aggPct = calcAggression(oppStats.totalRaises, oppStats.totalCalls, oppStats.totalChecks);
      var ftr = pct(oppStats.foldedToRaise, oppStats.facedRaise);
      var cbet = pct(oppStats.cbetDone, oppStats.cbetOpps);
      var wtsd = pct(oppStats.wentToShowdown, oppStats.sawFlop);
      var wsd = pct(oppStats.wonAtShowdown, oppStats.wentToShowdown);

      if (oppStats.hands >= 5) {
        var minis = [
          { l: tipWrap("VPIP"), v: vpip !== null ? vpip + "%" : "-", c: sev(vpip, -1, 55, 18, 40) },
          { l: tipWrap("PFR"), v: pfr !== null ? pfr + "%" : "-", c: sev(pfr, 8, 999, 8, 35) },
          { l: tipWrap("Limp"), v: limp !== null ? limp + "%" : "-", c: sev(limp, -1, 30, -1, 20) },
          { l: tipWrap("Aggression"), v: aggPct !== null ? aggPct + "%" : "-", c: sev(aggPct, 15, 999, 15, 50) },
          { l: tipWrap("Fold to Raise"), v: ftr !== null ? ftr + "%" : "-", c: sev(ftr, 25, 65, 25, 65) },
          { l: tipWrap("C-Bet"), v: cbet !== null ? cbet + "%" : "-", c: sev(cbet, -1, 999, -1, 75) },
          { l: tipWrap("WTSD"), v: wtsd !== null ? wtsd + "%" : "-", c: sev(wtsd, 25, 55, 25, 55) },
          { l: tipWrap("WSD"), v: wsd !== null ? wsd + "%" : "-", c: sev(wsd, 35, 999, 35, 60) },
        ];

        var exploitIns = generateExploitInsights(oppStats, playerName, hands);
        ph += `<div class="section"><div class="section-head">Tendencies</div>
          <div class="row"><div class="container player-detail-section">
            ${renderMiniRow(minis)}
            ${exploitIns.length ? `<div class="ins-grid">${exploitIns.join("")}</div>` : ""}
          </div></div></div>`;
      } else {
        ph += `<div class="row"><div class="container"><div class="box lead">Need ${Math.max(0, 5 - oppStats.hands)} more shared hands to show tendency stats (${oppStats.hands}/5 hands).</div></div></div>`;
      }

      ph += `<div class="section"><div class="section-head">Shared Hands</div>
        <div class="row"><div class="container player-detail-section">
          ${totalPages > 1 ? `<div class="row center end">${renderPagination(phPage, playerHands.length, PH_SIZE, "ph-prev", "ph-next")}</div>` : ""}
          <div class="overflow-x"><table class="table"><thead><tr><th>Pos</th><th>Cards</th><th>Board</th><th>Pot</th><th>Actions</th><th>Result</th></tr></thead><tbody>
          ${page
            .map(function (h, pi) {
              return renderHandRow(h, start + pi, null).replace("data-hand-idx", "data-ph-idx");
            })
            .join("")}
          </tbody></table></div>
        </div></div></div>
      </div>`;

      container.innerHTML = ph;
      document.getElementById("players-back").onclick = function () {
        renderPlayerList();
      };
      container.querySelectorAll(".hrow[data-ph-idx]").forEach(function (row) {
        row.onclick = function () {
          var idx = parseInt(this.getAttribute("data-ph-idx"));
          if (!isNaN(idx) && playerHands[idx]) showExampleHandModal(playerHands[idx]);
        };
      });
      var prev = document.getElementById("ph-prev");
      var next = document.getElementById("ph-next");
      if (prev)
        prev.onclick = function () {
          phPage--;
          renderPage();
        };
      if (next)
        next.onclick = function () {
          phPage++;
          renderPage();
        };
    }
    renderPage();
  }

  renderPlayerList();
}

function renderCompare(container, d, hands) {
  var heroName = State.meta.player;
  var players = comparePlayersList(hands, heroName);
  var playerNames = players.names;

  if (playerNames.length < 2) {
    container.innerHTML = `<div class="panel-header">
        <div class="title title-lg c-gold">Head to Head</div>
        <div class="text-body">Compare two players side by side.</div>
        <div class="text-body">Need at least two players in the data to compare.</div>
      </div>`;
    return;
  }

  var p1Default = heroName;
  var p2Default = playerNames[0] === heroName ? playerNames[1] : playerNames[0];

  function buildOptions(selectedName) {
    return playerNames
      .map(function (n) {
        return `<option value="${n}"${n === selectedName ? " selected" : ""}>${n} (${players.counts[n]})</option>`;
      })
      .join("");
  }

  container.innerHTML =
    `<div class="panel-header">
      <div class="title title-lg c-gold">Head to Head</div>
      <div class="text-body">Compare two players side by side.</div>
    </div>` +
    section(
      "",
      `<div class="row center">
        <select id="compare-p1">${buildOptions(p1Default)}</select>
        <span class="text-body fw-semibold">vs</span>
        <select id="compare-p2">${buildOptions(p2Default)}</select>
      </div>
      <div id="compare-body" class="section"></div>`,
    );

  function getStats(name) {
    return name === heroName ? heroStatsMapped(d) : opponentStatsMapped(hands, name);
  }

  function fmtStat(val, suffix) {
    if (val === null) return "-";
    return val + (suffix || "");
  }

  function renderComparison() {
    var p1Name = container.querySelector("#compare-p1").value;
    var p2Name = container.querySelector("#compare-p2").value;
    var body = container.querySelector("#compare-body");
    if (!body) return;

    if (p1Name === p2Name) {
      body.innerHTML = '<div class="text-body">Select two different players to compare.</div>';
      return;
    }

    var s1 = getStats(p1Name);
    var s2 = getStats(p2Name);

    var statRows = [
      { key: "hands", label: "Hands", suffix: "" },
      { key: "vpip", label: "VPIP", suffix: "%" },
      { key: "pfr", label: "PFR", suffix: "%" },
      { key: "agg", label: "Aggression", suffix: "%" },
      { key: "cbet", label: "C-Bet", suffix: "%" },
      { key: "foldToRaise", label: "Fold to Raise", suffix: "%" },
      { key: "wtsd", label: "WTSD", suffix: "%" },
      { key: "limp", label: "Limp", suffix: "%" },
      { key: "wr", label: "Win Rate", suffix: "%" },
    ];

    var rows = statRows
      .map(function (sr) {
        var v1 = s1[sr.key];
        var v2 = s2[sr.key];
        var edge = compareEdgeText(sr.key, v1, v2, s1.hands, s2.hands);
        var better1 =
          (v1 !== null && v2 !== null && v1 > v2 && sr.key !== "foldToRaise" && sr.key !== "limp") ||
          (sr.key === "foldToRaise" && v1 !== null && v2 !== null && v1 < v2) ||
          (sr.key === "limp" && v1 !== null && v2 !== null && v1 < v2);
        var better2 = !better1 && v1 !== null && v2 !== null && v1 !== v2;
        return `<tr>
        <td class="eyebrow">${tipWrap(sr.label)}</td>
        <td class="${better1 ? "c-pos fw-medium" : ""}">${fmtStat(v1, sr.suffix)}${better1 && Math.abs(v1 - v2) >= 3 ? " &#9664;" : ""}</td>
        <td class="${better2 ? "c-pos fw-medium" : ""}">${fmtStat(v2, sr.suffix)}${better2 && Math.abs(v1 - v2) >= 3 ? " &#9664;" : ""}</td>
        <td class="text-meta">${edge}</td>
      </tr>`;
      })
      .join("");

    var tableHtml = `<table class="table"><thead><tr><th>Stat</th><th>${p1Name}</th><th>${p2Name}</th><th>Edge</th></tr></thead><tbody>${rows}</tbody></table>`;

    var shared = compareSharedHands(hands, p1Name, p2Name);
    var h2hHtml = '<div class="section-head">Head-to-Head Record</div>';
    if (shared.hands.length === 0) {
      h2hHtml += '<div class="text-body">No shared hands found between these players.</div>';
    } else {
      var p1WinPct = Math.round((shared.p1Wins / shared.hands.length) * 100);
      h2hHtml += `<div class="stat text-meta">
        <span>${shared.hands.length} shared hands</span>
        <span>${p1Name} won ${shared.p1Wins} (${p1WinPct}%) &middot; ${p2Name} won ${shared.p2Wins}</span>
      </div>
      <button class="btn btn-ghost" id="compare-shared-btn">View ${shared.hands.length} shared hands</button>`;
    }

    var targetName = p2Name !== heroName ? p2Name : p1Name;
    var targetStats = targetName === p1Name ? s1 : s2;
    var exploits = compareExploits(d, targetName, targetStats);
    var exploitHtml = exploits.length
      ? `<div class="section-head">Exploit Tips</div><div class="list">${exploits
          .map(function (x) {
            return `<div class="card card-s2 text-meta">${x}</div>`;
          })
          .join("")}</div>`
      : "";

    var warnHtml = "";
    if (s1.hands < 10 || s2.hands < 10) {
      var lowName = s1.hands < 10 ? p1Name : p2Name;
      var lowCount = s1.hands < 10 ? s1.hands : s2.hands;
      warnHtml = ins("a", "Small Sample", lowName + " only has " + lowCount + " hands. Stats may be unreliable until 20+ hands are available.");
    }

    body.innerHTML = warnHtml + '<div class="overflow-x">' + tableHtml + "</div>" + h2hHtml + exploitHtml;

    if (shared.hands.length > 0) {
      var sharedBtn = container.querySelector("#compare-shared-btn");
      if (sharedBtn) {
        sharedBtn.onclick = function () {
          showExampleHandListModal(p1Name + " vs " + p2Name, shared.hands, "Hands where both players were at the table.");
        };
      }
    }
  }

  renderComparison();
  container.querySelector("#compare-p1").onchange = renderComparison;
  container.querySelector("#compare-p2").onchange = renderComparison;
}
