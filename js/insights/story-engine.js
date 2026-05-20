(function() {
  var SECTIONS = [];

  function defineSection(spec) {
    if (!spec || !spec.id || typeof spec.run !== 'function') {
      throw new Error('Sections.defineSection: { id, run } required');
    }
    SECTIONS.push(spec);
  }

  // Memoise on `d` identity so the 12+ per-tab calls share one computation.
  // WeakMap auto-evicts when the old `d` is garbage-collected.
  var _findingsByD = (typeof WeakMap !== 'undefined') ? new WeakMap() : null;

  function evaluateSections(d, extras, hands) {
    if (_findingsByD && d && typeof d === 'object' && _findingsByD.has(d)) {
      return _findingsByD.get(d);
    }
    var findings = [];
    extras = extras || {};
    for (var i = 0; i < SECTIONS.length; i++) {
      var s = SECTIONS[i];
      var out = null;
      try { out = s.run(d, extras, hands); } catch (e) {
        if (typeof console !== 'undefined' && console.warn) {
          console.warn('Sections.evaluateSections: section ' + s.id + ' threw', e);
        }
        out = null;
      }
      if (!out) continue;
      for (var j = 0; j < out.length; j++) {
        if (out[j]) findings.push(out[j]);
      }
    }
    findings.sort(function(a, b) { return (b.score || 0) - (a.score || 0); });
    if (_findingsByD && d && typeof d === 'object') _findingsByD.set(d, findings);
    return findings;
  }

  function findingsForPanel(findings, panelName) {
    var out = [];
    for (var i = 0; i < findings.length; i++) {
      if (findings[i] && findings[i].panel === panelName) out.push(findings[i]);
    }
    return out;
  }

  function dominantSeatsCount(d) {
    return dominantSeats(d);
  }

  function fmtBand(band) {
    if (!band) return '';
    if (band.tight != null && band.loose != null) return Math.round(band.tight) + ' to ' + Math.round(band.loose) + '%';
    if (band.floor != null && band.ceiling != null) return Math.round(band.floor) + ' to ' + Math.round(band.ceiling) + '%';
    return '';
  }

  function classify(value, band, strengthSide) {
    if (value == null) return null;
    if (!band) return { severity: 'n', direction: 'mid', deltaUnits: 0 };

    var lo, hi;
    if (band.tight != null && band.loose != null) { lo = band.tight; hi = band.loose; }
    else if (band.floor != null && band.ceiling != null) { lo = band.floor; hi = band.ceiling; }
    else return { severity: 'n', direction: 'mid', deltaUnits: 0 };

    var bandWidth = Math.max(1, hi - lo);
    if (value >= lo && value <= hi) {
      return { severity: 'g', direction: 'mid', deltaUnits: 0 };
    }
    var direction = value < lo ? 'low' : 'high';
    var deltaUnits = direction === 'low' ? (lo - value) / bandWidth : (value - hi) / bandWidth;

    if (strengthSide && direction === strengthSide && deltaUnits < 1) {
      return { severity: 'g', direction: direction, deltaUnits: deltaUnits };
    }
    if (deltaUnits >= 1) return { severity: 'r', direction: direction, deltaUnits: deltaUnits };
    return { severity: 'a', direction: direction, deltaUnits: deltaUnits };
  }

  function combineSeverity(severities) {
    var rank = { r: 4, a: 3, n: 2, g: 1 };
    var best = null;
    var bestRank = -1;
    for (var i = 0; i < severities.length; i++) {
      var s = severities[i];
      if (!s) continue;
      var r = rank[s] || 0;
      if (r > bestRank) { bestRank = r; best = s; }
    }
    return best || 'g';
  }

  function score(severity, deltaUnits) {
    var base;
    if (severity === 'r') base = 30;
    else if (severity === 'a') base = 15;
    else if (severity === 'g') base = 10;
    else base = 5;
    return base + Math.min(10, Math.round((deltaUnits || 0) * 4));
  }

  function classifyPnlGate(severity, pnlOff, pnlOn, nOff, nOn, opts) {
    opts = opts || {};
    var minCell = opts.minCell != null ? opts.minCell : 10;
    var minGap = opts.minGap != null ? opts.minGap : 0;

    var hasOff = nOff != null && nOff >= minCell;
    var hasOn  = nOn  != null && nOn  >= minCell;
    var ppOff = hasOff && nOff > 0 ? pnlOff / nOff : null;
    var ppOn  = hasOn  && nOn  > 0 ? pnlOn  / nOn  : null;

    var pnlIsWorse = false;
    if (ppOff != null && ppOn != null) {
      pnlIsWorse = (ppOn - ppOff) > minGap;
    } else if (ppOff != null) {
      pnlIsWorse = ppOff < -minGap;
    }

    var metricOff = severity === 'r' || severity === 'a';

    if (metricOff && hasOff && pnlIsWorse) return 'leak';
    if (metricOff && hasOff && !pnlIsWorse) return 'monitor';
    if (!metricOff && hasOn && ppOn != null && ppOn < -minGap) return 'play-problem';
    return 'silent';
  }

  function escapeHtml(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  var SEV_WORDS = { g: 'Good', r: 'Leak', a: 'Warning', n: 'Note', o: 'Info' };

  var EXAMPLE_LOOKUP = {};

  function renderExampleButtons(finding) {
    if (!finding.examples || !finding.examples.length) return '';
    var parts = [];
    for (var i = 0; i < finding.examples.length; i++) {
      var ex = finding.examples[i];
      if (!ex || !ex.hands || !ex.hands.length) continue;
      var id = 'sx-' + Math.random().toString(36).slice(2, 9);
      EXAMPLE_LOOKUP[id] = ex;
      var label = escapeHtml(ex.label || 'See example hands');
      var count = ex.hands.length;
      parts.push(
        '<button class="example-hand-btn" data-ex="' + id + '">' +
          escapeHtml(label) + ' (' + count + ')' +
        '</button>'
      );
    }
    if (!parts.length) return '';
    return '<div class="story-examples">' + parts.join('') + '</div>';
  }

  function wireExampleButtons(root) {
    if (!root) return;
    var btns = root.querySelectorAll('button[data-ex]');
    for (var i = 0; i < btns.length; i++) {
      (function(btn) {
        var id = btn.getAttribute('data-ex');
        if (!id || btn._wired) return;
        btn._wired = true;
        btn.onclick = function(e) {
          if (e && e.stopPropagation) e.stopPropagation();
          var ex = EXAMPLE_LOOKUP[id];
          if (!ex || typeof showExampleHandListModal !== 'function') return;
          showExampleHandListModal(ex.label || 'Example hands', ex.hands, ex.coachingNote || null);
        };
      })(btns[i]);
    }
  }

  function wireCardToggles(root) {
    if (!root) return;
    var cards = root.querySelectorAll('.story-card');
    for (var i = 0; i < cards.length; i++) {
      (function(card) {
        if (card._wired) return;
        card._wired = true;
        var head = card.querySelector('.story-card-head');
        if (!head) return;
        head.onclick = function() {
          card.classList.toggle('is-collapsed');
          var id = card.getAttribute('data-story-id');
          if (id) {
            var key = 'story-open:' + id;
            if (card.classList.contains('is-collapsed')) removeSession(key);
            else setSession(key, '1');
          }
        };
      })(cards[i]);
    }
  }

  function buildTeaser(finding) {
    var TEASER_MAX = 110;
    var raw = '';
    if (finding.branchTexts && finding.branchTexts.length) {
      raw = finding.branchTexts[0];
    } else if (finding.impactText) {
      raw = finding.impactText;
    } else if (finding.soWhatText) {
      raw = finding.soWhatText;
    }
    raw = (raw || '').replace(/\s+/g, ' ').trim();
    if (raw.length <= TEASER_MAX) return raw;
    return raw.slice(0, TEASER_MAX - 1).replace(/[\s,;:.-]+$/, '') + '…';
  }

  function synthesiseVerdict(findings, fallback) {
    if (!findings || !findings.length) {
      return fallback || 'Nothing notable in this panel yet. Keep playing to surface more patterns.';
    }
    var pick = findings[0];
    for (var i = 1; i < findings.length; i++) {
      if ((findings[i].score || 0) > (pick.score || 0)) pick = findings[i];
    }
    var sentence = pick.openingText || pick.impactText || pick.soWhatText || pick.name || '';
    sentence = (sentence || '').replace(/\s+/g, ' ').trim();
    return sentence || (pick.name || '');
  }

  function renderVerdict(findings, fallback) {
    var text = synthesiseVerdict(findings, fallback);
    if (!text) return '';
    return '<div class="panel-verdict">' + escapeHtml(text) + '</div>';
  }

  function renderStoryCard(finding) {
    if (!finding) return '';
    var sev = finding.severity || 'n';
    var name = escapeHtml(finding.name || finding.id || 'Story');
    var sevWord = SEV_WORDS[sev] || 'Note';
    var storyId = finding.sectionId ? (finding.sectionId + ':' + (finding.id || finding.name || '')) : (finding.id || finding.name || '');
    var teaser = buildTeaser(finding);

    var isOpen = storyId ? getSession('story-open:' + storyId, null) === '1' : false;
    var classes = 'ins story-card story-card-' + sev + (isOpen ? '' : ' is-collapsed');

    var html = '<div class="' + classes + '" data-story-id="' + escapeHtml(storyId) + '">';
    html += '<div class="story-card-head">';
    html += '<div class="ins-badge ' + sev + '"><div class="ins-dot"></div><div class="ins-word">' + sevWord + '</div></div>';
    html += '<div class="ins-label">' + name + '</div>';
    if (teaser) html += '<div class="story-teaser">' + escapeHtml(teaser) + '</div>';
    html += '<div class="story-card-chev">&#9662;</div>';
    html += '</div>';

    html += '<div class="story-body">';
    if (finding.openingText) {
      html += '<div class="ins-text">' + escapeHtml(finding.openingText) + '</div>';
    }
    if (finding.branchTexts && finding.branchTexts.length) {
      html += '<ul class="story-branches">';
      for (var i = 0; i < finding.branchTexts.length; i++) {
        html += '<li>' + escapeHtml(finding.branchTexts[i]) + '</li>';
      }
      html += '</ul>';
    }
    if (finding.impactText) {
      html += '<div class="story-impact"><span class="story-tag">Impact</span> ' + escapeHtml(finding.impactText) + '</div>';
    }
    if (finding.soWhatText) {
      html += '<div class="story-sowhat"><span class="story-tag">So what</span> ' + escapeHtml(finding.soWhatText) + '</div>';
    }
    html += renderExampleButtons(finding);
    html += '</div>';

    html += '</div>';
    return html;
  }

  function renderFindings(findings) {
    if (!findings || !findings.length) return '';
    var parts = [];
    for (var i = 0; i < findings.length; i++) parts.push(renderStoryCard(findings[i]));
    var html = '<div class="story-grid">' + parts.join('') + '</div>';
    setTimeout(function() {
      var nodes = document.querySelectorAll('.story-grid');
      for (var i = 0; i < nodes.length; i++) {
        wireExampleButtons(nodes[i]);
        wireCardToggles(nodes[i]);
      }
    }, 0);
    return html;
  }

  window.Sections = {
    defineSection: defineSection,
    evaluateSections: evaluateSections,
    findingsForPanel: findingsForPanel,
    classify: classify,
    combineSeverity: combineSeverity,
    classifyPnlGate: classifyPnlGate,
    dominantSeatsCount: dominantSeatsCount,
    fmtPct: fmtPct,
    fmtBand: fmtBand,
    score: score,
    renderStoryCard: renderStoryCard,
    renderFindings: renderFindings,
    renderVerdict: renderVerdict,
    synthesiseVerdict: synthesiseVerdict,
    _sections: SECTIONS
  };
})();
