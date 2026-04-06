// ── RANGE PANEL ───────────────────────────────────────────────────────────────

// Recommended TAG opening ranges per position
var RECOMMENDED_RANGES = {
  'UTG': new Set(['AA','KK','QQ','JJ','TT','99','88','AKs','AQs','AJs','ATs','KQs','KJs','AKo','AQo']),
  'UTG+1': new Set(['AA','KK','QQ','JJ','TT','99','88','77','AKs','AQs','AJs','ATs','KQs','KJs','KTs','QJs','AKo','AQo','AJo']),
  'MP': new Set(['AA','KK','QQ','JJ','TT','99','88','77','66','AKs','AQs','AJs','ATs','A9s','KQs','KJs','KTs','QJs','QTs','JTs','T9s','AKo','AQo','AJo','KQo']),
  'LJ': new Set(['AA','KK','QQ','JJ','TT','99','88','77','66','55','AKs','AQs','AJs','ATs','A9s','A8s','A7s','A6s','A5s','KQs','KJs','KTs','K9s','QJs','QTs','Q9s','JTs','J9s','T9s','98s','AKo','AQo','AJo','KQo']),
  'HJ': new Set(['AA','KK','QQ','JJ','TT','99','88','77','66','55','44','AKs','AQs','AJs','ATs','A9s','A8s','A7s','A6s','A5s','A4s','A3s','A2s','KQs','KJs','KTs','K9s','K8s','QJs','QTs','Q9s','Q8s','JTs','J9s','T9s','T8s','98s','87s','AKo','AQo','AJo','KQo','KJo']),
  'CO': new Set(['AA','KK','QQ','JJ','TT','99','88','77','66','55','44','33','22','AKs','AQs','AJs','ATs','A9s','A8s','A7s','A6s','A5s','A4s','A3s','A2s','KQs','KJs','KTs','K9s','K8s','K7s','K6s','K5s','K4s','K3s','K2s','QJs','QTs','Q9s','Q8s','JTs','J9s','J8s','T9s','T8s','98s','97s','87s','86s','76s','75s','65s','AKo','AQo','AJo','ATo','KQo','KJo','QJo','JTo']),
  'BTN': new Set(['AA','KK','QQ','JJ','TT','99','88','77','66','55','44','33','22','AKs','AQs','AJs','ATs','A9s','A8s','A7s','A6s','A5s','A4s','A3s','A2s','KQs','KJs','KTs','K9s','K8s','K7s','K6s','K5s','K4s','K3s','K2s','QJs','QTs','Q9s','Q8s','Q7s','Q6s','Q5s','JTs','J9s','J8s','J7s','T9s','T8s','T7s','98s','97s','96s','87s','86s','76s','75s','65s','64s','54s','53s','43s','AKo','AQo','AJo','ATo','A9o','A8o','A7o','KQo','KJo','KTo','QJo','QTo','JTo','T9o']),
  'SB': new Set(['AA','KK','QQ','JJ','TT','99','88','77','66','55','AKs','AQs','AJs','ATs','A9s','A8s','A5s','A4s','KQs','KJs','KTs','K9s','QJs','QTs','JTs','T9s','98s','87s','76s','AKo','AQo','AJo','ATo','KQo','KJo']),
  'BB': new Set(['AA','KK','QQ','JJ','TT','99','88','77','66','55','44','33','22','AKs','AQs','AJs','ATs','A9s','A8s','A7s','A6s','A5s','A4s','A3s','A2s','KQs','KJs','KTs','K9s','K8s','K7s','K6s','K5s','K4s','QJs','QTs','Q9s','Q8s','Q7s','Q6s','Q5s','JTs','J9s','J8s','J7s','T9s','T8s','T7s','98s','97s','96s','87s','86s','76s','75s','65s','64s','54s','53s','43s','AKo','AQo','AJo','ATo','A9o','A8o','A7o','A6o','A5o','KQo','KJo','KTo','K9o','QJo','QTo','Q9o','JTo','J9o','T9o','98o','87o']),
};

function renderRange(container, d, hands) {
  var gridR = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];
  var rangePositions = ['All Positions', 'BB', 'SB', 'BTN', 'CO', 'HJ', 'LJ', 'MP', 'UTG', 'UTG+1'];
  var advisorOn = false;

  function buildKey(ri, ci) {
    var r1 = gridR[Math.min(ri, ci)];
    var r2 = gridR[Math.max(ri, ci)];
    if (ri === ci) return r1 + r1;
    return r1 + r2 + (ri < ci ? 's' : 'o');
  }

  function wrColor(w) {
    if (w <= 30) return 'rgb(190, 45, 45)';
    else if (w <= 45) { var t = (w - 30) / 15; return 'rgb(' + Math.round(190 + t * 30) + ',' + Math.round(45 + t * 90) + ',' + Math.round(45) + ')'; }
    else if (w <= 55) { var t2 = (w - 45) / 10; return 'rgb(' + Math.round(220 - t2 * 30) + ',' + Math.round(135 + t2 * 30) + ',' + Math.round(45) + ')'; }
    else if (w <= 70) { var t3 = (w - 55) / 15; return 'rgb(' + Math.round(190 - t3 * 120) + ',' + Math.round(165 - t3 * 10) + ',' + Math.round(45 + t3 * 10) + ')'; }
    return 'rgb(50, 170, 65)';
  }

  function buildRangeContent(filteredHands, posLabel) {
    var rd = analyse(filteredHands);
    var rMap = rd.rangeMap;
    var maxP = 0;
    Object.keys(rMap).forEach(function(k) {
      if (rMap[k].played > maxP) maxP = rMap[k].played;
    });
    function playedColor(played) {
      if (played === 0) return '#111a12';
      var ratio = played / maxP;
      if (ratio <= 0.15) return '#1a2e1e';
      if (ratio <= 0.35) return '#24422a';
      if (ratio <= 0.6) return '#2e5835';
      if (ratio <= 0.8) return '#3a7a42';
      return 'rgb(50, 170, 65)';
    }
    // Advisor: determine recommended set for this position
    var recSet = (advisorOn && posLabel && posLabel !== 'all') ? RECOMMENDED_RANGES[posLabel] : null;
    var overplayed = [];
    var underplayed = [];
    var matchCount = 0;

    var wrGrid = '';
    var freqGrid = '';
    for (var r = 0; r < 13; r++) {
      for (var c = 0; c < 13; c++) {
        var key = buildKey(r, c);
        var data = rMap[key];
        var advCls = '';
        if (recSet) {
          var played = data && data.played > 0;
          var inRec = recSet.has(key);
          if (played && !inRec) { advCls = ' rc-over'; overplayed.push(key); }
          else if (!played && inRec) { advCls = ' rc-under'; underplayed.push(key); }
          else if (played && inRec) { advCls = ' rc-match'; matchCount++; }
        }
        if (data && data.played > 0) {
          var wr2 = pct(data.won, data.played);
          var wrBg = (wr2 !== null ? wrColor(wr2) : '#1e3020');
          wrGrid += '<div class="rc' + advCls + '" style="background:' + wrBg + ';cursor:pointer;" data-key="' + key + '" data-tip="' + key + ' | Win: ' + (wr2 !== null ? wr2 + '%' : 'n/a') + ' (' + data.won + '/' + data.played + ' played, ' + data.dealt + ' dealt) · click to see hands"><span>' + key + '</span></div>';
          freqGrid += '<div class="rc' + advCls + '" style="background:' + playedColor(data.played) + ';cursor:pointer;" data-key="' + key + '" data-tip="' + key + ' | Played ' + data.played + ' of ' + data.dealt + ' dealt · click to see hands"><span>' + key + '</span></div>';
        } else if (data && data.dealt > 0) {
          wrGrid += '<div class="rc rc-unseen' + advCls + '" data-key="' + key + '" data-tip="' + key + ' | Dealt ' + data.dealt + ' times but never played · click to see hands"><span>' + key + '</span></div>';
          freqGrid += '<div class="rc rc-unseen' + advCls + '" data-key="' + key + '" data-tip="' + key + ' | Dealt ' + data.dealt + ' times but never played · click to see hands"><span>' + key + '</span></div>';
        } else {
          var cellType = (r === c) ? 'pair' : (r < c) ? 'suited' : 'offsuit';
          var cellLabel = cellType === 'pair' ? 'Pair' : cellType === 'suited' ? 'Suited' : 'Offsuit';
          wrGrid += '<div class="rc rc-unseen' + advCls + '" data-tip="' + key + ' | Not yet dealt (' + cellLabel + ')"><span>' + key + '</span></div>';
          freqGrid += '<div class="rc rc-unseen' + advCls + '" data-tip="' + key + ' | Not yet dealt (' + cellLabel + ')"><span>' + key + '</span></div>';
        }
      }
    }
    var seen = Object.keys(rMap).filter(function(k) { return rMap[k].dealt > 0; }).length;
    var totalCombos = 169;
    var legend1 = '<div class="range-legend">' +
      '<div class="leg"><div class="leg-sw rc-unseen"></div>Not dealt</div>' +
      '<div class="leg"><div class="leg-sw leg-sw-bad"></div>&lt;30% win</div>' +
      '<div class="leg"><div class="leg-sw leg-sw-mid"></div>~50% win</div>' +
      '<div class="leg"><div class="leg-sw leg-sw-good"></div>&gt;70% win</div>' +
      '</div>';
    var legend2 = '<div class="range-legend">' +
      '<div class="leg"><div class="leg-sw rc-unseen"></div>Not played</div>' +
      '<div class="leg"><div class="leg-sw leg-sw-low"></div>Rarely</div>' +
      '<div class="leg"><div class="leg-sw leg-sw-med"></div>Sometimes</div>' +
      '<div class="leg"><div class="leg-sw leg-sw-high"></div>Most played</div>' +
      '</div>';
    var rangeIns = [];
    var bestKey = null, bestWr = -1, worstKey = null, worstWr = 101, mostPlayed = null, mostCount = 0;
    Object.keys(rMap).forEach(function(k) {
      var rm = rMap[k];
      if (rm.played >= 2) {
        var w2 = pct(rm.won, rm.played);
        if (w2 !== null && w2 > bestWr) { bestWr = w2; bestKey = k; }
        if (w2 !== null && w2 < worstWr) { worstWr = w2; worstKey = k; }
      }
      if (rm.dealt > mostCount) { mostCount = rm.dealt; mostPlayed = k; }
    });
    if (bestKey) {
      var exBest = findExampleHand(function(h) { return parseHoleKey(h.hole) === bestKey && h.outcome && h.outcome.result === 'won'; });
      rangeIns.push(insWithExample('g', 'Best Hand', 'Your strongest combo so far is ' + bestKey + ' at ' + bestWr + '% win rate. Sample size matters though.', [{ v: bestKey, hi: true }, { v: bestWr + '% win' }], exBest, 'Here is a hand where you won with ' + bestKey + '. This combo has been your most profitable — keep playing it confidently but watch for sample size.'));
    }
    if (worstKey && worstKey !== bestKey) {
      var exWorst = findExampleHand(function(h) { return parseHoleKey(h.hole) === worstKey && h.outcome && h.outcome.result !== 'won'; });
      rangeIns.push(insWithExample('r', 'Worst Hand', worstKey + ' has been your weakest at ' + worstWr + '% win rate. Consider tightening or adjusting play with this hand.', [{ v: worstKey, hi: true }, { v: worstWr + '% win' }], exWorst, 'This hand with ' + worstKey + ' did not go well. Review whether you are overplaying this combo or getting into bad spots post-flop.'));
    }
    if (mostPlayed) {
      var exMost = findExampleHand(function(h) { return parseHoleKey(h.hole) === mostPlayed; });
      rangeIns.push(insWithExample('n', 'Most Dealt', 'You have been dealt ' + mostPlayed + ' the most (' + mostCount + ' times). ' + (rMap[mostPlayed].played < mostCount / 2 ? 'You fold it more than half the time.' : 'You play it frequently.'), [{ v: mostPlayed, hi: true }, { v: mostCount + ' dealt' }], exMost, 'Here is a hand where you were dealt ' + mostPlayed + '. ' + (rMap[mostPlayed].played < mostCount / 2 ? 'You fold this hand often — make sure you are not being too tight with it in good positions.' : 'You play this hand frequently — make sure you are not overvaluing it from bad positions.')));
    }
    var coveragePct = Math.round(seen / totalCombos * 100);
    rangeIns.push(ins('n', 'Coverage', 'You have seen ' + seen + ' of ' + totalCombos + ' possible hand combos (' + coveragePct + '%). The more hands you play, the more complete this picture becomes.', [{ v: seen + '/' + totalCombos + ' combos' }]));

    // Position-specific coaching cards
    if (posLabel && posLabel !== 'all') {
      var totalDealt = 0, totalPlayedPos = 0, totalWon = 0;
      Object.keys(rMap).forEach(function(k) { totalDealt += rMap[k].dealt; totalPlayedPos += rMap[k].played; totalWon += rMap[k].won; });
      var vpipPctPos = totalDealt > 0 ? Math.round(totalPlayedPos / totalDealt * 100) : 0;
      var wrPctPos = totalPlayedPos > 0 ? Math.round(totalWon / totalPlayedPos * 100) : 0;
      var posGuide = {
        'BTN': { ideal: '40-55%', tight: 35, loose: 60, desc: 'The button is your most profitable seat. You act last post-flop, so you can play a wide range — suited connectors, broadways, and most pairs are all profitable opens here.' },
        'CO': { ideal: '25-35%', tight: 20, loose: 40, desc: 'Cutoff is the second-best position. You can open wide but be cautious of BTN 3-bets. Strong broadways, suited aces, and pairs down to 55 are standard opens.' },
        'HJ': { ideal: '18-25%', tight: 14, loose: 30, desc: 'Hijack is a middle-late position. Start tightening up — focus on strong broadways, suited connectors T9s+, and pairs 66+. Drop weak suited aces.' },
        'LJ': { ideal: '15-22%', tight: 12, loose: 27, desc: 'Lojack is where your range should start getting noticeably tighter. Stick to pairs 77+, strong broadways ATo+/KJo+, and suited connectors 89s+.' },
        'MP': { ideal: '14-20%', tight: 10, loose: 25, desc: 'Middle position requires discipline. Focus on pairs 77+, AJo+, KQo, and suited broadways. Suited connectors below T9s become marginal.' },
        'UTG': { ideal: '10-16%', tight: 8, loose: 20, desc: 'Under the gun is the tightest position. You have the whole table behind you — stick to pairs 88+, AQo+, AJs+, and KQs. Playing too loose here is a common leak.' },
        'UTG+1': { ideal: '12-18%', tight: 9, loose: 22, desc: 'UTG+1 is nearly as tight as UTG. You can add a few more hands like 77, AJo, KJs, but keep it disciplined. Most of the table still acts after you.' },
        'SB': { ideal: '25-40%', tight: 20, loose: 45, desc: 'Small blind is tricky — you put in half a blind but act first post-flop. Against a single raiser, 3-bet or fold is often better than calling. Defend wide vs BTN steals but tighten up against early position opens.' },
        'BB': { ideal: '35-55%', tight: 25, loose: 60, desc: 'Big blind gets the best pot odds to defend. You should be calling or 3-betting a wide range, especially vs late position opens. However, you are out of position post-flop, so avoid calling with hands that play poorly without initiative.' }
      };
      var guide = posGuide[posLabel];
      if (guide && totalDealt >= 3) {
        rangeIns.push(ins('n', posLabel + ' Guide', guide.desc, [{ v: 'Ideal VPIP: ' + guide.ideal }]));
        if (vpipPctPos < guide.tight) {
          rangeIns.push(ins('r', 'Too Tight from ' + posLabel, 'You are playing ' + vpipPctPos + '% of hands from ' + posLabel + ', which is below the typical range of ' + guide.ideal + '. You may be folding profitable hands. Consider opening wider with suited connectors and broadways.', [{ v: vpipPctPos + '% VPIP' }, { v: guide.ideal + ' ideal' }]));
        } else if (vpipPctPos > guide.loose) {
          rangeIns.push(ins('r', 'Too Loose from ' + posLabel, 'You are playing ' + vpipPctPos + '% of hands from ' + posLabel + ', above the typical range of ' + guide.ideal + '. Tighten up to avoid getting into marginal spots out of position or with weak holdings.', [{ v: vpipPctPos + '% VPIP' }, { v: guide.ideal + ' ideal' }]));
        } else {
          rangeIns.push(ins('g', posLabel + ' VPIP on Track', 'You are playing ' + vpipPctPos + '% of hands from ' + posLabel + ', which is within the typical range of ' + guide.ideal + '. Keep it up.', [{ v: vpipPctPos + '% VPIP' }, { v: guide.ideal + ' ideal' }]));
        }
        if (totalPlayedPos >= 5) {
          rangeIns.push(ins(wrPctPos >= 50 ? 'g' : wrPctPos >= 35 ? 'n' : 'r', posLabel + ' Win Rate', 'You are winning ' + wrPctPos + '% of hands you play from ' + posLabel + ' (' + totalWon + '/' + totalPlayedPos + ').', [{ v: wrPctPos + '% win' }, { v: totalPlayedPos + ' played' }]));
        }
      }
    }

    // Advisor deviation insights
    if (recSet) {
      var totalInRange = recSet.size;
      var fitPct = totalInRange > 0 ? Math.round(matchCount / totalInRange * 100) : 0;
      rangeIns.push(ins(fitPct >= 70 ? 'g' : fitPct >= 40 ? 'a' : 'r', 'Range Fit: ' + fitPct + '%', 'You play ' + matchCount + ' of ' + totalInRange + ' recommended hands for ' + posLabel + '. ' + overplayed.length + ' overplayed, ' + underplayed.length + ' underplayed.', [{ v: matchCount + '/' + totalInRange + ' match', hi: true }, { v: overplayed.length + ' over' }, { v: underplayed.length + ' under' }]));
      if (overplayed.length > 0) {
        var overList = overplayed.slice(0, 8).join(', ') + (overplayed.length > 8 ? ' +' + (overplayed.length - 8) + ' more' : '');
        rangeIns.push(ins('r', 'Overplayed Hands', 'You play these hands from ' + posLabel + ' but they are not in the standard TAG range: ' + overList + '. Consider folding these to tighten up.', [{ v: overplayed.length + ' hands', hi: true }]));
      }
      if (underplayed.length > 0) {
        var underList = underplayed.slice(0, 8).join(', ') + (underplayed.length > 8 ? ' +' + (underplayed.length - 8) + ' more' : '');
        rangeIns.push(ins('a', 'Underplayed Hands', 'These are in the recommended range for ' + posLabel + ' but you are folding them: ' + underList + '. Consider opening these.', [{ v: underplayed.length + ' hands', hi: true }]));
      }
    }

    return { seen: seen, totalCombos: totalCombos, wrGrid: wrGrid, freqGrid: freqGrid, legend1: legend1, legend2: legend2, rangeIns: rangeIns, rMap: rMap };
  }

  function renderRangeGrids(rc) {
    var gridContainer = document.getElementById('range-grids');
    if (!gridContainer) return;
    var advLegend = advisorOn ? '<div class="range-legend range-legend-adv">' +
      '<div class="leg"><div class="leg-sw leg-sw-match"></div>Match</div>' +
      '<div class="leg"><div class="leg-sw leg-sw-over"></div>Overplayed</div>' +
      '<div class="leg"><div class="leg-sw leg-sw-under"></div>Underplayed</div>' +
      '</div>' : '';
    gridContainer.innerHTML =
      '<div class="meta-text mb-20">' + rc.seen + ' of ' + rc.totalCombos + ' hand combos seen · hover any cell for detail</div>' +
      '<div class="two-col">' +
      '<div><div class="sec-subtitle mt-0">Win Rate by Hand</div><div class="range-grid-sm">' + rc.wrGrid + '</div>' + rc.legend1 + advLegend + '</div>' +
      '<div><div class="sec-subtitle mt-0">Hands Played</div><div class="range-grid-sm">' + rc.freqGrid + '</div>' + rc.legend2 + advLegend + '</div>' +
      '</div><div class="divider"></div><div class="ins-grid">' + rc.rangeIns.join('') + '</div>';
  }

  function refreshRange() {
    var pos = document.getElementById('range-pos-filter').value;
    var filtered = (pos === 'all') ? hands : hands.filter(function(h) { return (h.position || '?') === pos; });
    var newRc = buildRangeContent(filtered, pos);
    renderRangeGrids(newRc);
    // Update advisor toggle state
    var advBtn = document.getElementById('range-advisor-btn');
    if (advBtn) {
      advBtn.classList.toggle('active', advisorOn);
      advBtn.textContent = advisorOn ? 'Advisor On' : 'Advisor Off';
    }
    // Disable advisor when All Positions selected
    if (advBtn) {
      advBtn.disabled = (pos === 'all');
      if (pos === 'all') advBtn.classList.remove('active');
    }
  }

  var rc = buildRangeContent(hands, 'all');
  var posOpts = rangePositions.map(function(p) {
    return '<option value="' + (p === 'All Positions' ? 'all' : p) + '">' + p + '</option>';
  }).join('');
  container.innerHTML =
    '<div class="panel-title">Range</div>' +
    '<div class="panel-desc">Full 13x13 hand grid with win rate for every combo.</div>' +
    '<div class="p-row"><div class="flex-gap-6 mb-16">' +
    '<select id="range-pos-filter" class="table-filter">' + posOpts + '</select>' +
    '<button id="range-advisor-btn" class="advisor-btn" disabled>Advisor Off</button>' +
    '</div><div id="range-grids"></div></div>';
  renderRangeGrids(rc);

  // Advisor toggle
  document.getElementById('range-advisor-btn').onclick = function() {
    var pos = document.getElementById('range-pos-filter').value;
    if (pos === 'all') return;
    advisorOn = !advisorOn;
    refreshRange();
  };

  // Position filter change handler
  document.getElementById('range-pos-filter').onchange = function() {
    refreshRange();
  };

  // Range cell click: show hand list for that combo
  container.addEventListener('click', function(e) {
    var cell = e.target.closest('.rc[data-key]');
    if (!cell) return;
    var key = cell.getAttribute('data-key');
    if (!key) return;
    var posFilter = document.getElementById('range-pos-filter').value;
    var baseHands = (posFilter === 'all') ? hands : hands.filter(function(h) { return (h.position || '?') === posFilter; });
    var matched = baseHands.filter(function(h) { return parseHoleKey(h.hole) === key; });
    if (!matched.length) return;
    var currentRc = buildRangeContent(baseHands);
    var rm = currentRc.rMap[key];
    var wr2 = rm && rm.played > 0 ? pct(rm.won, rm.played) : null;

    var existing = document.getElementById('example-hand-modal');
    if (existing) existing.remove();
    var overlay = document.createElement('div');
    overlay.id = 'example-hand-modal';
    overlay.className = 'modal-overlay';
    overlay.onclick = function(ev) { if (ev.target === overlay) closeModal(); };
    var box = document.createElement('div');
    box.className = 'modal-box';
    box.style.position = 'relative';
    box.style.maxHeight = '80vh';
    box.style.overflowY = 'auto';
    var summary = '<div class="modal-title">' + key + '</div>' +
      '<div class="mb-16">' + matched.length + ' hands' +
      (rm ? ' · played ' + rm.played + ' of ' + rm.dealt + ' dealt' : '') +
      (wr2 !== null ? ' · ' + wr2 + '% win rate' : '') + '</div>';
    var rows = matched.map(function(h, idx) {
      var myActs = getActsSummary(h);
      var res = renderResult(h, 'span', 'saved-res');
      return '<div class="range-hand-row" data-ridx="' + idx + '">' +
        '<div class="range-hand-row-top">' +
        '<div class="range-hand-row-side">' +
        '<span class="range-hand-row-pos">' + (h.position || '?') + '</span>' +
        '<span class="range-hand-row-hole">' + (h.hole ? h.hole.join(' ') : '??') + '</span>' +
        '<span class="range-hand-row-board">' + (h.board && h.board.length ? h.board.join(' ') : '—') + '</span>' +
        '</div>' +
        '<div class="range-hand-row-side">' +
        '<span class="range-hand-row-actions">' + myActs + '</span>' +
        res + '</div></div></div>';
    }).join('');
    box.innerHTML = '<button class="modal-close" id="modal-close-btn">&times;</button>' +
      summary + '<div class="mt-12">' + rows + '</div>';
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    requestAnimationFrame(function() { overlay.classList.add('show'); });
    document.getElementById('modal-close-btn').onclick = closeModal;
    box.querySelectorAll('.range-hand-row').forEach(function(row) {
      row.onclick = function() {
        var idx = parseInt(row.getAttribute('data-ridx'));
        if (!isNaN(idx) && matched[idx]) showExampleHandModal(matched[idx]);
      };
    });
  });
}
