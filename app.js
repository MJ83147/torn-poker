// ── APP SHELL (DOM + wiring) ────────────────────────────────────────────────

// Global session state, shared with loader.js via setter
let _allHands = [];
let _meta = {};
let _excludedTables = new Set();

function setSession(hands, meta) {
  _allHands = hands.filter(h => inferTable(h) !== null);
  _meta = meta;
}

// Tabs
document.getElementById('tabs').addEventListener('click', function(e) {
  const t = e.target.closest('.tab');
  if (!t) return;
  document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
  t.classList.add('active');
  const id = 'p-' + t.dataset.tab;
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('on'));
  document.getElementById(id).classList.add('on');
});

// Example hand modal helpers (used by insWithExample from helpers.js)
let _modalHands = [];

function showExampleHandModal(hand, coachingNote) {
  const existing = document.getElementById('example-hand-modal');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'example-hand-modal';
  overlay.className = 'modal-overlay';
  overlay.onclick = function(e) { if (e.target === overlay) closeModal(); };

  const box = document.createElement('div');
  box.className = 'modal-box';
  box.style.position = 'relative';

  const closeBtn = '<button class="modal-close" id="modal-close-btn">&times;</button>';
  const title = '<div class="modal-title">' + (hand.hole ? hand.hole.join(' ') : '??') + '</div>';
  const subtitle = '<div class="modal-subtitle">Example hand · ' + (hand.position || '?') + ' position</div>';

  const metaHtml = '<div class="modal-hand-meta">' +
    '<span>Board: <strong>' + (hand.board && hand.board.length ? hand.board.join(' ') : 'none') + '</strong></span>' +
    '<span>Pot: <strong>' + fmt(hand.pot || 0) + '</strong></span>' +
    '<span>Result: <strong>' + (hand.outcome ? hand.outcome.result : '?') + '</strong></span>' +
    '</div>';

  let actionsHtml = '';
  const actions = hand.actions || [];
  for (let i = 0; i < actions.length; i++) {
    const raw = (actions[i] || '');
    const decoded = raw.replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&');
    const isMe = decoded.indexOf('>>') === 0;
    const clean = decoded.replace(/^>>\s*/, '').replace(/^\s+/, '').trim();

    if (
      clean.indexOf('The flop') === 0 ||
      clean.indexOf('The turn') === 0 ||
      clean.indexOf('The river') === 0 ||
      clean.indexOf('The preflop') === 0
    ) {
      actionsHtml += '<div class="modal-action-line street-label">' +
        clean.replace(/: :/, ':').replace(/: $/, '') +
        '</div>';
    } else if (clean.indexOf(': ') > 0) {
      actionsHtml += '<div class="modal-action-line' + (isMe ? ' me' : '') + '">' +
        (isMe ? '▸ ' : '  ') + clean + '</div>';
    }
  }

  const coaching = coachingNote
    ? '<div class="modal-coaching"><div class="modal-coaching-label">What to improve</div>' + coachingNote + '</div>'
    : '';

  box.innerHTML = closeBtn + title + subtitle + metaHtml + actionsHtml + coaching;
  overlay.appendChild(box);
  document.body.appendChild(overlay);
  requestAnimationFrame(function() { overlay.classList.add('show'); });
  document.getElementById('modal-close-btn').onclick = closeModal;
}

function closeModal() {
  const m = document.getElementById('example-hand-modal');
  if (m) {
    m.classList.remove('show');
    setTimeout(function() { m.remove(); }, 200);
  }
}

function findExampleHand(filterFn) {
  for (let i = _modalHands.length - 1; i >= 0; i--) {
    if (filterFn(_modalHands[i])) return _modalHands[i];
  }
  return null;
}

// Saved session: check localStorage and wire restore button
function checkSavedSession() {
  const saved = localStorage.getItem('tc_poker_analysis');
  if (!saved) return;
  try {
    const json = JSON.parse(saved);
    const hands = (Array.isArray(json) ? json : (json.hands || [])).filter(h => h.hole && h.hole.length === 2);
    if (!hands.length) return;
    const playerName = json.player || detectPlayerFromActions(hands) || 'Unknown';
    const rb = document.getElementById('restore-block');
    const rl = document.getElementById('restore-label');
    const date = json.exportedAt ? new Date(json.exportedAt).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }) : '';
    rl.textContent = hands.length + ' hands from ' + playerName + (date ? ' · ' + date : '') + ' found in storage';
    rb.style.display = 'block';
    document.getElementById('restore-btn').onclick = function() {
      const meta = {
        player: playerName,
        exportedAt: json.exportedAt || new Date().toISOString(),
      };
      setSession(hands, meta);
      showImportLoader(hands.length, () => render(
        analyse(hands), hands, meta,
      ));
    };
  } catch (_) {}
}

// Main render function (dashboard)
function render(d, hands, meta) {
  _modalHands = hands; // make available for example hand modal
  document.getElementById('paste-wrap').style.display = 'none';
  document.getElementById('dash').classList.add('on');

  const netPnl = d.totalWonAmount - d.totalInvested;
  const wr = pct(d.handsWon, d.handsWithOutcome);
  const vpipPct = pct(d.vpip, d.n);
  const aggPct = pct(d.raises, d.totalActs);
  const allinFoldPct = pct(d.foldAllin, d.facedAllin);
  document.getElementById('page-meta').textContent = meta.player + ' · ' + new Date(meta.exportedAt).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }) + (_allHands.length && hands.length < _allHands.length ? ' · Filtered: ' + hands.length + '/' + _allHands.length + ' hands' : '');

  // HERO
  const sampleNote = d.n < 50
    ? '<div style="padding:12px 32px;font-size:12px;color:var(--amber);background:rgba(212,132,42,0.08);border-bottom:1px solid var(--border);">⚠ Small sample: ' + d.n + ' hands. The more hands you play and track, the more accurate these stats become. Aim for 100+ hands for reliable patterns.</div>'
    : '';
  document.getElementById('hero-strip').innerHTML = [
    { l: 'Hands',      v: d.n,                        c: 'o' },
    { l: 'Win Rate',   v: wr !== null ? wr + '%' : '—', c: wr >= 50 ? 'g' : 'r' },
    { l: 'Net P&L',    v: (netPnl >= 0 ? '+' : '') + fmt(netPnl), c: netPnl >= 0 ? 'g' : 'r' },
    { l: 'VPIP',       v: vpipPct !== null ? vpipPct + '%' : '—', c: vpipPct > 55 ? 'a' : 'w' },
    { l: 'Aggression', v: aggPct !== null ? aggPct + '%' : '—',   c: aggPct > 25 ? 'g' : 'a' },
    { l: 'vs All-in',  v: allinFoldPct !== null ? allinFoldPct + '% fold' : '—', c: 'w' },
  ].map(h => '<div class="hs"><div class="hs-l">' + tipWrap(h.l) + '</div><div class="hs-v ' + h.c + '">' + h.v + '</div></div>').join('');

  const noteEl = document.getElementById('sample-note');
  if (noteEl) noteEl.innerHTML = sampleNote;
  // ── CARDS ──
  const htOrder = ['Pocket Pairs', 'Broadway', 'Ace-Rag', 'Suited Connectors', 'Suited', 'Connectors', 'Offsuit Trash'];
  const htData = htOrder.filter(ht => d.htMap[ht]);
  const maxDealt = htData.length ? Math.max(...htData.map(ht => d.htMap[ht].dealt)) : 1;
  let cardsHtml = '<div>';
  cardsHtml += '<div>';
  // Legend
  cardsHtml += '<div class="ht-stack-legend">' +
    '<div class="ht-leg-item"><div class="ht-leg-sw" style="background:var(--green);"></div>Won</div>' +
    '<div class="ht-leg-item"><div class="ht-leg-sw" style="background:var(--amber);opacity:0.75;"></div>Played, not won</div>' +
    '<div class="ht-leg-item"><div class="ht-leg-sw" style="background:#2e3e2e;"></div>Dealt, not played</div>' +
    '</div>';
  cardsHtml += htData.map(ht => {
    const s = d.htMap[ht];
    // Bar width relative to max dealt (absolute scale)
    const outerPct = Math.round(s.dealt / maxDealt * 100);
    // Segments as % of the dealt bar
    const wonPct = s.dealt > 0 ? Math.round(s.won / s.dealt * 100) : 0;
    const playedNotWonPct = s.dealt > 0 ? Math.round((s.played - s.won) / s.dealt * 100) : 0;
    const unplayedPct = 100 - wonPct - playedNotWonPct;
    const wrPct = s.played > 0 ? pct(s.won, s.played) : null;
    const wrCol = wrPct === null ? 'var(--dim)' : wrPct >= 55 ? 'var(--green)' : wrPct <= 38 ? 'var(--red)' : 'var(--amber)';
    return '<div class="ht-stack-item">' +
      '<div class="ht-stack-header">' +
      '<span class="ht-stack-name">' + tipWrap(ht) + '</span>' +
      '<span class="ht-stack-meta">' + s.dealt + ' dealt · ' + s.played + ' played · ' +
      '<span style="color:' + wrCol + ';">' + (wrPct !== null ? wrPct + '% win' : '—') + '</span>' +
      '</span>' +
      '</div>' +
      '<div class="ht-stack-track" style="width:' + outerPct + '%;">' +
      '<div class="ht-stack-inner" style="width:100%;">' +
      '<div class="ht-seg-won" style="width:' + wonPct + '%;"></div>' +
      '<div class="ht-seg-played" style="width:' + playedNotWonPct + '%;"></div>' +
      '<div class="ht-seg-unplayed" style="width:' + unplayedPct + '%;"></div>' +
      '</div>' +
      '</div>' +
      '</div>';
  }).join('');
  cardsHtml += '</div>';
  // Insights column
  const cIns = [];
  const ps = d.htMap['Pocket Pairs'];
  const as2 = d.htMap['Ace-Rag'];
  const ts = d.htMap['Offsuit Trash'];
  const scs = d.htMap['Suited Connectors'];
  const bw = d.htMap['Broadway'];
  if (ps && ps.dealt >= 2) {
    const w = pct(ps.won, ps.played || 1);
    const exPair = findExampleHand(function(h) {
      const key = parseHoleKey(h.hole);
      return key && classifyKey(key) === 'Pocket Pairs' && h.outcome && h.outcome.result === (w < 45 ? 'lost' : 'won');
    });
    cIns.push(insWithExample(w < 45 ? 'r' : 'g', 'Pocket Pairs', w < 45 ? 'Winning only ' + w + '% with pairs (' + ps.played + ' played of ' + ps.dealt + ' dealt). Bet hard preflop and charge draws — don\'t slow play.' : 'Good ' + w + '% win rate with pairs (' + ps.played + ' played of ' + ps.dealt + ' dealt). Keep betting them aggressively.', [{
      v: w + '% win',
    }, {
      v: ps.dealt + ' dealt · ' + ps.played + ' played',
    }], exPair, w < 45 ? 'This pocket pair hand was lost. With pairs, aggression preflop builds the pot and charges draws. Slow playing lets opponents catch up cheaply.' : 'This pocket pair hand was won. Pairs are strong — keep betting them aggressively and charging draws.'));
  }
  if (bw && bw.dealt >= 3) {
    const w = pct(bw.won, bw.played || 1);
    const exBw = findExampleHand(function(h) {
      const key = parseHoleKey(h.hole);
      return key && classifyKey(key) === 'Broadway' && h.outcome && h.outcome.result === (w < 45 ? 'lost' : 'won');
    });
    cIns.push(insWithExample(w < 45 ? 'a' : 'g', 'Broadway', w + '% win rate across ' + bw.played + ' played broadway hands (' + bw.dealt + ' dealt). These are premium hands — if you\'re losing with them, check your postflop bet sizing.', [{
      v: bw.dealt + ' dealt · ' + bw.played + ' played',
      hi: true,
    }, {
      v: w + '% win',
    }], exBw, w < 45 ? 'This broadway hand was lost. Broadway hands are premium — ensure you are betting for value and not letting opponents draw cheaply.' : 'This broadway hand was won. Premium hands like these should be your bread and butter.'));
  }
  if (as2 && as2.dealt >= 3) {
    const w = pct(as2.won, as2.played || 1);
    const exAceRag = findExampleHand(function(h) {
      const key = parseHoleKey(h.hole);
      return key && classifyKey(key) === 'Ace-Rag' && h.outcome && h.outcome.result === 'lost';
    });
    cIns.push(insWithExample('a', 'Ace-Rag', 'Dealt ' + as2.dealt + ' times, played ' + as2.played + '. An ace with a weak kicker loses to any better ace — be careful calling raises.', [{
      v: w !== null ? w + '% win' : '?',
    }, {
      v: as2.dealt + ' dealt · ' + as2.played + ' played',
    }], exAceRag, 'This ace-rag hand was lost. Ace with a weak kicker is dominated by any better ace. Avoid calling raises with these unless you have strong position.'));
  }
  if (ts && ts.dealt >= 3) {
    const exTrash = findExampleHand(function(h) {
      const key = parseHoleKey(h.hole);
      if (!key || classifyKey(key) !== 'Offsuit Trash') return false;
      if (!h.outcome || h.outcome.result !== 'lost') return false;
      const ma = parseActions(h.actions).filter(function(a) { return a.isMe; });
      return ma.some(function(a) { return a.type === 'call' || a.type === 'raise'; });
    });
    cIns.push(insWithExample(ts.played > 0 ? 'r' : 'n', 'Offsuit Trash', 'Dealt ' + ts.dealt + ' offsuit trash hands, played ' + ts.played + '. These are almost always folds preflop.', [{
      v: ts.dealt + ' dealt',
    }, {
      v: ts.played + ' played',
    }], exTrash, 'This offsuit trash hand was played and lost. These hands cost chips over time — fold them preflop.'));
  }
  if (scs && scs.dealt >= 3) {
    const w = pct(scs.won, scs.played || 1);
    const exSC = findExampleHand(function(h) {
      const key = parseHoleKey(h.hole);
      return key && classifyKey(key) === 'Suited Connectors';
    });
    cIns.push(insWithExample(w >= 50 ? 'g' : 'a', 'Suited Connectors', w + '% win rate (' + scs.played + ' played of ' + scs.dealt + ' dealt). Play these in position where you have the most ways to win.', [{
      v: scs.dealt + ' dealt · ' + scs.played + ' played',
    }], exSC, 'Suited connectors play best in position with implied odds. They are drawing hands — you want to see flops cheaply and hit straights or flushes.'));
  }
  if (!cIns.length) {
    cIns.push(ins('n', 'Cards', 'More hands needed for card-type breakdowns.', [{
      v: 'Keep playing',
    }]));
  }
  cardsHtml += '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:9px;margin-top:20px;">' + cIns.map(function(c) { return c; }).join('') + '</div>';
  cardsHtml += '</div>';
  document.getElementById('p-cards').innerHTML = cardsHtml;

  // ── POSITION ──
  const posOrder = ['UTG', 'UTG+1', 'MP', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
  let posHtml = '<div style="overflow-x:auto;margin-bottom:24px;"><table class="tbl"><thead><tr><th>Position</th><th>Hands</th><th>' + tipWrap('VPIP') + '</th><th>' + tipWrap('Fold Pre') + '</th><th>' + tipWrap('Win Rate') + '</th><th>' + tipWrap('Net P&L') + '</th><th>' + tipWrap('Avg Pot') + '</th></tr></thead><tbody>';
  posHtml += posOrder.filter(p => d.posMap[p] && d.posMap[p].hands > 0).map(p => {
    const s = d.posMap[p];
    const vp2 = pct(s.vpip, s.hands);
    const fp2 = pct(s.foldPre, s.hands);
    const wr2 = pct(s.won, s.hands);
    const avg = Math.round(s.pot / s.hands);
    const pnlCol = s.pnl >= 0 ? 'var(--green)' : 'var(--red)';
    return '<tr><td>' + tipWrap(p) + '</td><td>' + s.hands + '</td><td>' + (vp2 !== null ? vp2 + '%' : '—') + '</td><td>' + (fp2 !== null ? fp2 + '%' : '—') + '</td><td>' + (wr2 !== null ? wr2 + '%' : '—') + '</td><td style="color:' + pnlCol + '">' + (s.pnl >= 0 ? '+' : '') + fmt(s.pnl) + '</td><td>' + fmt(avg) + '</td></tr>';
  }).join('');
  posHtml += '</tbody></table></div>';
  const pIns = [];
  const earlyH = ['UTG', 'UTG+1', 'MP'];
  const lateH = ['CO', 'BTN'];
  const ev = earlyH.reduce((s, p) => s + (d.posMap[p] ? d.posMap[p].vpip : 0), 0);
  const eh = earlyH.reduce((s, p) => s + (d.posMap[p] ? d.posMap[p].hands : 0), 0);
  const lv = lateH.reduce((s, p) => s + (d.posMap[p] ? d.posMap[p].vpip : 0), 0);
  const lh = lateH.reduce((s, p) => s + (d.posMap[p] ? d.posMap[p].hands : 0), 0);
  const evp = pct(ev, eh);
  const lvp = pct(lv, lh);
  if (evp !== null && evp > 55) {
    const exEarlyWide = findExampleHand(function(h) {
      return earlyH.indexOf(h.position) >= 0 && parseActions(h.actions).some(function(a) { return a.isMe && (a.type === 'call' || a.type === 'raise') && a.street === 'Preflop'; }) && h.outcome && h.outcome.result !== 'won';
    });
    pIns.push(insWithExample('r', 'Early Position VPIP', 'Playing ' + evp + '% from UTG/MP. Act first on every street — keep it to top 15–20% of hands here.', [{
      v: ev + '/' + eh + ' hands played',
    }], exEarlyWide, 'This hand was played from early position and lost. From UTG/MP you act first on every street — only play premium hands here.'));
  } else if (evp !== null) {
    pIns.push(ins('g', 'Early Position VPIP', evp + '% from early position. Good discipline where you have the worst information.', [{
      v: ev + '/' + eh + ' hands',
    }]));
  }
  if (lvp !== null && lvp < 40) {
    const exLateTight = findExampleHand(function(h) {
      return lateH.indexOf(h.position) >= 0 && parseActions(h.actions).some(function(a) { return a.isMe && a.type === 'fold' && a.street === 'Preflop'; });
    });
    pIns.push(insWithExample('a', 'Late Position VPIP', 'Only ' + lvp + '% from CO/BTN — you\'re leaving value behind. Attack the blinds, widen your range here.', [{
      v: lv + '/' + lh + ' hands',
    }], exLateTight, 'This hand was folded from late position. From CO/BTN you have positional advantage — widen your range to attack the blinds.'));
  } else if (lvp !== null) {
    pIns.push(ins('g', 'Late Position VPIP', lvp + '% from late position. Good use of positional advantage.', [{
      v: lv + '/' + lh + ' hands',
    }]));
  }
  if (!pIns.length) {
    pIns.push(ins('n', 'Position', 'More hands needed for positional patterns.', [{
      v: 'Keep playing',
    }]));
  }
  posHtml += pIns.join('');
  document.getElementById('p-position').innerHTML = posHtml;

  // ── STREET ──
  const streets = ['Preflop', 'Flop', 'Turn', 'River'];
  const maxSeen = d.ss.Preflop.seen || 1;
  let stHtml = '<div class="two-col" style="margin-bottom:24px;">';
  stHtml += '<div><div class="sec-subtitle">Hands reaching street</div><div class="bar-group">' + streets.map(s => {
    const seen2 = d.ss[s].seen;
    return barRow(s, seen2, maxSeen, 'o', seen2, pct(seen2, d.n) + '%');
  }).join('') + '</div></div>';
  stHtml += '<div><div class="sec-subtitle">Your fold % by street</div><div class="bar-group">' + streets.map(s => {
    const ss2 = d.ss[s];
    const tot2 = ss2.f + ss2.ch + ss2.ca + ss2.ra;
    const fp2 = pct(ss2.f, tot2);
    return barRow(s, fp2 || 0, 100, fp2 > 55 ? 'r' : 'g', (fp2 !== null ? fp2 + '%' : '—'), ss2.f + ' folds');
  }).join('') + '</div></div>';
  stHtml += '</div>';
  // Average bet size by street
  const stAvgBets = {};
  let stMaxAvg = 1;
  streets.forEach(function(s) {
    var a = d.betAmts[s];
    stAvgBets[s] = a && a.length ? Math.round(a.reduce(function(x, y) { return x + y; }, 0) / a.length) : 0;
    if (stAvgBets[s] > stMaxAvg) stMaxAvg = stAvgBets[s];
  });
  if (stAvgBets.Flop > 0 || stAvgBets.Turn > 0 || stAvgBets.River > 0) {
    stHtml += '<div class="sec-subtitle">Average bet size by street</div><div class="bar-group">' +
      streets.filter(function(s) { return stAvgBets[s] > 0; }).map(function(s) {
        return barRow(s, stAvgBets[s], stMaxAvg, 'o', fmt(stAvgBets[s]), d.betAmts[s] ? d.betAmts[s].length + ' bets' : '');
      }).join('') + '</div>';
  }
  const sIns = [];
  const fr = pct(d.ss.Flop.seen, d.ss.Preflop.seen);
  const rr = pct(d.ss.River.seen, d.ss.Preflop.seen);
  if (fr !== null) {
    sIns.push(ins('n', 'Street Depth', 'You see the flop ' + fr + '% of hands and reach the river ' + rr + '% of the time.', [{
      v: 'Flop: ' + fr + '%',
    }, {
      v: 'River: ' + rr + '%',
    }]));
  }
  const flopFoldP = pct(d.ss.Flop.f, d.ss.Flop.f + d.ss.Flop.ch + d.ss.Flop.ca + d.ss.Flop.ra);
  const turnFoldP = pct(d.ss.Turn.f, d.ss.Turn.f + d.ss.Turn.ch + d.ss.Turn.ca + d.ss.Turn.ra);
  if (flopFoldP !== null && flopFoldP > 50) {
    const exFlopFold = findExampleHand(function(h) {
      return parseActions(h.actions).some(function(a) { return a.isMe && a.street === 'Flop' && a.type === 'fold'; });
    });
    sIns.push(insWithExample('a', 'Flop Folding', 'You fold ' + flopFoldP + '% on the flop. If you\'re calling pre and folding the flop often, your preflop range is too wide.', [{
      v: d.ss.Flop.f + ' flop folds',
    }], exFlopFold, 'You folded on the flop here. If you\'re entering pots preflop and folding the flop regularly, tighten your preflop range to hands that connect better with boards.'));
  }
  if (turnFoldP !== null && turnFoldP > 55) {
    const exTurnFold = findExampleHand(function(h) {
      return parseActions(h.actions).some(function(a) { return a.isMe && a.street === 'Turn' && a.type === 'fold'; });
    });
    sIns.push(insWithExample('r', 'Turn Folding', 'Folding ' + turnFoldP + '% on the turn. If you have a made hand, bet and protect it — don\'t check-fold to draws.', [{
      v: d.ss.Turn.f + ' turn folds',
    }], exTurnFold, 'You folded on the turn here. If you had a made hand, betting protects it from draws. Check-folding lets opponents draw cheaply and control the pot.'));
  }
  if (!sIns.length) {
    sIns.push(ins('n', 'Streets', 'Keep building the sample for street-level patterns.', []));
  }
  stHtml += sIns.join('');
  document.getElementById('p-street').innerHTML = stHtml;

  // ── ACTIONS ──
  const actTotal = d.folds + d.checks + d.calls + d.raises;
  const fPct = pct(d.folds, actTotal);
  const chPct = pct(d.checks, actTotal);
  const caPct = pct(d.calls, actTotal);
  const raPct = pct(d.raises, actTotal);
  let actHtml = '<div class="mini-row">' + [
    { l: 'Total Actions', v: actTotal, c: 'o' },
    { l: 'Folds',         v: d.folds,  c: 'r' },
    { l: 'Checks',        v: d.checks, c: 'w' },
    { l: 'Calls',         v: d.calls,  c: 'a' },
    { l: 'Raises',        v: d.raises, c: 'g' },
    { l: 'Aggression',    v: aggPct !== null ? aggPct + '%' : '—', c: aggPct > 25 ? 'g' : 'a' },
  ].map(m => '<div class="mini"><div class="mini-l">' + m.l + '</div><div class="mini-v" style="color:var(--' + (m.c === 'g' ? 'green' : m.c === 'r' ? 'red' : m.c === 'a' ? 'amber' : 'text') + ')">' + m.v + '</div></div>').join('') + '</div>';
  const segs = [
    { p: fPct || 0,  c: 'var(--red)',   l: 'Fold ' + fPct + '%' },
    { p: chPct || 0, c: '#2a3a2c',      l: 'Check ' + chPct + '%' },
    { p: caPct || 0, c: 'var(--amber)', l: 'Call ' + caPct + '%' },
    { p: raPct || 0, c: 'var(--green)', l: 'Raise ' + raPct + '%' },
  ];
  actHtml += '<div class="sec-subtitle">Action split</div>';
  actHtml += '<div class="stack-bar">' + segs.map(s => '<div class="stack-seg" style="width:' + s.p + '%;background:' + s.c + ';"></div>').join('') + '</div>';
  actHtml += '<div class="stack-labels">' + segs.map(s => '<div class="stack-li"><div class="stack-dot" style="background:' + s.c + ';"></div>' + s.l + '</div>').join('') + '</div>';
  actHtml += '<div class="sec-subtitle" style="margin-top:20px;">By street</div><div style="overflow-x:auto;"><table class="tbl"><thead><tr><th>Street</th><th>' + tipWrap('Fold') + '</th><th>' + tipWrap('Check') + '</th><th>' + tipWrap('Call') + '</th><th>' + tipWrap('Raise') + '</th><th>' + tipWrap('Aggression') + '</th></tr></thead><tbody>';
  actHtml += streets.map(s => {
    const ss2 = d.ss[s];
    const tot2 = ss2.f + ss2.ch + ss2.ca + ss2.ra;
    const ap = pct(ss2.ra, tot2);
    return '<tr><td>' + tipWrap(s) + '</td><td>' + ss2.f + '</td><td>' + ss2.ch + '</td><td>' + ss2.ca + '</td><td>' + ss2.ra + '</td><td>' + (ap !== null ? ap + '%' : '—') + '</td></tr>';
  }).join('');
  actHtml += '</tbody></table></div>';
  const aIns = [];
  if (caPct > raPct + 20) {
    const exCallHeavy = findExampleHand(function(h) {
      const ma = parseActions(h.actions).filter(function(a) { return a.isMe; });
      return ma.some(function(a) { return a.type === 'call'; }) && !ma.some(function(a) { return a.type === 'raise'; }) && h.outcome && h.outcome.result !== 'won';
    });
    aIns.push(insWithExample('a', 'Call-Heavy', 'You call ' + caPct + '% but raise only ' + raPct + '% of the time. In TC where everyone calls anyway, raising more extracts more value.', [{
      v: 'Call: ' + caPct + '%',
    }, {
      v: 'Raise: ' + raPct + '%',
    }], exCallHeavy, 'This hand was called when a raise could have taken down the pot or extracted more value. In TC, passive play lets draws get there for free.'));
  }
  if (aggPct !== null && aggPct < 15) {
    const exLowAgg = findExampleHand(function(h) {
      const ma = parseActions(h.actions).filter(function(a) { return a.isMe; });
      return ma.some(function(a) { return a.type === 'call'; }) && !ma.some(function(a) { return a.type === 'raise'; });
    });
    aIns.push(insWithExample('r', 'Low Aggression', 'Only ' + aggPct + '% aggression. Strong hands need to be bet, not called.', [{
      v: d.raises + ' raises from ' + actTotal + ' actions',
    }], exLowAgg, 'Only ' + aggPct + '% of actions are raises. Strong hands need to be bet for value. Checking and calling lets opponents draw cheaply and control the pot size.'));
  } else if (aggPct !== null && aggPct <= 40) {
    const exGoodAgg = findExampleHand(function(h) {
      return parseActions(h.actions).some(function(a) { return a.isMe && a.type === 'raise'; });
    });
    aIns.push(insWithExample('g', 'Aggression', aggPct + '% raise frequency is solid. Taking initiative without overdoing it.', [{
      v: d.raises + ' raises',
    }], exGoodAgg, 'A well-timed raise like this one puts opponents on the defensive. Your aggression level is in a healthy range — enough to take initiative without overbluffing.'));
  } else if (aggPct !== null) {
    const exHighAgg = findExampleHand(function(h) {
      const ma = parseActions(h.actions).filter(function(a) { return a.isMe; });
      return ma.filter(function(a) { return a.type === 'raise'; }).length >= 2;
    });
    aIns.push(insWithExample('a', 'High Aggression', aggPct + '% is high. TC players call, so bluff raises cost real money.', [{
      v: d.raises + ' raises',
    }], exHighAgg, 'Multiple raises in this hand illustrate your aggressive tendencies. In TC where players call wide, each bluff raise is more likely to get looked up — save aggression for strong holdings.'));
  }
  if (d.faced3bet >= 3) {
    const f3 = pct(d.fold3bet, d.faced3bet);
    if (f3 > 70) {
      const ex3bet = findExampleHand(function(h) {
        const acts = parseActions(h.actions);
        let rc = 0;
        for (const a of acts) {
          if (!a.isMe && a.type === 'raise' && a.street === 'Preflop') rc++;
          if (a.isMe && a.street === 'Preflop' && rc >= 2 && a.type === 'fold') return true;
        }
        return false;
      });
      aIns.push(insWithExample('r', '3-Bet Response', 'Folding to 3-bets ' + f3 + '% of the time. In TC players 3-bet light, so consider calling more with strong hands.', [{
        v: d.fold3bet + '/' + d.faced3bet + ' situations',
      }], ex3bet, 'You folded here facing a 3-bet. In TC, many 3-bets are light. With a decent holding, calling can be profitable given how often opponents are bluffing or semi-bluffing.'));
    }
  }
  if (!aIns.length) {
    aIns.push(ins('n', 'Actions', 'Keep building data for action pattern insights.', []));
  }
  actHtml += aIns.join('');
  document.getElementById('p-actions').innerHTML = actHtml;

  // ── BETS ──
  const betStreets = ['Preflop', 'Flop', 'Turn', 'River'];
  const avgBets = {};
  betStreets.forEach(function(s) {
    var a = d.betAmts[s];
    avgBets[s] = a && a.length ? Math.round(a.reduce(function(x, y) { return x + y; }, 0) / a.length) : 0;
  });
  d.avgBetPre = avgBets.Preflop; d.avgBetFlop = avgBets.Flop;
  d.avgBetTurn = avgBets.Turn; d.avgBetRiver = avgBets.River;
  const maxAvg = Math.max(avgBets.Preflop, avgBets.Flop, avgBets.Turn, avgBets.River, 1);
  let betHtml = '<div class="two-col" style="margin-bottom:24px;">';
  betHtml += '<div><div class="sec-subtitle">Average bet size by street</div><div class="bar-group">' +
    betStreets.filter(s => avgBets[s] > 0).map(s =>
      barRow(s, avgBets[s], maxAvg, 'o', fmt(avgBets[s]), d.betAmts[s] ? d.betAmts[s].length + ' bets' : ''),
    ).join('') + '</div></div>';
  betHtml += '<div><div class="sec-subtitle">Bet frequency (when you had the option)</div><div class="bar-group">' +
    betStreets.map(s => {
      const bo = d.betOpps[s];
      if (!bo || !bo.t) return null;
      const fp2 = pct(bo.b, bo.t);
      const cls = fp2 < 25 ? 'r' : fp2 > 65 ? 'a' : 'g';
      return barRow(s, fp2 || 0, 100, cls, (fp2 !== null ? fp2 + '%' : '—'), bo.b + '/' + bo.t + ' opps');
    }).filter(Boolean).join('') + '</div></div>';
  betHtml += '</div>';
  const bIns = [];
  if (d.avgBetFlop > 0) {
    const exFlopBet = findExampleHand(function(h) {
      if (!h.board || h.board.length < 3) return false;
      return parseActions(h.actions).some(function(a) { return a.isMe && a.street === 'Flop' && (a.type === 'raise' || a.type === 'bet'); });
    });
    bIns.push(insWithExample('o', 'Flop Sizing', 'Average flop bet: ' + fmt(d.avgBetFlop) + '. In TC, aim for 60–80% of pot. Everyone calls so bet for maximum value.', [{
      v: 'Avg: ' + fmt(d.avgBetFlop),
      hi: true,
    }], exFlopBet, 'This hand shows your typical flop bet sizing. In TC where players call wide, sizing between 60–80% of pot extracts maximum value from weaker hands chasing draws.'));
  }
  if (d.avgBetTurn > 0) {
    const bigger = d.avgBetTurn >= d.avgBetFlop;
    const exTurnBet = findExampleHand(function(h) {
      if (!h.board || h.board.length < 4) return false;
      return parseActions(h.actions).some(function(a) { return a.isMe && a.street === 'Turn' && (a.type === 'raise' || a.type === 'bet'); });
    });
    bIns.push(insWithExample(bigger ? 'g' : 'a', 'Turn Sizing', bigger ? 'Turn bets (' + fmt(d.avgBetTurn) + ') larger than flop — correct as the pot grows.' : 'Turn bets (' + fmt(d.avgBetTurn) + ') smaller than flop (' + fmt(d.avgBetFlop) + '). Size up on the turn.', [{
      v: 'Avg: ' + fmt(d.avgBetTurn),
      hi: true,
    }], exTurnBet, bigger ? 'Good turn sizing here — increasing your bet as the pot grows puts maximum pressure on drawing hands and builds value.' : 'Your turn bet here was smaller than your flop bet. As the pot grows, your bets should scale up to charge opponents for chasing.'));
  }
  if (d.avgBetRiver > 0) {
    const exRiverBet = findExampleHand(function(h) {
      if (!h.board || h.board.length < 5) return false;
      if (!h.outcome || h.outcome.result !== 'won') return false;
      return parseActions(h.actions).some(function(a) { return a.isMe && a.street === 'River' && (a.type === 'raise' || a.type === 'bet'); });
    });
    bIns.push(insWithExample('o', 'River Sizing', 'Average river bet: ' + fmt(d.avgBetRiver) + '. The river is where you get paid — bet big with the best hand.', [{
      v: 'Avg: ' + fmt(d.avgBetRiver),
      hi: true,
    }], exRiverBet, 'This winning hand shows the river paying off. Size up with strong hands — TC players will call with second-best hands more often than they should.'));
  }
  const fbo = d.betOpps['Flop'];
  if (fbo && fbo.t >= 3 && pct(fbo.b, fbo.t) < 30) {
    const exFlopPassive = findExampleHand(function(h) {
      if (!h.board || h.board.length < 3) return false;
      const ma = parseActions(h.actions).filter(function(a) { return a.isMe && a.street === 'Flop'; });
      return ma.some(function(a) { return a.type === 'check' || a.type === 'call'; }) && !ma.some(function(a) { return a.type === 'raise'; });
    });
    bIns.push(insWithExample('r', 'Flop Passivity', 'Only betting the flop ' + pct(fbo.b, fbo.t) + '% of the time. Checking strong hands gives free cards to draws.', [{
      v: fbo.b + '/' + fbo.t + ' opportunities',
    }], exFlopPassive, 'On this flop you checked or called instead of betting. Betting puts opponents on the defensive and charges draws. In TC where players call wide, you want to be the one setting the price.'));
  }
  if (!bIns.length) {
    bIns.push(ins('n', 'Bets', 'More hands needed for bet sizing patterns.', []));
  }
  betHtml += bIns.join('');
  document.getElementById('p-bets').innerHTML = betHtml;

  // ── COMBINED ──
  const combIns = [];
  if (vpipPct !== null && aggPct !== null) {
    if (vpipPct > 50 && aggPct < 20) {
      const exWidePassive = findExampleHand(function(h) {
        const ma = parseActions(h.actions).filter(function(a) { return a.isMe; });
        return ma.some(function(a) { return a.type === 'call'; }) && !ma.some(function(a) { return a.type === 'raise'; }) && h.outcome && h.outcome.result !== 'won';
      });
      combIns.push(insWithExample('r', 'VPIP x Aggression', 'Playing ' + vpipPct + '% of hands but raising only ' + aggPct + '% of the time. Wide and passive is the worst combination in poker.', [{
        v: 'VPIP: ' + vpipPct + '%',
      }, {
        v: 'Raise: ' + aggPct + '%',
      }], exWidePassive, 'You entered this pot by calling but never took the lead with a raise. Playing many hands passively means you pay to see cards without building pots when you are strong, and you give opponents easy decisions.'));
    }
    if (vpipPct < 30 && aggPct > 35) {
      combIns.push(ins('g', 'VPIP x Aggression', 'Tight (' + vpipPct + '% VPIP) and aggressive (' + aggPct + '%). You pick good spots and bet for value — a strong profile.', [{
        v: 'VPIP: ' + vpipPct + '%',
      }, {
        v: 'Raise: ' + aggPct + '%',
      }]));
    }
  }
  if (d.facedAllin >= 2) {
    const afp = pct(d.foldAllin, d.facedAllin);
    const awp = pct(d.wonAllin, d.callAllin);
    if (afp > 75 && awp !== null && awp > 60) {
      const exAllinFold = findExampleHand(function(h) {
        var acts2 = parseActions(h.actions);
        return acts2.some(function(a) { return !a.isMe && a.type === 'raise' && a.msg && a.msg.indexOf(' to ') === -1; }) && acts2.some(function(a) { return a.isMe && a.type === 'fold'; });
      });
      combIns.push(insWithExample('r', 'All-in Folds x Win Rate', 'Folding all-ins ' + afp + '% of the time but winning ' + awp + '% when you do call. You\'re folding good equity.', [{
        v: d.callAllin + ' calls, ' + d.wonAllin + ' won',
      }], exAllinFold, 'You folded to an all-in here. Given your high win rate when calling (' + awp + '%), you may be folding too many hands with good equity against all-in ranges.'));
    } else {
      combIns.push(ins('n', 'All-in Profile', 'Fold rate: ' + afp + '%. Win rate when calling: ' + (awp !== null ? awp + '%' : '—') + '.', [{
        v: d.facedAllin + ' situations',
      }]));
    }
  }
  const btnP = d.posMap['BTN'];
  if (btnP && btnP.hands >= 3 && pct(btnP.vpip, btnP.hands) < 40) {
    const exBtnFold = findExampleHand(function(h) {
      return h.position === 'BTN' && parseActions(h.actions).some(function(a) { return a.isMe && a.type === 'fold' && a.street === 'Preflop'; });
    });
    combIns.push(insWithExample('a', 'Position x Cards', 'From the button — best position — you only play ' + pct(btnP.vpip, btnP.hands) + '% of hands. Widen to 40–55% here.', [{
      v: 'BTN VPIP: ' + pct(btnP.vpip, btnP.hands) + '%',
    }], exBtnFold, 'This hand was folded from the button. You have the best position at the table here — widen your range to exploit positional advantage.'));
  }
  const pfFoldPct = pct(d.ss.Preflop.f, d.ss.Preflop.seen);
  if (pfFoldPct !== null) {
    combIns.push(ins(pfFoldPct > 65 ? 'a' : 'n', 'Preflop Fold Rate', 'You fold preflop ' + pfFoldPct + '% of hands.' + (pfFoldPct > 65 ? ' That\'s tight, which is fine, but make sure you\'re not folding playable hands from position.' : ' Reasonable.'), [{
      v: d.ss.Preflop.f + ' folds',
    }]));
  }
  // Position x Win Rate: find best and worst positions
  const posWinRates = posOrder.filter(function(p) { return d.posMap[p] && d.posMap[p].hands >= 3; }).map(function(p) {
    return { pos: p, wr: pct(d.posMap[p].won, d.posMap[p].hands), hands: d.posMap[p].hands, pnl: d.posMap[p].pnl };
  }).sort(function(a, b) { return (b.wr || 0) - (a.wr || 0); });
  if (posWinRates.length >= 2) {
    const bestPos = posWinRates[0];
    const worstPos = posWinRates[posWinRates.length - 1];
    if (bestPos.wr !== null && worstPos.wr !== null && bestPos.wr - worstPos.wr > 15) {
      combIns.push(ins('o', 'Position Win Rate Spread', 'Your best position is ' + bestPos.pos + ' (' + bestPos.wr + '% win) and worst is ' + worstPos.pos + ' (' + worstPos.wr + '% win). A ' + (bestPos.wr - worstPos.wr) + ' point gap suggests position-specific leaks.', [
        { v: bestPos.pos + ': ' + bestPos.wr + '%', hi: true },
        { v: worstPos.pos + ': ' + worstPos.wr + '%' },
      ]));
    }
  }
  // Positional P&L: which position makes/loses most
  const posPnlSorted = posOrder.filter(function(p) { return d.posMap[p] && d.posMap[p].hands >= 3; }).map(function(p) {
    return { pos: p, pnl: d.posMap[p].pnl, hands: d.posMap[p].hands };
  }).sort(function(a, b) { return b.pnl - a.pnl; });
  if (posPnlSorted.length >= 2) {
    const mostProfit = posPnlSorted[0];
    const mostLoss = posPnlSorted[posPnlSorted.length - 1];
    if (mostProfit.pnl > 0 && mostLoss.pnl < 0) {
      combIns.push(ins('o', 'Position P&L', 'Most profitable: ' + mostProfit.pos + ' (+' + fmt(mostProfit.pnl) + ' over ' + mostProfit.hands + ' hands). Biggest loss: ' + mostLoss.pos + ' (' + fmt(mostLoss.pnl) + ' over ' + mostLoss.hands + ' hands).', [
        { v: mostProfit.pos + ': +' + fmt(mostProfit.pnl), hi: true },
        { v: mostLoss.pos + ': ' + fmt(mostLoss.pnl) },
      ]));
    }
  }
  // Hand Type x Win Rate: best and worst hand categories
  const htWinRates = htOrder.filter(function(ht) { return d.htMap[ht] && d.htMap[ht].played >= 3; }).map(function(ht) {
    return { ht: ht, wr: pct(d.htMap[ht].won, d.htMap[ht].played), played: d.htMap[ht].played };
  }).sort(function(a, b) { return (b.wr || 0) - (a.wr || 0); });
  if (htWinRates.length >= 2) {
    const bestHT = htWinRates[0];
    const worstHT = htWinRates[htWinRates.length - 1];
    combIns.push(ins('o', 'Hand Type Performance', 'Best category: ' + bestHT.ht + ' at ' + bestHT.wr + '% win rate (' + bestHT.played + ' played). Worst: ' + worstHT.ht + ' at ' + worstHT.wr + '% (' + worstHT.played + ' played).', [
      { v: bestHT.ht + ': ' + bestHT.wr + '%', hi: true },
      { v: worstHT.ht + ': ' + worstHT.wr + '%' },
    ]));
  }
  // Street Aggression x Win Rate
  const streetAggWins = {};
  for (const h2 of hands) {
    const acts2 = parseActions(h2.actions);
    const heroActs = acts2.filter(function(a) { return a.isMe; });
    const didRaise = {};
    heroActs.forEach(function(a) { if (a.type === 'raise') didRaise[a.street] = true; });
    const won2 = h2.outcome && h2.outcome.result === 'won';
    for (const st of streets) {
      if (!streetAggWins[st]) streetAggWins[st] = { aggWon: 0, aggTotal: 0, passWon: 0, passTotal: 0 };
      if (heroActs.some(function(a) { return a.street === st; })) {
        if (didRaise[st]) {
          streetAggWins[st].aggTotal++;
          if (won2) streetAggWins[st].aggWon++;
        } else {
          streetAggWins[st].passTotal++;
          if (won2) streetAggWins[st].passWon++;
        }
      }
    }
  }
  const aggVsPassInsights = streets.filter(function(st) {
    const s2 = streetAggWins[st];
    return s2 && s2.aggTotal >= 3 && s2.passTotal >= 3;
  }).map(function(st) {
    const s2 = streetAggWins[st];
    const aggWr = pct(s2.aggWon, s2.aggTotal);
    const passWr = pct(s2.passWon, s2.passTotal);
    return { street: st, aggWr: aggWr, passWr: passWr, diff: (aggWr || 0) - (passWr || 0) };
  }).filter(function(r) { return Math.abs(r.diff) > 10; });
  if (aggVsPassInsights.length > 0) {
    const best2 = aggVsPassInsights.sort(function(a, b) { return b.diff - a.diff; })[0];
    combIns.push(ins(best2.diff > 0 ? 'g' : 'a', 'Aggression x Win Rate (' + best2.street + ')', 'When you raise on the ' + best2.street.toLowerCase() + ', you win ' + best2.aggWr + '% vs ' + best2.passWr + '% when passive. ' + (best2.diff > 0 ? 'Aggression pays off here.' : 'Passive play performs better — opponents may be calling your bluffs.'), [
      { v: 'Aggressive: ' + best2.aggWr + '%', hi: best2.diff > 0 },
      { v: 'Passive: ' + best2.passWr + '%' },
    ]));
  }
  if (!combIns.length) {
    combIns.push(ins('n', 'Combined', 'More data needed for cross-analysis. Aim for 50+ hands.', []));
  }
  document.getElementById('p-combined').innerHTML = combIns.join('');

  // ── RANGE ──
  const gridR = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2'];
  function buildKey(ri, ci) {
    const r1 = gridR[Math.min(ri, ci)];
    const r2 = gridR[Math.max(ri, ci)];
    if (ri === ci) return r1 + r1;
    // Standard convention: above diagonal (ri < ci) = suited, below = offsuit
    return r1 + r2 + (ri < ci ? 's' : 'o');
  }
  function wrColor(w) {
    // More distinct colour spread: deep red -> orange -> bright green
    if (w <= 30) {
      return 'rgb(190, 45, 45)';
    } else if (w <= 45) {
      const t = (w - 30) / 15;
      return 'rgb(' + Math.round(190 + t * 30) + ',' + Math.round(45 + t * 90) + ',' + Math.round(45) + ')';
    } else if (w <= 55) {
      const t = (w - 45) / 10;
      return 'rgb(' + Math.round(220 - t * 30) + ',' + Math.round(135 + t * 30) + ',' + Math.round(45) + ')';
    } else if (w <= 70) {
      const t = (w - 55) / 15;
      return 'rgb(' + Math.round(190 - t * 120) + ',' + Math.round(165 - t * 10) + ',' + Math.round(45 + t * 10) + ')';
    }
    return 'rgb(50, 170, 65)';
  }
  // Find max played count across all combos for relative colouring
  let maxPlayed = 0;
  Object.keys(d.rangeMap).forEach(function(k) {
    if (d.rangeMap[k].played > maxPlayed) maxPlayed = d.rangeMap[k].played;
  });
  function playedColor(played) {
    if (played === 0) return '#111a12';
    const ratio = played / maxPlayed;
    if (ratio <= 0.15) return '#1a2e1e';
    if (ratio <= 0.35) return '#24422a';
    if (ratio <= 0.6) return '#2e5835';
    if (ratio <= 0.8) return '#3a7a42';
    return 'rgb(50, 170, 65)';
  }
  let wrGrid = '';
  let freqGrid = '';
  for (let r = 0; r < 13; r++) {
    for (let c = 0; c < 13; c++) {
      const key = buildKey(r, c);
      const data = d.rangeMap[key];
      if (data && data.dealt > 0) {
        const wr2 = data.played > 0 ? pct(data.won, data.played) : null;
        const wrBg = (wr2 !== null ? wrColor(wr2) : (data.played > 0 ? '#1e3020' : '#111a12'));
        wrGrid += '<div class="rc" style="background:' + wrBg + ';cursor:pointer;" data-key="' + key + '" data-tip="' + key + ' | Win: ' + (wr2 !== null ? wr2 + '%' : 'n/a') + ' (' + data.won + '/' + data.played + ' played, ' + data.dealt + ' dealt) · click to see hands"><span>' + key + '</span></div>';
        freqGrid += '<div class="rc" style="background:' + playedColor(data.played) + ';cursor:pointer;" data-key="' + key + '" data-tip="' + key + ' | Played ' + data.played + ' of ' + data.dealt + ' dealt · click to see hands"><span>' + key + '</span></div>';
      } else {
        const cellType = (r === c) ? 'pair' : (r < c) ? 'suited' : 'offsuit';
        const cellLabel = cellType === 'pair' ? 'Pair' : cellType === 'suited' ? 'Suited' : 'Offsuit';
        wrGrid += '<div class="rc rc-unseen" data-tip="' + key + ' | Not yet dealt (' + cellLabel + ')"><span>' + key + '</span></div>';
        freqGrid += '<div class="rc rc-unseen" data-tip="' + key + ' | Not yet dealt (' + cellLabel + ')"><span>' + key + '</span></div>';
      }
    }
  }
  const seen = Object.keys(d.rangeMap).length;
  const totalCombos = 169;
  const legend1 = '<div class="range-legend">' +
    '<div class="leg"><div class="leg-sw rc-unseen" style="width:9px;height:9px;"></div>Not dealt</div>' +
    '<div class="leg"><div class="leg-sw" style="background:rgb(190,45,45);"></div>&lt;30% win</div>' +
    '<div class="leg"><div class="leg-sw" style="background:rgb(220,135,45);"></div>~50% win</div>' +
    '<div class="leg"><div class="leg-sw" style="background:rgb(50,170,65);"></div>&gt;70% win</div>' +
    '</div>';
  const legend2 = '<div class="range-legend">' +
    '<div class="leg"><div class="leg-sw rc-unseen" style="width:9px;height:9px;"></div>Not played</div>' +
    '<div class="leg"><div class="leg-sw" style="background:#1a2e1e;"></div>Rarely</div>' +
    '<div class="leg"><div class="leg-sw" style="background:#2e5835;"></div>Sometimes</div>' +
    '<div class="leg"><div class="leg-sw" style="background:rgb(50,170,65);"></div>Most played</div>' +
    '</div>';
  const rangeIns = [];
  let bestKey = null;
  let bestWr = -1;
  let worstKey = null;
  let worstWr = 101;
  let mostPlayed = null;
  let mostCount = 0;
  Object.keys(d.rangeMap).forEach(function(k) {
    const rm = d.rangeMap[k];
    if (rm.played >= 2) {
      const w2 = pct(rm.won, rm.played);
      if (w2 !== null && w2 > bestWr) { bestWr = w2; bestKey = k; }
      if (w2 !== null && w2 < worstWr) { worstWr = w2; worstKey = k; }
    }
    if (rm.dealt > mostCount) { mostCount = rm.dealt; mostPlayed = k; }
  });
  if (bestKey) {
    const exBest = findExampleHand(function(h) {
      return parseHoleKey(h.hole) === bestKey && h.outcome && h.outcome.result === 'won';
    });
    rangeIns.push(insWithExample('g', 'Best Hand', 'Your strongest combo so far is ' + bestKey + ' at ' + bestWr + '% win rate. Sample size matters though.', [{ v: bestKey, hi: true }, { v: bestWr + '% win' }], exBest, 'Here is a hand where you won with ' + bestKey + '. This combo has been your most profitable — keep playing it confidently but watch for sample size.'));
  }
  if (worstKey && worstKey !== bestKey) {
    const exWorst = findExampleHand(function(h) {
      return parseHoleKey(h.hole) === worstKey && h.outcome && h.outcome.result !== 'won';
    });
    rangeIns.push(insWithExample('r', 'Worst Hand', worstKey + ' has been your weakest at ' + worstWr + '% win rate. Consider tightening or adjusting play with this hand.', [{ v: worstKey, hi: true }, { v: worstWr + '% win' }], exWorst, 'This hand with ' + worstKey + ' did not go well. Review whether you are overplaying this combo or getting into bad spots post-flop.'));
  }
  if (mostPlayed) {
    const exMost = findExampleHand(function(h) {
      return parseHoleKey(h.hole) === mostPlayed;
    });
    rangeIns.push(insWithExample('n', 'Most Dealt', 'You have been dealt ' + mostPlayed + ' the most (' + mostCount + ' times). ' + (d.rangeMap[mostPlayed].played < mostCount / 2 ? 'You fold it more than half the time.' : 'You play it frequently.'), [{ v: mostPlayed, hi: true }, { v: mostCount + ' dealt' }], exMost, 'Here is a hand where you were dealt ' + mostPlayed + '. ' + (d.rangeMap[mostPlayed].played < mostCount / 2 ? 'You fold this hand often — make sure you are not being too tight with it in good positions.' : 'You play this hand frequently — make sure you are not overvaluing it from bad positions.')));
  }
  const coveragePct = Math.round(seen / totalCombos * 100);
  rangeIns.push(ins('n', 'Coverage', 'You have seen ' + seen + ' of ' + totalCombos + ' possible hand combos (' + coveragePct + '%). The more hands you play, the more complete this picture becomes.', [{ v: seen + '/' + totalCombos + ' combos' }]));
  document.getElementById('p-range').innerHTML =
    '<div style="font-size:9px;color:var(--dim);margin-bottom:20px;">' + seen + ' of ' + totalCombos + ' hand combos seen · hover any cell for detail</div>' +
    '<div class="two-col" style="gap:20px;align-items:start;">' +
    '<div>' +
    '<div class="sec-subtitle" style="margin-top:0;">Win Rate by Hand</div>' +
    '<div class="range-grid-sm">' + wrGrid + '</div>' +
    legend1 +
    '</div>' +
    '<div>' +
    '<div class="sec-subtitle" style="margin-top:0;">Hands Played</div>' +
    '<div class="range-grid-sm">' + freqGrid + '</div>' +
    legend2 +
    '</div>' +
    '</div>' +
    '<div class="divider"></div>' +
    rangeIns.join('');

  // Range cell click: show hand list for that combo (event delegation)
  document.getElementById('p-range').addEventListener('click', function(e) {
    var cell = e.target.closest('.rc[data-key]');
    if (!cell) return;
    var key = cell.getAttribute('data-key');
    if (!key) return;
    // Find all hands matching this combo
    var matched = hands.filter(function(h) { return parseHoleKey(h.hole) === key; });
    if (!matched.length) return;
    var rm = d.rangeMap[key];
    var wr2 = rm && rm.played > 0 ? pct(rm.won, rm.played) : null;
    // Build hand list modal
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
      '<div class="modal-subtitle">' + matched.length + ' hands' +
      (rm ? ' · played ' + rm.played + ' of ' + rm.dealt + ' dealt' : '') +
      (wr2 !== null ? ' · ' + wr2 + '% win rate' : '') + '</div>';
    var rows = matched.map(function(h, idx) {
      var myActs = parseActions(h.actions).filter(function(a) { return a.isMe; }).map(function(a) { return a.type; }).join(' · ');
      var invested2 = h.invested || calcInvestmentFromActions(h.actions || []);
      var res;
      if (h.outcome) {
        if (h.outcome.result === 'won') {
          var profit2 = (h.outcome.amount || 0) - invested2;
          res = '<span style="color:var(--green);">+' + fmt(profit2 > 0 ? profit2 : h.outcome.amount || h.pot || 0) + '</span>';
        } else if (h.outcome.result === 'folded') {
          res = '<span style="color:var(--red);">' + (invested2 > 0 ? '-' + fmt(invested2) : 'folded') + '</span>';
        } else {
          res = '<span style="color:var(--red);">-' + fmt(invested2) + '</span>';
        }
      } else {
        res = '<span style="color:var(--dim);">?</span>';
      }
      return '<div class="range-hand-row" data-ridx="' + idx + '" style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;border-bottom:1px solid var(--border);cursor:pointer;transition:background .15s;" onmouseover="this.style.background=\'var(--s2)\'" onmouseout="this.style.background=\'\'">' +
        '<div style="display:flex;gap:12px;align-items:center;">' +
        '<span style="color:var(--dim);font-size:9px;">' + (h.position || '?') + '</span>' +
        '<span>' + (h.hole ? h.hole.join(' ') : '??') + '</span>' +
        '<span style="color:var(--dim);font-size:9px;">' + (h.board && h.board.length ? h.board.join(' ') : '—') + '</span>' +
        '</div>' +
        '<div style="display:flex;gap:12px;align-items:center;">' +
        '<span style="font-size:9px;color:var(--dim);">' + myActs + '</span>' +
        res +
        '</div></div>';
    }).join('');
    box.innerHTML = '<button class="modal-close" id="modal-close-btn">&times;</button>' +
      summary + '<div style="margin-top:12px;">' + rows + '</div>';
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    requestAnimationFrame(function() { overlay.classList.add('show'); });
    document.getElementById('modal-close-btn').onclick = closeModal;
    // Wire row clicks to open individual hand detail
    box.querySelectorAll('.range-hand-row').forEach(function(row) {
      row.onclick = function() {
        var idx = parseInt(row.getAttribute('data-ridx'));
        if (!isNaN(idx) && matched[idx]) {
          showExampleHandModal(matched[idx]);
        }
      };
    });
  });

  // ── LOG ──
  const PAGE_SIZE = 50;
  let logPage = 0;
  const allHands = hands.slice().reverse();
  function renderLogPage() {
    const start = logPage * PAGE_SIZE;
    const end = Math.min(start + PAGE_SIZE, allHands.length);
    const pageHands = allHands.slice(start, end);
    const totalPages = Math.ceil(allHands.length / PAGE_SIZE);
    let logHtml = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">' +
      '<div style="font-size:9px;color:var(--dim);">' + allHands.length + ' hands total · showing ' + (start + 1) + '-' + end + '</div>' +
      '<div style="display:flex;gap:6px;align-items:center;">';
    if (totalPages > 1) {
      logHtml += '<button class="log-nav-btn" id="log-prev" ' + (logPage === 0 ? 'disabled' : '') + '>&laquo; Prev</button>' +
        '<span style="font-size:9px;color:var(--dim);">Page ' + (logPage + 1) + '/' + totalPages + '</span>' +
        '<button class="log-nav-btn" id="log-next" ' + (logPage >= totalPages - 1 ? 'disabled' : '') + '>Next &raquo;</button>';
    }
    logHtml += '</div></div>';
    logHtml += '<div class="hrow hrow-header"><div class="hrow-pos">Pos</div><div class="hrow-cards">Cards</div><div class="hrow-board">Board</div><div class="hrow-acts">Actions</div><div class="hrow-res">Result</div></div>';
    logHtml += '<div class="hlog">' + pageHands.map(function(h) {
      const myActs = parseActions(h.actions).filter(function(a) { return a.isMe; }).map(function(a) { return a.type; }).join(' · ');
      const invested2 = h.invested || calcInvestmentFromActions(h.actions || []);
      let res;
      if (h.outcome) {
        if (h.outcome.result === 'won') {
          const profit2 = (h.outcome.amount || 0) - invested2;
          res = '<div class="hrow-res w">+' + fmt(profit2 > 0 ? profit2 : h.outcome.amount || h.pot || 0) + '</div>';
        } else if (h.outcome.result === 'folded') {
          res = '<div class="hrow-res l">' + (invested2 > 0 ? '-' + fmt(invested2) : 'folded') + '</div>';
        } else {
          res = '<div class="hrow-res l">-' + fmt(invested2) + '</div>';
        }
      } else {
        res = '<div class="hrow-res u">?</div>';
      }
      return '<div class="hrow" data-hand-idx="' + (start + pageHands.indexOf(h)) + '" style="cursor:pointer;transition:border-color .15s;" onmouseover="this.style.borderColor=\'var(--gold2)\'" onmouseout="this.style.borderColor=\'\'"><div class="hrow-pos">' + (h.position || '?') + '</div><div class="hrow-cards">' + (h.hole && h.hole.length ? h.hole.join(' ') : '?? ??') + '</div><div class="hrow-board">' + (h.board && h.board.length ? h.board.join(' ') : '—') + '</div><div class="hrow-acts">' + myActs + '</div>' + res + '</div>';
    }).join('') + '</div>';
    document.getElementById('p-log').innerHTML = logHtml;
    // Wire click handlers for hand rows
    document.querySelectorAll('#p-log .hrow[data-hand-idx]').forEach(function(row) {
      row.onclick = function() {
        const idx = parseInt(this.getAttribute('data-hand-idx'));
        if (!isNaN(idx) && allHands[idx]) {
          showExampleHandModal(allHands[idx]);
        }
      };
    });
    const prevBtn = document.getElementById('log-prev');
    const nextBtn = document.getElementById('log-next');
    if (prevBtn) prevBtn.onclick = function() { logPage--; renderLogPage(); };
    if (nextBtn) nextBtn.onclick = function() { logPage++; renderLogPage(); };
  }
  renderLogPage();

  // ── TABLES COMPARISON ──
  const allTableGroups = {};
  for (const h of _allHands) {
    const tid = inferTable(h);
    const key = tid || 'unknown';
    if (!allTableGroups[key]) allTableGroups[key] = [];
    allTableGroups[key].push(h);
  }
  const filterEl = document.getElementById('table-filter');
  const prevVal = filterEl.value || 'all';
  filterEl.innerHTML = '<option value="all">All Tables (' + _allHands.length + ')</option>';
  const sortedTables = Object.keys(allTableGroups)
    .filter(k => k !== 'unknown')
    .map(Number)
    .sort((a, b) => (TABLE_META[b] ? TABLE_META[b].bb : 0) - (TABLE_META[a] ? TABLE_META[a].bb : 0));
  for (const tid of sortedTables) {
    const label = getTableLabel(tid);
    const count = allTableGroups[tid].length;
    filterEl.innerHTML += '<option value="' + tid + '">' + label + ' (' + count + ')</option>';
  }
  if (allTableGroups['unknown'] && allTableGroups['unknown'].length) {
    filterEl.innerHTML += '<option value="unknown">Unknown (' + allTableGroups['unknown'].length + ')</option>';
  }
  filterEl.style.display = Object.keys(allTableGroups).length > 1 ? '' : 'none';
  filterEl.value = prevVal;
  let tablesHtml = '';
  if (Object.keys(allTableGroups).length <= 1) {
    tablesHtml = ins('n', 'Single Table', 'All hands are from a single table. Play across multiple tables to see comparisons.', []);
  } else {
    const tableRows = [];
    const allTableIds = [...sortedTables];
    if (allTableGroups['unknown']) allTableIds.push('unknown');
    for (const tid of allTableIds) {
      const tHands = allTableGroups[tid];
      const tD = analyse(tHands);
      const tWr = pct(tD.handsWon, tD.handsWithOutcome);
      const tNet = tD.totalWonAmount - tD.totalInvested;
      const tVpip = pct(tD.vpip, tD.n);
      const tAgg = pct(tD.raises, tD.totalActs);
      const label = tid === 'unknown' ? 'Unknown' : getTableLabel(tid);
      const blinds = tid !== 'unknown' && TABLE_META[tid] ? fmt(TABLE_META[tid].sb) + '/' + fmt(TABLE_META[tid].bb) : '';
      tableRows.push({
        tid,
        label,
        blinds,
        n: tD.n,
        wr: tWr,
        net: tNet,
        vpipP: tVpip,
        aggP: tAgg,
        avgPot: tD.handsWithOutcome > 0 ? Math.round((tD.totalWonAmount + tD.totalInvested) / tD.handsWithOutcome) : 0,
      });
    }
    const maxHands = Math.max(...tableRows.map(r => r.n), 1);
    tablesHtml += '<div class="sec-subtitle" style="margin-top:0;">Performance by Table</div>';
    tablesHtml += '<div style="overflow-x:auto;"><table class="tbl-compare"><thead><tr>';
    tablesHtml += '<th>Table</th><th>Blinds</th><th>Hands</th><th></th><th>' + tipWrap('Win Rate') + '</th><th>' + tipWrap('Net P&L') + '</th><th>' + tipWrap('VPIP') + '</th><th>' + tipWrap('Aggression') + '</th><th>' + tipWrap('Avg Pot') + '</th><th></th>';
    tablesHtml += '</tr></thead><tbody>';
    for (const r of tableRows) {
      const barW = Math.round(r.n / maxHands * 100);
      const isExcluded = _excludedTables.has(String(r.tid));
      tablesHtml += '<tr style="' + (isExcluded ? 'opacity:0.35;' : '') + '"><td>' + r.label + '</td><td style="color:var(--dim);font-size:10px;">' + r.blinds + '</td><td>' + r.n + '</td>';
      tablesHtml += '<td style="width:80px;"><span class="tbl-spark" style="width:' + barW + '%;background:var(--gold2);"></span></td>';
      tablesHtml += '<td class="' + (r.wr >= 50 ? 'wr-good' : r.wr !== null ? 'wr-bad' : '') + '">' + (r.wr !== null ? r.wr + '%' : '—') + '</td>';
      tablesHtml += '<td class="' + (r.net >= 0 ? 'pnl-pos' : 'pnl-neg') + '">' + (r.net >= 0 ? '+' : '') + fmt(r.net) + '</td>';
      tablesHtml += '<td>' + (r.vpipP !== null ? r.vpipP + '%' : '—') + '</td>';
      tablesHtml += '<td>' + (r.aggP !== null ? r.aggP + '%' : '—') + '</td>';
      tablesHtml += '<td style="color:var(--dim);">' + (r.avgPot > 0 ? fmt(r.avgPot) : '—') + '</td>';
      tablesHtml += '<td><button class="log-nav-btn exclude-table-btn" data-tid="' + r.tid + '" style="font-size:8px;padding:2px 6px;">' + (isExcluded ? 'Include' : 'Exclude') + '</button></td></tr>';
    }
    tablesHtml += '</tbody></table></div>';
    const tIns2 = [];
    if (tableRows.length >= 2) {
      const best = tableRows.filter(r => r.wr !== null).sort((a, b) => b.wr - a.wr)[0];
      const worst = tableRows.filter(r => r.wr !== null && r.n >= 5).sort((a, b) => a.wr - b.wr)[0];
      const mostProfit = tableRows.sort((a, b) => b.net - a.net)[0];
      if (best && best.wr >= 40) {
        const exBestTable = findExampleHand(function(h) { return String(inferTable(h) || 'unknown') === String(best.tid) && h.outcome && h.outcome.result === 'won'; });
        tIns2.push(insWithExample(best.wr >= 50 ? 'g' : 'n', 'Best Win Rate', best.label + ' at ' + best.wr + '% across ' + best.n + ' hands.', [{ v: best.wr + '%', hi: true }, { v: best.n + ' hands' }], exBestTable, 'A winning hand from ' + best.label + ', your highest win-rate table. Consider whether the player pool or stakes here suit your style particularly well.'));
      }
      if (worst && worst.wr < 40 && worst.n >= 5) {
        const exWorstTable = findExampleHand(function(h) { return String(inferTable(h) || 'unknown') === String(worst.tid) && h.outcome && h.outcome.result !== 'won'; });
        tIns2.push(insWithExample('r', 'Lowest Win Rate', worst.label + ' at ' + worst.wr + '% across ' + worst.n + ' hands. Consider whether the stakes or player pool suit your style.', [{ v: worst.wr + '%', hi: true }, { v: worst.n + ' hands' }], exWorstTable, 'A losing hand from ' + worst.label + '. Review whether you are adjusting your strategy for this table\'s stakes and player tendencies.'));
      }
      if (mostProfit && mostProfit.net > 0) {
        const exProfitTable = findExampleHand(function(h) { return String(inferTable(h) || 'unknown') === String(mostProfit.tid) && h.outcome && h.outcome.result === 'won'; });
        tIns2.push(insWithExample('g', 'Most Profitable', mostProfit.label + ' with a net of +' + fmt(mostProfit.net) + '.', [{ v: '+' + fmt(mostProfit.net), hi: true }], exProfitTable, 'A winning hand from your most profitable table. The combination of stakes, player pool, and your strategy is working well here.'));
      }
      const bigLoss = tableRows.filter(r => r.net < 0).sort((a, b) => a.net - b.net)[0];
      if (bigLoss) {
        const exLossTable = findExampleHand(function(h) { return String(inferTable(h) || 'unknown') === String(bigLoss.tid) && h.outcome && h.outcome.result !== 'won'; });
        tIns2.push(insWithExample('a', 'Biggest Loss', bigLoss.label + ' at ' + fmt(bigLoss.net) + '. Review whether leaks are table-specific or general.', [{ v: fmt(bigLoss.net), hi: true }], exLossTable, 'A losing hand from ' + bigLoss.label + '. Check if you are playing too loose or calling too much at these stakes.'));
      }
    }
    if (!tIns2.length) tIns2.push(ins('n', 'Tables', 'More data needed for table-level insights.', []));
    tablesHtml += '<div style="margin-top:24px;">' + tIns2.join('') + '</div>';
  }
  document.getElementById('p-tables').innerHTML = tablesHtml;
  // Wire exclude/include buttons
  document.querySelectorAll('.exclude-table-btn').forEach(function(btn) {
    btn.onclick = function(e) {
      e.stopPropagation();
      const tid = this.getAttribute('data-tid');
      if (_excludedTables.has(tid)) {
        _excludedTables.delete(tid);
      } else {
        _excludedTables.add(tid);
      }
      // Re-filter and re-render
      const filtered = _allHands.filter(function(h) {
        const htid = inferTable(h);
        return !_excludedTables.has(String(htid || 'unknown'));
      });
      if (!filtered.length) {
        _excludedTables.delete(tid);
        return;
      }
      const fd = analyse(filtered);
      render(fd, filtered, _meta);
      // Switch back to tables tab
      document.querySelectorAll('.tab').forEach(function(t) { t.classList.remove('active'); });
      document.querySelectorAll('.panel').forEach(function(p) { p.classList.remove('on'); });
      document.querySelector('[data-tab="tables"]').classList.add('active');
      document.getElementById('p-tables').classList.add('on');
    };
  });

  // ── TRENDS ──
  (function renderTrends() {
    const sorted = hands.slice().sort(function(a, b) { return (a.timestamp || 0) - (b.timestamp || 0); });
    if (sorted.length < 5) {
      document.getElementById('p-trends').innerHTML = ins('n', 'Trends', 'Need at least 5 hands to show trends. Keep playing and tracking.', []);
      return;
    }
    const sessions = [];
    const dayMap = {};
    for (let i = 0; i < sorted.length; i++) {
      const ts = sorted[i].timestamp || 0;
      const day = new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
      if (!dayMap[day]) { dayMap[day] = []; sessions.push(day); }
      dayMap[day].push(sorted[i]);
    }
    const points = [];
    let cumWon = 0;
    let cumOutcome = 0;
    let cumVpip = 0;
    let cumN = 0;
    let cumRaise = 0;
    let cumActs = 0;
    let cumCashWon = 0;
    let cumCashInvested = 0;
    for (let si = 0; si < sessions.length; si++) {
      const dayHands = dayMap[sessions[si]];
      const dStats = analyse(dayHands);
      cumWon += dStats.handsWon;
      cumOutcome += dStats.handsWithOutcome;
      cumVpip += dStats.vpip;
      cumN += dStats.n;
      cumRaise += dStats.raises;
      cumActs += dStats.totalActs;
      cumCashWon += dStats.totalWonAmount;
      cumCashInvested += dStats.totalInvested;
      points.push({
        label: sessions[si],
        hands: dayHands.length,
        cumHands: cumN,
        wr: cumOutcome > 0 ? Math.round(cumWon / cumOutcome * 100) : null,
        vpip: cumN > 0 ? Math.round(cumVpip / cumN * 100) : null,
        agg: cumActs > 0 ? Math.round(cumRaise / cumActs * 100) : null,
        sessionWr: dStats.handsWithOutcome > 0 ? Math.round(dStats.handsWon / dStats.handsWithOutcome * 100) : null,
        netPnl: cumCashWon - cumCashInvested,
      });
    }
    function svgChart(title, dataKey, color, suffix, baselineVal) {
      const vals = points.map(function(p) { return p[dataKey]; }).filter(function(v) { return v !== null; });
      if (vals.length < 2) return '';
      const minV = Math.min.apply(null, vals);
      const maxV = Math.max.apply(null, vals);
      const range = maxV - minV || 1;
      const w = 600;
      const h = 140;
      const pad = 36;
      const padR = 12;
      const chartW = w - pad - padR;
      const chartH = h - 30;
      const step = chartW / (points.length - 1 || 1);
      const pathParts = [];
      const dotParts = [];
      for (let i = 0; i < points.length; i++) {
        const v = points[i][dataKey];
        if (v === null) continue;
        const x = pad + i * step;
        const y = 10 + chartH - ((v - minV) / range) * chartH;
        pathParts.push((pathParts.length === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1));
        dotParts.push('<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="3" fill="' + color + '"/>');
      }
      let baseline = '';
      if (baselineVal !== undefined && baselineVal >= minV && baselineVal <= maxV) {
        const by = 10 + chartH - ((baselineVal - minV) / range) * chartH;
        baseline = '<line x1="' + pad + '" y1="' + by.toFixed(1) + '" x2="' + (w - padR) + '" y2="' + by.toFixed(1) + '" stroke="var(--dim)" stroke-width="0.5" stroke-dasharray="4,4"/>';
      }
      const yMax = suffix ? maxV + suffix : fmt(maxV);
      const yMin = suffix ? minV + suffix : fmt(minV);
      const yLabels = '<text x="' + (pad - 4) + '" y="14" text-anchor="end" fill="var(--dim)" font-size="9">' + yMax + '</text>' +
        '<text x="' + (pad - 4) + '" y="' + (10 + chartH) + '" text-anchor="end" fill="var(--dim)" font-size="9">' + yMin + '</text>';
      const xLabels = '<text x="' + pad + '" y="' + (h - 2) + '" text-anchor="start" fill="var(--dim)" font-size="8">' + points[0].label + '</text>' +
        '<text x="' + (w - padR) + '" y="' + (h - 2) + '" text-anchor="end" fill="var(--dim)" font-size="8">' + points[points.length - 1].label + '</text>';
      return '<div>' +
        '<div class="sec-subtitle" style="margin-top:0;">' + title + '</div>' +
        '<svg viewBox="0 0 ' + w + ' ' + h + '" style="width:100%;max-width:' + w + 'px;height:auto;">' +
        baseline + yLabels + xLabels +
        '<path d="' + pathParts.join(' ') + '" fill="none" stroke="' + color + '" stroke-width="1.5"/>' +
        dotParts.join('') +
        '</svg></div>';
    }
    let tHtml = '';
    tHtml += '<div class="trends-grid">';
    tHtml += svgChart('Cumulative Win Rate', 'wr', 'var(--green)', '%', 50);
    tHtml += svgChart('Cumulative VPIP', 'vpip', 'var(--gold)', '%');
    tHtml += svgChart('Cumulative Aggression', 'agg', 'var(--amber)', '%');
    tHtml += svgChart('Cumulative Net P&L (Cash Only)', 'netPnl', 'var(--green)', '', 0);
    tHtml += '</div>';
    tHtml += '<div class="sec-subtitle">Session Breakdown</div>';
    tHtml += '<div style="overflow-x:auto;"><table class="tbl"><thead><tr><th>Date</th><th>Hands</th><th>Session ' + tipWrap('Win Rate') + '</th><th>Cumulative ' + tipWrap('Win Rate') + '</th><th>' + tipWrap('VPIP') + '</th><th>' + tipWrap('Aggression') + '</th></tr></thead><tbody>';
    for (let pi = points.length - 1; pi >= 0; pi--) {
      const pt = points[pi];
      const wrCol2 = pt.sessionWr !== null && pt.sessionWr >= 50 ? 'var(--green)' : pt.sessionWr !== null ? 'var(--red)' : 'var(--dim)';
      tHtml += '<tr><td>' + pt.label + '</td><td>' + pt.hands + '</td>' +
        '<td style="color:' + wrCol2 + '">' + (pt.sessionWr !== null ? pt.sessionWr + '%' : '—') + '</td>' +
        '<td>' + (pt.wr !== null ? pt.wr + '%' : '—') + '</td>' +
        '<td>' + (pt.vpip !== null ? pt.vpip + '%' : '—') + '</td>' +
        '<td>' + (pt.agg !== null ? pt.agg + '%' : '—') + '</td></tr>';
    }
    tHtml += '</tbody></table></div>';
    const tIns = [];
    if (points.length >= 3) {
      const last = points[points.length - 1];
      const mid = points[Math.floor(points.length / 2)];
      if (last.wr !== null && mid.wr !== null) {
        const diff = last.wr - mid.wr;
        if (diff > 5) {
          const exRecentWin = findExampleHand(function(h) { return h.outcome && h.outcome.result === 'won' && (h.timestamp || 0) >= (sorted[Math.floor(sorted.length / 2)].timestamp || 0); });
          tIns.push(insWithExample('g', 'Win Rate Improving', 'Your cumulative win rate has climbed ' + diff + ' percentage points over the second half of your sessions.', [{ v: mid.wr + '% → ' + last.wr + '%', hi: true }], exRecentWin, 'A recent winning hand from your improving stretch. Whatever adjustments you have made are paying off — keep it up.'));
        } else if (diff < -5) {
          const exRecentLoss = findExampleHand(function(h) { return h.outcome && h.outcome.result !== 'won' && (h.timestamp || 0) >= (sorted[Math.floor(sorted.length / 2)].timestamp || 0); });
          tIns.push(insWithExample('a', 'Win Rate Declining', 'Your cumulative win rate has dropped ' + Math.abs(diff) + ' percentage points. Check for recent leaks or tilt.', [{ v: mid.wr + '% → ' + last.wr + '%', hi: true }], exRecentLoss, 'A recent losing hand during your downswing. Review whether you are tilting, calling too wide, or facing tougher competition.'));
        } else tIns.push(ins('n', 'Win Rate Stable', 'Consistent at around ' + last.wr + '% across sessions.', [{ v: last.wr + '%' }]));
      }
      if (last.vpip !== null && mid.vpip !== null) {
        const vdiff = last.vpip - mid.vpip;
        if (Math.abs(vdiff) > 8) {
          const exVpipShift = findExampleHand(function(h) {
            if (!h.timestamp || h.timestamp < (sorted[Math.floor(sorted.length / 2)].timestamp || 0)) return false;
            var ma = parseActions(h.actions).filter(function(a) { return a.isMe && a.street === 'Preflop'; });
            return vdiff > 0
              ? ma.some(function(a) { return a.type === 'call' || a.type === 'raise'; })
              : ma.some(function(a) { return a.type === 'fold'; });
          });
          tIns.push(insWithExample('a', 'VPIP Shift', 'Your VPIP has moved ' + (vdiff > 0 ? 'up' : 'down') + ' by ' + Math.abs(vdiff) + ' points. Check if your hand selection has changed intentionally.', [{ v: mid.vpip + '% → ' + last.vpip + '%', hi: true }], exVpipShift, vdiff > 0 ? 'A recent hand where you voluntarily entered the pot. Your VPIP has increased — make sure you are not playing too many marginal hands.' : 'A recent hand where you folded preflop. Your VPIP has dropped — make sure you are not being too tight and missing value.'));
        }
      }
    }
    if (!tIns.length) tIns.push(ins('n', 'Trends', 'Keep tracking to build up enough data points for trend insights.', []));
    tHtml += '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:9px;margin-top:24px;">' + tIns.join('') + '</div>';
    document.getElementById('p-trends').innerHTML = tHtml;
  })();

  // ── PLAYERS ──
  (function renderPlayers() {
    // Build opponent map from all hands
    var oppMap = {};
    for (var i = 0; i < hands.length; i++) {
      var h = hands[i];
      var acts = parseActions(h.actions);
      var seenInHand = {};
      for (var j = 0; j < acts.length; j++) {
        var a = acts[j];
        if (a.isMe || !a.author || seenInHand[a.author]) continue;
        seenInHand[a.author] = true;
        if (!oppMap[a.author]) {
          oppMap[a.author] = { name: a.author, hands: 0, won: 0, lost: 0, folded: 0, profit: 0, handRefs: [] };
        }
        oppMap[a.author].hands++;
        oppMap[a.author].handRefs.push(i);
        if (h.outcome) {
          if (h.outcome.result === 'won') {
            var inv = h.invested || calcInvestmentFromActions(h.actions || []);
            var pr = (h.outcome.amount || 0) - inv;
            oppMap[a.author].won++;
            oppMap[a.author].profit += pr > 0 ? pr : (h.outcome.amount || 0);
          } else if (h.outcome.result === 'folded') {
            oppMap[a.author].folded++;
            var inv2 = h.invested || calcInvestmentFromActions(h.actions || []);
            oppMap[a.author].profit -= inv2;
          } else {
            oppMap[a.author].lost++;
            var inv3 = h.invested || calcInvestmentFromActions(h.actions || []);
            oppMap[a.author].profit -= inv3;
          }
        }
      }
    }

    // Sort by hands played descending
    var opponents = Object.keys(oppMap).map(function(k) { return oppMap[k]; });
    opponents.sort(function(a, b) { return b.hands - a.hands; });

    // Filter to opponents with 2+ hands
    var filtered = opponents.filter(function(o) { return o.hands >= 2; });

    // Watch list persistence
    function getWatchedPlayers() {
      try { return JSON.parse(localStorage.getItem('tc_watched_players') || '[]'); } catch(e) { return []; }
    }
    function setWatchedPlayers(list) {
      localStorage.setItem('tc_watched_players', JSON.stringify(list));
    }
    function toggleWatch(name) {
      var list = getWatchedPlayers();
      var idx = list.indexOf(name);
      if (idx >= 0) list.splice(idx, 1); else list.push(name);
      setWatchedPlayers(list);
      renderPlayerList();
    }

    function renderPlayerList() {
      if (!filtered.length) {
        document.getElementById('p-players').innerHTML = ins('n', 'Players', 'Not enough shared hands to show opponent stats. Keep playing to build data.', []);
        return;
      }

      var watched = getWatchedPlayers();
      var maxH = Math.max.apply(null, filtered.map(function(o) { return o.hands; }));

      // Split into watched and unwatched
      var watchedOpps = filtered.filter(function(o) { return watched.indexOf(o.name) >= 0; });

      var html = '';

      // Watched players section
      if (watchedOpps.length) {
        html += '<div class="sec-subtitle" style="margin-top:0;">Watched Players</div>';
        html += '<div style="font-size:9px;color:var(--dim);margin-bottom:8px;">Click star to unwatch · click row to view hands</div>';
        html += '<div style="overflow-x:auto;"><table class="tbl-compare"><thead><tr>';
        html += '<th></th><th>Player</th><th>Hands</th><th></th><th>' + tipWrap('Win Rate') + '</th><th>Net P&L</th>';
        html += '</tr></thead><tbody>';
        for (var w = 0; w < watchedOpps.length; w++) {
          var o = watchedOpps[w];
          var wr = pct(o.won, o.won + o.lost);
          var barW = Math.round(o.hands / maxH * 100);
          html += '<tr class="player-row" data-player="' + o.name + '" style="cursor:pointer;transition:border-color .15s;" onmouseover="this.style.borderColor=\'var(--gold2)\'" onmouseout="this.style.borderColor=\'\'">';
          html += '<td class="watch-star watched" data-watch="' + o.name + '" title="Unwatch player" style="cursor:pointer;width:24px;text-align:center;color:var(--gold);font-size:14px;">&#9733;</td>';
          html += '<td>' + o.name + '</td>';
          html += '<td>' + o.hands + '</td>';
          html += '<td style="width:80px;"><span class="tbl-spark" style="width:' + barW + '%;background:var(--gold2);"></span></td>';
          html += '<td class="' + (wr !== null && wr >= 50 ? 'wr-good' : wr !== null ? 'wr-bad' : '') + '">' + (wr !== null ? wr + '%' : '—') + '</td>';
          html += '<td class="' + (o.profit >= 0 ? 'pnl-pos' : 'pnl-neg') + '">' + (o.profit >= 0 ? '+' : '') + fmt(o.profit) + '</td>';
          html += '</tr>';
        }
        html += '</tbody></table></div>';
      }

      // Insights (show before the big table so they're always visible)
      var pIns = [];
      if (filtered.length >= 1) {
        pIns.push(ins('n', 'Most Seen', 'You have played ' + filtered[0].hands + ' hands with ' + filtered[0].name + '.', [{ v: filtered[0].name, hi: true }, { v: filtered[0].hands + ' hands' }]));
      }
      var best = null;
      var worst = null;
      for (var m = 0; m < filtered.length; m++) {
        var ow = filtered[m];
        var owr = pct(ow.won, ow.won + ow.lost);
        if (owr === null || (ow.won + ow.lost) < 5) continue;
        if (!best || owr > pct(best.won, best.won + best.lost)) best = ow;
        if (!worst || owr < pct(worst.won, worst.won + worst.lost)) worst = ow;
      }
      if (best) {
        pIns.push(ins('g', 'Best Record', 'You win ' + pct(best.won, best.won + best.lost) + '% against ' + best.name + ' (' + (best.won + best.lost) + ' contested hands).', [{ v: best.name, hi: true }, { v: pct(best.won, best.won + best.lost) + '% win' }]));
      }
      if (worst && worst !== best) {
        pIns.push(ins('r', 'Toughest Opponent', 'Only ' + pct(worst.won, worst.won + worst.lost) + '% win rate against ' + worst.name + ' (' + (worst.won + worst.lost) + ' contested hands).', [{ v: worst.name, hi: true }, { v: pct(worst.won, worst.won + worst.lost) + '% win' }]));
      }
      if (pIns.length) html += '<div style="margin-top:20px;margin-bottom:20px;">' + pIns.join('') + '</div>';

      // All opponents table (scrollable)
      html += '<div class="sec-subtitle">All Opponents</div>';
      html += '<div style="font-size:9px;color:var(--dim);margin-bottom:8px;">' + filtered.length + ' opponents with 2+ shared hands · click star to watch · click row to view hands</div>';
      html += '<div class="players-table-scroll"><table class="tbl-compare"><thead><tr>';
      html += '<th></th><th>Player</th><th>Hands</th><th></th><th>' + tipWrap('Win Rate') + '</th><th>Net P&L</th>';
      html += '</tr></thead><tbody>';

      for (var k = 0; k < filtered.length; k++) {
        var o2 = filtered[k];
        var wr2 = pct(o2.won, o2.won + o2.lost);
        var barW2 = Math.round(o2.hands / maxH * 100);
        var isWatched = watched.indexOf(o2.name) >= 0;
        html += '<tr class="player-row" data-player="' + o2.name + '" style="cursor:pointer;transition:border-color .15s;" onmouseover="this.style.borderColor=\'var(--gold2)\'" onmouseout="this.style.borderColor=\'\'">';
        html += '<td class="watch-star' + (isWatched ? ' watched' : '') + '" data-watch="' + o2.name + '" title="' + (isWatched ? 'Unwatch' : 'Watch') + ' player" style="cursor:pointer;width:24px;text-align:center;font-size:14px;color:' + (isWatched ? 'var(--gold)' : 'var(--muted)') + ';">' + (isWatched ? '&#9733;' : '&#9734;') + '</td>';
        html += '<td>' + o2.name + '</td>';
        html += '<td>' + o2.hands + '</td>';
        html += '<td style="width:80px;"><span class="tbl-spark" style="width:' + barW2 + '%;background:var(--gold2);"></span></td>';
        html += '<td class="' + (wr2 !== null && wr2 >= 50 ? 'wr-good' : wr2 !== null ? 'wr-bad' : '') + '">' + (wr2 !== null ? wr2 + '%' : '—') + '</td>';
        html += '<td class="' + (o2.profit >= 0 ? 'pnl-pos' : 'pnl-neg') + '">' + (o2.profit >= 0 ? '+' : '') + fmt(o2.profit) + '</td>';
        html += '</tr>';
      }
      html += '</tbody></table></div>';

      document.getElementById('p-players').innerHTML = html;

      // Wire star clicks (stop propagation so row click doesn't fire)
      document.querySelectorAll('#p-players .watch-star').forEach(function(star) {
        star.onclick = function(e) {
          e.stopPropagation();
          toggleWatch(this.getAttribute('data-watch'));
        };
      });

      // Wire row clicks
      document.querySelectorAll('#p-players .player-row').forEach(function(row) {
        row.onclick = function() {
          renderPlayerHands(this.getAttribute('data-player'));
        };
      });
    }

    function renderPlayerHands(playerName) {
      var opp = oppMap[playerName];
      if (!opp) return;
      var playerHands = opp.handRefs.map(function(idx) { return hands[idx]; });

      var phPage = 0;
      var PH_SIZE = 50;

      function renderPage() {
        var start = phPage * PH_SIZE;
        var end = Math.min(start + PH_SIZE, playerHands.length);
        var page = playerHands.slice(start, end);
        var totalPages = Math.ceil(playerHands.length / PH_SIZE);
        var wr = pct(opp.won, opp.won + opp.lost);

        var ph = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">';
        ph += '<div>';
        ph += '<button class="log-nav-btn" id="players-back" style="margin-right:12px;">&laquo; All Players</button>';
        ph += '<span style="font-size:14px;font-weight:600;color:var(--gold);">' + playerName + '</span>';
        ph += '</div>';
        ph += '<div style="font-size:10px;color:var(--dim);">' + opp.hands + ' hands · ' + (wr !== null ? wr + '% win' : '—') + ' · ' + (opp.profit >= 0 ? '+' : '') + fmt(opp.profit) + '</div>';
        ph += '</div>';

        if (totalPages > 1) {
          ph += '<div style="display:flex;justify-content:flex-end;gap:6px;align-items:center;margin-bottom:8px;">';
          ph += '<button class="log-nav-btn" id="ph-prev" ' + (phPage === 0 ? 'disabled' : '') + '>&laquo; Prev</button>';
          ph += '<span style="font-size:9px;color:var(--dim);">Page ' + (phPage + 1) + '/' + totalPages + '</span>';
          ph += '<button class="log-nav-btn" id="ph-next" ' + (phPage >= totalPages - 1 ? 'disabled' : '') + '>Next &raquo;</button>';
          ph += '</div>';
        }

        ph += '<div class="hrow hrow-header"><div class="hrow-pos">Pos</div><div class="hrow-cards">Cards</div><div class="hrow-board">Board</div><div class="hrow-acts">Actions</div><div class="hrow-res">Result</div></div>';
        ph += '<div class="hlog">' + page.map(function(h, pi) {
          var myActs = parseActions(h.actions).filter(function(a) { return a.isMe; }).map(function(a) { return a.type; }).join(' · ');
          var invested = h.invested || calcInvestmentFromActions(h.actions || []);
          var res;
          if (h.outcome) {
            if (h.outcome.result === 'won') {
              var profit = (h.outcome.amount || 0) - invested;
              res = '<div class="hrow-res w">+' + fmt(profit > 0 ? profit : h.outcome.amount || h.pot || 0) + '</div>';
            } else if (h.outcome.result === 'folded') {
              res = '<div class="hrow-res l">' + (invested > 0 ? '-' + fmt(invested) : 'folded') + '</div>';
            } else {
              res = '<div class="hrow-res l">-' + fmt(invested) + '</div>';
            }
          } else {
            res = '<div class="hrow-res u">?</div>';
          }
          return '<div class="hrow" data-ph-idx="' + (start + pi) + '" style="cursor:pointer;transition:border-color .15s;" onmouseover="this.style.borderColor=\'var(--gold2)\'" onmouseout="this.style.borderColor=\'\'"><div class="hrow-pos">' + (h.position || '?') + '</div><div class="hrow-cards">' + (h.hole && h.hole.length ? h.hole.join(' ') : '?? ??') + '</div><div class="hrow-board">' + (h.board && h.board.length ? h.board.join(' ') : '—') + '</div><div class="hrow-acts">' + myActs + '</div>' + res + '</div>';
        }).join('') + '</div>';

        document.getElementById('p-players').innerHTML = ph;

        // Wire back button
        document.getElementById('players-back').onclick = function() { renderPlayerList(); };

        // Wire hand row clicks
        document.querySelectorAll('#p-players .hrow[data-ph-idx]').forEach(function(row) {
          row.onclick = function() {
            var idx = parseInt(this.getAttribute('data-ph-idx'));
            if (!isNaN(idx) && playerHands[idx]) {
              showExampleHandModal(playerHands[idx]);
            }
          };
        });

        // Wire pagination
        var prev = document.getElementById('ph-prev');
        var next = document.getElementById('ph-next');
        if (prev) prev.onclick = function() { phPage--; renderPage(); };
        if (next) next.onclick = function() { phPage++; renderPage(); };
      }

      renderPage();
    }

    renderPlayerList();
  })();

  // ── TABLE FILTER HANDLER ──
  filterEl.onchange = function() {
    const v = this.value;
    let filtered = _allHands;
    if (v !== 'all') {
      filtered = _allHands.filter(h => {
        const tid = inferTable(h);
        return v === 'unknown' ? tid === null : tid === Number(v);
      });
    }
    if (!filtered.length) { alert('No hands for this table.'); this.value = 'all'; return; }
    const fd = analyse(filtered);
    render(fd, filtered, _meta);
    document.getElementById('table-filter').value = v;
  };
  document.getElementById('reset-btn').onclick = function() {
    document.getElementById('paste-wrap').style.display = 'block';
    document.getElementById('jin').value = '';
    document.getElementById('dash').classList.remove('on');
    document.getElementById('table-filter').value = 'all';
    document.getElementById('table-filter').style.display = 'none';
    _allHands = [];
    _meta = {};
    document.querySelectorAll('.tab').forEach((b, i) => {
      b.classList.toggle('active', i === 0);
    });
    document.querySelectorAll('.panel').forEach((p, i) => {
      p.classList.toggle('on', i === 0);
    });
    checkSavedSession();
  };
}

// ── PROCESS ─────────────────────────────────────────────────────────────────
function process(raw) {
  let json;
  try {
    json = JSON.parse(raw.trim());
  } catch (e) {
    alert('Could not parse JSON.\n\nMake sure you:\n1. Clicked Export in the TC panel\n2. Pasted the full clipboard contents here\n\nError: ' + e.message);
    return;
  }
  const hands = Array.isArray(json) ? json : (json.hands || []);
  if (!hands.length) {
    alert('No hands found in export. Play some hands first, then export.');
    return;
  }
  try {
    localStorage.setItem('tc_poker_analysis', raw);
  } catch (_) {}
  let playerName = json.player || 'Unknown';
  if (playerName === 'Unknown') {
    const detected = detectPlayerFromActions(hands);
    if (detected) playerName = detected;
  }
  setSession(hands, {
    player: playerName,
    exportedAt: json.exportedAt || new Date().toISOString(),
  });
  const d = analyse(hands);
  showImportLoader(hands.length, () => render(d, hands, _meta));
}

document.getElementById('go-btn').onclick = function() {
  const v = document.getElementById('jin').value.trim();
  if (v) process(v);
  else alert('Paste JSON first.');
};

document.getElementById('paste-btn').onclick = async function() {
  const errEl = document.getElementById('paste-error');
  const jin = document.getElementById('jin');
  errEl.style.display = 'none';
  try {
    const text = await navigator.clipboard.readText();
    if (!text || !text.trim()) {
      errEl.textContent = 'Clipboard is empty. Make sure you clicked "Analyse Session" in the TC Poker Tracker first.';
      errEl.style.display = 'block';
      return;
    }
    process(text.trim());
  } catch (e) {
    // Clipboard API blocked — focus the textarea so user can Ctrl+V / Cmd+V
    jin.focus();
    jin.placeholder = 'Paste here with Ctrl+V (or Cmd+V on Mac), then press Ctrl+Enter';
    errEl.innerHTML = 'Your browser blocked clipboard access. <strong>Press Ctrl+V</strong> (Cmd+V on Mac) to paste into the box below, then press <strong>Ctrl+Enter</strong> to load.';
    errEl.style.display = 'block';
  }
};

document.getElementById('jin').addEventListener('keydown', function(e) {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) process(this.value);
});

// Position a tooltip relative to the viewport so it escapes overflow containers
function positionTip(tooltipEl) {
  var tipBox = tooltipEl.querySelector('.tip-box');
  if (!tipBox) return;
  // Temporarily show to measure
  tipBox.style.visibility = 'hidden';
  tipBox.style.display = 'block';
  var anchor = tooltipEl.getBoundingClientRect();
  var tw = tipBox.offsetWidth;
  var th = tipBox.offsetHeight;
  tipBox.style.display = '';
  tipBox.style.visibility = '';

  var top = anchor.top - th - 8;
  var left = anchor.left;

  // Flip below if no room above
  if (top < 8) top = anchor.bottom + 8;
  // Clamp horizontal
  if (left + tw > window.innerWidth - 8) left = window.innerWidth - 8 - tw;
  if (left < 8) left = 8;

  tipBox.style.top = top + 'px';
  tipBox.style.left = left + 'px';
}

// Desktop hover positioning
document.addEventListener('mouseover', function(e) {
  var tip = e.target.closest('.tooltip');
  if (tip) positionTip(tip);
});

// Mobile tooltip support: tap to toggle
document.addEventListener('click', function(e) {
  const tip = e.target.closest('.tooltip');
  document.querySelectorAll('.tooltip.active').forEach(function(t) {
    if (t !== tip) t.classList.remove('active');
  });
  if (tip) {
    tip.classList.toggle('active');
    if (tip.classList.contains('active')) positionTip(tip);
  }
});

// Reposition active tooltip on scroll/resize
window.addEventListener('scroll', function() {
  var active = document.querySelector('.tooltip.active');
  if (active) positionTip(active);
}, true);
window.addEventListener('resize', function() {
  var active = document.querySelector('.tooltip.active');
  if (active) positionTip(active);
});

// ── PROFILE ────────────────────────────────────────────────────────────────
const CHANGELOG = [
  {
    version: 'v1.4', date: 'Mar 2026', latest: true,
    headline: 'Table detection + tournament filtering',
    items: [
      { tag: 'new', text: 'Auto-detects which TC table a hand was played at using blind amounts and player count' },
      { tag: 'new', text: 'Table filter dropdown lets you isolate stats to a single table' },
      { tag: 'new', text: 'Tournament hands separated from cash hand analysis' },
      { tag: 'imp', text: 'Per-table stats: win rate, VPIP, aggression, and net chips by table' },
      { tag: 'imp', text: 'Trend charts now group by session day with cumulative P&L line' },
    ],
  },
  {
    version: 'v1.3', date: 'Feb 2026',
    headline: 'Session persistence and paste-from-clipboard',
    items: [
      { tag: 'new', text: 'One-click paste from clipboard' },
      { tag: 'new', text: 'Last session stored locally and auto-loaded on next visit' },
      { tag: 'imp', text: 'Import loader with hand count animation on paste' },
      { tag: 'fix', text: 'Player name detection from action log when not in export metadata' },
    ],
  },
  {
    version: 'v1.2', date: 'Jan 2026',
    headline: 'Insights engine and street-level breakdown',
    items: [
      { tag: 'new', text: 'Automated insight cards flagging leaks: positional weaknesses, fold frequency, VPIP bands' },
      { tag: 'new', text: 'Street-by-street action breakdown (preflop, flop, turn, river)' },
      { tag: 'new', text: 'Hole card range heatmap showing VPIP and win rate by starting hand' },
      { tag: 'imp', text: 'Position stats panel with per-seat win rate and net chip delta' },
    ],
  },
  {
    version: 'v1.1', date: 'Dec 2025',
    headline: 'Live viewer panel and outcome tracking',
    items: [
      { tag: 'new', text: 'Tampermonkey panel shows current hand in real time on the TC poker page' },
      { tag: 'new', text: 'Outcome detection for wins, losses, and folds with fold street recorded' },
      { tag: 'fix', text: 'Hands with no hole cards no longer logged to the export' },
    ],
  },
  {
    version: 'v1.0', date: 'Nov 2025',
    headline: 'Initial release',
    items: [
      { tag: 'new', text: 'WebSocket interception via Tampermonkey to silently capture hands as they are played' },
      { tag: 'new', text: 'Hand data stored in localStorage only — nothing sent externally' },
      { tag: 'new', text: 'JSON export for pasting into the analysis tool' },
      { tag: 'new', text: 'Basic stats: hands played, win rate, VPIP, aggression factor' },
    ],
  },
];

function openProfile() {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('on'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.getElementById('p-profile').classList.add('on');
  renderProfile();
}

function renderProfile() {
  let stats = null;
  let playerName = 'Unknown';
  let exportDate = '';

  if (_allHands && _allHands.length) {
    const d = analyse(_allHands);
    const wr2 = pct(d.handsWon, d.handsWithOutcome);
    const netPnl2 = d.totalWonAmount - d.totalInvested;
    const vpipPct2 = pct(d.vpip, d.n);
    const aggPct2 = pct(d.raises, d.totalActs);
    playerName = _meta.player || detectPlayerFromActions(_allHands) || 'Unknown';
    exportDate = _meta.exportedAt ? new Date(_meta.exportedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
    stats = { n: d.n, wr: wr2, netPnl: netPnl2, vpipPct: vpipPct2, aggPct: aggPct2 };
  } else {
    try {
      const saved = localStorage.getItem('tc_poker_analysis');
      if (saved) {
        const json = JSON.parse(saved);
        const hands = (json.hands || []).filter(function(h) { return h.hole && h.hole.length === 2; });
        if (hands.length) {
          const d2 = analyse(hands);
          const wr3 = pct(d2.handsWon, d2.handsWithOutcome);
          const netPnl3 = d2.totalWonAmount - d2.totalInvested;
          playerName = json.player || detectPlayerFromActions(hands) || 'Unknown';
          exportDate = json.exportedAt ? new Date(json.exportedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
          stats = { n: d2.n, wr: wr3, netPnl: netPnl3, vpipPct: pct(d2.vpip, d2.n), aggPct: pct(d2.raises, d2.totalActs) };
        }
      }
    } catch (_) {}
  }

  const tagColors = { new: 'color:var(--green);background:rgba(63,173,100,0.1);', fix: 'color:var(--amber);background:rgba(212,132,42,0.1);', imp: 'color:var(--dim);background:rgba(122,154,122,0.1);' };

  let html = '<div style="max-width:700px;">';
  html += '<div style="margin-bottom:32px;">';
  html += '<div style="font-size:9px;letter-spacing:5px;color:var(--dim);text-transform:uppercase;margin-bottom:10px;">TC Poker Analysis</div>';
  html += '<div style="font-family:\'Cormorant Garamond\',serif;font-size:clamp(28px,4vw,44px);font-weight:700;color:var(--gold);margin-bottom:4px;">' + playerName + '</div>';
  if (exportDate) html += '<div style="font-size:10px;color:var(--dim);">Last session: ' + exportDate + '</div>';
  html += '</div>';

  if (stats) {
    html += '<div style="font-size:9px;letter-spacing:4px;text-transform:uppercase;color:var(--dim);margin-bottom:14px;">Your Stats</div>';
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px;margin-bottom:36px;">';
    const statItems = [
      { l: 'Hands',      v: stats.n,                     c: 'var(--gold)' },
      { l: 'Win Rate',   v: stats.wr !== null ? stats.wr + '%' : '—', c: stats.wr >= 50 ? 'var(--green)' : 'var(--red)' },
      { l: 'Net P&L',    v: (stats.netPnl >= 0 ? '+' : '') + fmt(stats.netPnl), c: stats.netPnl >= 0 ? 'var(--green)' : 'var(--red)' },
      { l: 'VPIP',       v: stats.vpipPct !== null ? stats.vpipPct + '%' : '—', c: 'var(--text)' },
      { l: 'Aggression', v: stats.aggPct !== null ? stats.aggPct + '%' : '—', c: 'var(--text)' },
    ];
    statItems.forEach(function(s) {
      html += '<div style="background:var(--s2);border:1px solid var(--border);border-radius:5px;padding:12px 14px;">';
      html += '<div style="font-size:8px;letter-spacing:2px;color:var(--dim);text-transform:uppercase;margin-bottom:6px;">' + s.l + '</div>';
      html += '<div style="font-family:\'Cormorant Garamond\',serif;font-size:22px;font-weight:700;line-height:1;color:' + s.c + ';">' + s.v + '</div>';
      html += '</div>';
    });
    html += '</div>';
  }

  html += '<div style="font-size:9px;letter-spacing:4px;text-transform:uppercase;color:var(--dim);margin-bottom:14px;">Custom Dashboards</div>';
  html += '<div style="background:var(--s2);border:1px solid var(--border);border-radius:8px;padding:24px 28px;margin-bottom:36px;display:flex;gap:24px;align-items:flex-start;">';
  html += '<div style="font-family:\'Cormorant Garamond\',serif;font-size:44px;color:var(--gold2);opacity:0.4;line-height:1;flex-shrink:0;">♠</div>';
  html += '<div>';
  html += '<div style="font-family:\'Cormorant Garamond\',serif;font-size:20px;font-weight:700;color:var(--text);margin-bottom:8px;">Want something specific?</div>';
  html += '<div style="font-size:11px;color:var(--dim);line-height:1.7;margin-bottom:10px;">If there\'s a stat, pattern, or view the standard tool doesn\'t cover, a custom dashboard can be built to your exact requirements.</div>';
  html += '<div style="font-size:10px;color:var(--amber);margin-bottom:14px;">Prices start from <span style="color:var(--gold);">100,000,000 chips</span></div>';
  html += '<a href="https://discord.com" target="_blank" style="display:inline-flex;align-items:center;gap:6px;background:transparent;border:1px solid var(--gold2);color:var(--gold);font-family:\'IBM Plex Mono\',monospace;font-size:10px;letter-spacing:2px;text-transform:uppercase;padding:8px 16px;border-radius:4px;cursor:pointer;text-decoration:none;">Contact on Discord</a>';
  html += '</div></div>';

  html += '<div style="height:1px;background:var(--border);margin-bottom:32px;"></div>';
  html += '<div style="font-size:9px;letter-spacing:4px;text-transform:uppercase;color:var(--dim);margin-bottom:20px;">Changelog</div>';
  CHANGELOG.forEach(function(entry) {
    html += '<div style="display:grid;grid-template-columns:90px 1fr;gap:0 24px;padding:20px 0;border-bottom:1px solid var(--border);">';
    html += '<div style="padding-top:2px;">';
    html += '<div style="font-family:\'Cormorant Garamond\',serif;font-size:18px;font-weight:600;color:var(--gold);margin-bottom:3px;">' + entry.version + '</div>';
    html += '<div style="font-size:9px;color:var(--dim);">' + entry.date + '</div>';
    if (entry.latest) html += '<div style="display:inline-block;margin-top:6px;font-size:8px;letter-spacing:1.5px;text-transform:uppercase;padding:2px 6px;border-radius:2px;background:rgba(63,173,100,0.12);color:var(--green);border:1px solid rgba(63,173,100,0.25);">Latest</div>';
    html += '</div>';
    html += '<div>';
    html += '<div style="font-size:12px;color:var(--text);margin-bottom:8px;font-weight:500;">' + entry.headline + '</div>';
    html += '<ul style="list-style:none;display:flex;flex-direction:column;gap:5px;">';
    entry.items.forEach(function(item) {
      const tagStyle = tagColors[item.tag] || '';
      html += '<li style="font-size:10px;color:var(--dim);line-height:1.55;padding-left:12px;position:relative;">';
      html += '<span style="position:absolute;left:0;color:var(--border);">—</span>';
      html += '<span style="font-size:8px;letter-spacing:1px;text-transform:uppercase;margin-right:5px;padding:1px 4px;border-radius:2px;' + tagStyle + '">' + item.tag + '</span>';
      html += item.text + '</li>';
    });
    html += '</ul></div></div>';
  });

  html += '</div>';
  document.getElementById('p-profile').innerHTML = html;
}


