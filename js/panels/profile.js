// ── PROFILE PANEL ─────────────────────────────────────────────────────────────

function openProfile() {
  document.querySelectorAll('.panel').forEach(function(p) { p.classList.remove('on'); });
  document.querySelectorAll('.tab').forEach(function(t) { t.classList.remove('active'); });
  document.getElementById('p-profile').classList.add('on');
  renderProfile();
}

function renderProfile() {
  var stats = null;
  var playerName = 'Unknown';
  var exportDate = '';

  if (State.allHands && State.allHands.length) {
    var d = analyse(State.allHands);
    var wr2 = pct(d.handsWon, d.handsWithOutcome);
    var netPnl2 = d.totalWonAmount - d.totalInvested;
    var vpipPct2 = pct(d.vpip, d.n);
    var aggPct2 = pct(d.raises, d.totalActs);
    playerName = State.meta.player || detectPlayerFromActions(State.allHands) || 'Unknown';
    exportDate = State.meta.exportedAt ? new Date(State.meta.exportedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
    stats = { n: d.n, wr: wr2, netPnl: netPnl2, vpipPct: vpipPct2, aggPct: aggPct2 };
  } else {
    try {
      var saved = localStorage.getItem('tc_poker_analysis');
      if (saved) {
        var json = JSON.parse(saved);
        var hands = (json.hands || []).filter(function(h) { return h.hole && h.hole.length === 2; });
        if (hands.length) {
          var d2 = analyse(hands);
          var wr3 = pct(d2.handsWon, d2.handsWithOutcome);
          var netPnl3 = d2.totalWonAmount - d2.totalInvested;
          playerName = json.player || detectPlayerFromActions(hands) || 'Unknown';
          exportDate = json.exportedAt ? new Date(json.exportedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
          stats = { n: d2.n, wr: wr3, netPnl: netPnl3, vpipPct: pct(d2.vpip, d2.n), aggPct: pct(d2.raises, d2.totalActs) };
        }
      }
    } catch (_) {}
  }

  var html = '<div style="max-width:700px;">';
  html += '<div style="margin-bottom:32px;">';
  html += '<div style="font-size:9px;letter-spacing:5px;color:var(--dim);text-transform:uppercase;margin-bottom:10px;">TC Poker Analysis</div>';
  html += '<div style="font-family:\'Cormorant Garamond\',serif;font-size:clamp(28px,4vw,44px);font-weight:700;color:var(--gold);margin-bottom:4px;">' + playerName + '</div>';
  if (exportDate) html += '<div style="font-size:10px;color:var(--dim);">Last session: ' + exportDate + '</div>';
  html += '</div>';

  if (stats) {
    html += '<div style="font-size:9px;letter-spacing:4px;text-transform:uppercase;color:var(--dim);margin-bottom:14px;">Your Stats</div>';
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px;margin-bottom:36px;">';
    var statItems = [
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

  html += '</div>';
  document.getElementById('p-profile').innerHTML = html;
}
