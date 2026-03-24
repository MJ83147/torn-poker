// ── PROFILE PANEL ─────────────────────────────────────────────────────────────

function openProfile() {
  switchTab('profile');
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

  var html = '<div class="profile-wrap">';
  html += '<div class="profile-header">';
  html += '<div class="profile-eyebrow">TC Poker Analysis</div>';
  html += '<div class="profile-name">' + playerName + '</div>';
  if (exportDate) html += '<div class="profile-date">Last session: ' + exportDate + '</div>';
  html += '</div>';

  if (stats) {
    html += '<div class="section-label">Your Stats</div>';
    html += '<div class="profile-stat-grid">';
    var statItems = [
      { l: 'Hands',      v: stats.n,                     c: 'var(--gold)' },
      { l: 'Win Rate',   v: stats.wr !== null ? stats.wr + '%' : '—', c: stats.wr >= 50 ? 'var(--green)' : 'var(--red)' },
      { l: 'Net P&L',    v: fmtPnl(stats.netPnl), c: pnlColor(stats.netPnl) },
      { l: 'VPIP',       v: stats.vpipPct !== null ? stats.vpipPct + '%' : '—', c: 'var(--text)' },
      { l: 'Aggression', v: stats.aggPct !== null ? stats.aggPct + '%' : '—', c: 'var(--text)' },
    ];
    statItems.forEach(function(s) {
      html += '<div class="profile-stat-card">';
      html += '<div class="profile-stat-label">' + s.l + '</div>';
      html += '<div class="profile-stat-value" style="color:' + s.c + ';">' + s.v + '</div>';
      html += '</div>';
    });
    html += '</div>';
  }

  html += '<div class="section-label">Custom Dashboards</div>';
  html += '<div class="profile-cta-card">';
  html += '<div class="profile-cta-suit">♠</div>';
  html += '<div>';
  html += '<div class="profile-cta-title">Want something specific?</div>';
  html += '<div class="profile-cta-desc">If there\'s a stat, pattern, or view the standard tool doesn\'t cover, a custom dashboard can be built to your exact requirements.</div>';
  html += '<div class="profile-cta-price">Prices start from <span class="text-gold">100,000,000 chips</span></div>';
  html += '<a href="https://discord.com" target="_blank" class="profile-cta-btn">Contact on Discord</a>';
  html += '</div></div>';

  html += '</div>';
  document.getElementById('p-profile').innerHTML = html;
}
