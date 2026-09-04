// Render a structured action (v2 object) or legacy-parsed action into readable
// text. parseActions() normalises both formats to the same {type, amount, ...}
// shape, so this single path covers v1 strings and v2 objects alike.
function describeAction(a, hand) {
  function amt(v) {
    return fmtBB(v || 0, getHandBB(hand));
  }
  switch (a.type) {
    case "sb":
      return "posted small blind " + amt(a.amount);
    case "bb":
      return "posted big blind " + amt(a.amount);
    case "fold":
      return "folded";
    case "check":
      return "checked";
    case "call":
      return "called " + amt(a.amount);
    case "bet":
      // A short all-in can arrive with no usable amount (Torn logs it as $0);
      // fall back to the plain shove text rather than "bet $0".
      if (a.allIn && !a.amount) return "moved all in";
      return "bet " + amt(a.amount) + (a.allIn ? " (all in)" : "");
    case "raise":
      if (a.allIn && !a.raiseTo && !a.amount) return "moved all in";
      if (typeof a.raiseTo === "number" && a.raiseTo) {
        return "raised to " + amt(a.raiseTo) + (a.allIn ? " (all in)" : "");
      }
      return "raised " + amt(a.amount) + (a.allIn ? " (all in)" : "");
    case "won":
      return "won " + amt(a.amount);
    default:
      return a.msg || a.type || "";
  }
}

// Action replay: each street is its own .section headed by a .section-head
// ("Turn 3♥" — street name plus the dealt card(s) as coloured suit symbols),
// with that street's action lines grouped in a single list block below it.
function buildModalActionLines(hand) {
  var acts = parseActions(hand.actions) || [];
  var board = (hand.board || []).map(normCard);
  var streetBoard = { Flop: board.slice(0, 3), Turn: board.slice(3, 4), River: board.slice(4, 5) };
  var html = "";
  var lastStreet = null;
  var open = false;
  for (var i = 0; i < acts.length; i++) {
    var a = acts[i];
    if (!a || !a.type) continue;
    if (a.street && a.street !== lastStreet) {
      lastStreet = a.street;
      if (open) html += "</div></div>";
      var bc = streetBoard[a.street] || [];
      html += '<div class="inner-section">' + '<div class="section-head">' + a.street + (bc.length ? " " + displayCards(bc) : "") + "</div>" + '<div class="list">';
      open = true;
    } else if (!open) {
      // Actions with no street marker before the first street: headerless section.
      html += '<div class="inner-section"><div class="list">';
      open = true;
    }
    var isMe = !!a.isMe;
    html += '<div class="text-meta' + (isMe ? " c-gold" : "") + '">' + (isMe ? "▸ " : "  ") + (a.author || "?") + ": " + describeAction(a, hand) + "</div>";
  }
  if (open) html += "</div></div>";
  return html;
}

// Showdown block: how the hand ended. Lists each player who turned their cards
// over (cards + the hand they made) and, below, who won the pot with what.
// Hero is listed first. Renders nothing when nobody revealed.
function buildShowdownBlock(hand) {
  var revs = (typeof getRevealedHands === "function" ? getRevealedHands(hand) : []).slice();
  if (!revs.length) return "";
  var bb = getHandBB(hand);
  revs.sort(function (a, b) {
    return (b && b.isMe ? 1 : 0) - (a && a.isMe ? 1 : 0);
  });
  var rows = revs
    .map(function (r) {
      var name = r.isMe ? "You" : r.author || "?";
      return (
        '<div class="reveal-row">' +
        '<span class="text-meta' +
        (r.isMe ? " c-gold" : "") +
        '">' +
        name +
        "</span>" +
        '<span class="reveal-cards">' +
        displayCards(r.hole.map(normCard)) +
        "</span>" +
        '<span class="text-meta c-dim reveal-hand">' +
        (r.handName || "") +
        "</span>" +
        "</div>"
      );
    })
    .join("");

  var winnerHtml = "";
  var winners = typeof getHandWinners === "function" ? getHandWinners(hand) : [];
  for (var w = 0; w < winners.length; w++) {
    var win = winners[w];
    var wname = win.isMe ? "You" : win.author || "?";
    winnerHtml +=
      '<div class="text-body' +
      (win.isMe ? " c-pos" : "") +
      '">' +
      wname +
      " won " +
      '<strong class="c-gold">' +
      fmtBB(win.winnings, bb) +
      "</strong>" +
      (win.handName ? " with " + win.handName : "") +
      "</div>";
  }

  return '<div class="inner-section">' + '<div class="section-head">Showdown</div>' + '<div class="reveals-grid">' + rows + "</div>" + winnerHtml + "</div>";
}

// Per-player "stack before -> after" block for the hand-replay modal.
// Renders only when hand.stacks has entries. Every value is guarded: absent
// stacks show as an em dash, never as 0. Hero is listed first, then others in
// their given order.
function buildStacksBlock(hand) {
  if (!hand || !hand.stacks || !hand.stacks.length) return "";
  var bb = getHandBB(hand);
  var players = hand.stacks.slice();
  players.sort(function (a, b) {
    return (b && b.isHero ? 1 : 0) - (a && a.isHero ? 1 : 0);
  });
  var rows = players
    .map(function (p) {
      if (!p) return "";
      var name = p.name || (p.isHero ? "You" : "?");
      if (p.isHero) name = "You";
      var start = p.startStack != null ? fmtBB(p.startStack, bb) : "—";
      var end = p.endStack != null ? fmtBB(p.endStack, bb) : "—";
      var netHtml = "";
      if (p.profit != null) {
        netHtml = '<span class="' + pnlValCls(p.profit) + '">' + fmtPnlBB(p.profit, bb) + "</span>";
      }
      return (
        "<div>" +
        '<span class="text-meta' +
        (p.isHero ? " c-gold" : "") +
        '">' +
        name +
        "</span>" +
        '<span class="text-meta stack-start">' +
        start +
        "</span>" +
        '<span class="text-meta c-dim stack-arrow">&rarr;</span>' +
        '<span class="text-meta">' +
        end +
        "</span>" +
        '<span class="text-meta stack-net">' +
        netHtml +
        "</span>" +
        "</div>"
      );
    })
    .join("");
  return '<div class="inner-section">' + '<div class="section-head">Stacks (before &rarr; after)</div>' + '<div class="stacks-grid">' + rows + "</div>" + "</div>";
}

// Plain-text hand history for the "copy" export. Mirrors the modal's structure
// (header, board/pot/result, stacks, action-by-street, showdown) but emits
// readable text lines rather than DOM. Suit glyphs stay as Unicode (A♠), which
// paste cleanly into Discord/forums.
function buildHandReplayText(hand) {
  if (!hand) return "";
  var bb = getHandBB(hand);
  function cards(cs) {
    return cs && cs.length ? cs.map(normCard).join(" ") : "";
  }
  var lines = [];

  var hole = hand.hole && hand.hole.length ? cards(hand.hole) : "??";
  lines.push(hole + "  ·  " + (hand.position || "?") + " position");

  lines.push("Board: " + (hand.board && hand.board.length ? cards(hand.board) : "none"));
  lines.push("Pot: " + fmtBB(hand.pot || 0, bb));
  var pnl = getHandPnl(hand);
  var res = hand.outcome ? hand.outcome.result : "?";
  var resultLabel = res;
  if (res === "folded" && pnl.text !== "folded") resultLabel = "folded " + pnl.text;
  else if (res === "won") resultLabel = "won " + pnl.text;
  else if (res === "lost") resultLabel = "lost " + pnl.text;
  lines.push("Result: " + resultLabel);

  if (hand.stacks && hand.stacks.length) {
    var players = hand.stacks.slice();
    players.sort(function (a, b) {
      return (b && b.isHero ? 1 : 0) - (a && a.isHero ? 1 : 0);
    });
    lines.push("");
    lines.push("Stacks (before -> after)");
    players.forEach(function (p) {
      if (!p) return;
      var name = p.isHero ? "You" : p.name || "?";
      var start = p.startStack != null ? fmtBB(p.startStack, bb) : "-";
      var end = p.endStack != null ? fmtBB(p.endStack, bb) : "-";
      var net = p.profit != null ? "  (" + fmtPnlBB(p.profit, bb) + ")" : "";
      lines.push("  " + name + ": " + start + " -> " + end + net);
    });
  }

  var acts = parseActions(hand.actions) || [];
  var board = (hand.board || []).map(normCard);
  var streetBoard = { Flop: board.slice(0, 3), Turn: board.slice(3, 4), River: board.slice(4, 5) };
  var lastStreet = null;
  for (var i = 0; i < acts.length; i++) {
    var a = acts[i];
    if (!a || !a.type) continue;
    if (a.street && a.street !== lastStreet) {
      lastStreet = a.street;
      var bc = streetBoard[a.street] || [];
      lines.push("");
      lines.push(a.street + (bc.length ? " " + cards(bc) : ""));
    }
    var who = a.isMe ? "You" : a.author || "?";
    lines.push((a.isMe ? "> " : "  ") + who + ": " + describeAction(a, hand));
  }

  var revs = (typeof getRevealedHands === "function" ? getRevealedHands(hand) : []).slice();
  if (revs.length) {
    revs.sort(function (a, b) {
      return (b && b.isMe ? 1 : 0) - (a && a.isMe ? 1 : 0);
    });
    lines.push("");
    lines.push("Showdown");
    revs.forEach(function (r) {
      var name = r.isMe ? "You" : r.author || "?";
      lines.push("  " + name + ": " + cards(r.hole) + (r.handName ? "  (" + r.handName + ")" : ""));
    });
    var winners = typeof getHandWinners === "function" ? getHandWinners(hand) : [];
    winners.forEach(function (win) {
      var wname = win.isMe ? "You" : win.author || "?";
      lines.push("  " + wname + " won " + fmtBB(win.winnings, bb) + (win.handName ? " with " + win.handName : ""));
    });
  }

  return lines.join("\n");
}

// Copy text to the clipboard. Prefers the async Clipboard API; falls back to a
// hidden-textarea execCommand for insecure contexts or browsers that block it.
// cb(ok) reports success so the caller can flash button feedback.
function copyTextToClipboard(text, cb) {
  function fallback() {
    try {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      var ok = document.execCommand("copy");
      document.body.removeChild(ta);
      cb(!!ok);
    } catch (e) {
      cb(false);
    }
  }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(function () {
      cb(true);
    }, fallback);
  } else {
    fallback();
  }
}

function createExampleModal() {
  var existing = document.getElementById("example-hand-modal");
  if (existing) existing.remove();

  var overlay = document.createElement("div");
  overlay.id = "example-hand-modal";
  overlay.className = "overlay";
  overlay.onclick = function (e) {
    if (e.target === overlay) closeModal();
  };

  var box = document.createElement("div");
  box.className = "modal";

  return { overlay: overlay, box: box };
}

function mountExampleModal(overlay, box) {
  overlay.appendChild(box);
  document.body.appendChild(overlay);
  requestAnimationFrame(function () {
    overlay.classList.add(CSS.SHOW);
  });
  document.getElementById("modal-close-btn").onclick = closeModal;
}

function showExampleHandModal(hand, coachingNote, opponentName) {
  var modal = createExampleModal();
  var overlay = modal.overlay;
  var box = modal.box;

  if (typeof annotateHandDynamics === "function") annotateHandDynamics(hand);

  // Opponent examples describe the named player, so the header must show their
  // cards/seat/result, not the hero's. Their cards only exist if they showed down.
  var forOpp = opponentName != null;
  var headHoleCards = forOpp ? getRevealedHoleByName(hand, opponentName) : (hand.hole && hand.hole.length ? hand.hole : null);
  var headPos = forOpp ? getPositionByName(hand, opponentName) : hand.position;

  var closeBtn = '<button class="modal-close" id="modal-close-btn">&times;</button>';
  var copyBtn = '<button class="btn btn-icon modal-copy-btn" id="modal-copy-btn" title="Copy hand history">&#10697;</button>';
  var pngBtn = '<button class="btn btn-icon modal-png-btn" id="modal-png-btn" title="Export as PNG">&#8681;</button>';
  var tagStrip = handTagsHtml(hand);
  var header =
    '<div class="panel-header">' +
    '<div class="title title-lg c-gold">' +
    (headHoleCards && headHoleCards.length ? displayCards(headHoleCards.map(normCard)) : "??") +
    "</div>" +
    '<div class="eyebrow">Example hand · ' +
    (headPos || "?") +
    " position" +
    (forOpp ? " · " + opponentName + "'s hand" : "") +
    (tagStrip ? " · " + tagStrip : "") +
    "</div>" +
    "</div>";

  var metaHtml =
    '<div class="head">' +
    '<span class="text-meta">Board: ' +
    (hand.board && hand.board.length ? displayCards(hand.board.map(normCard)) : "none") +
    "</span>" +
    '<span class="text-meta">Pot: <strong class="c-gold">' +
    fmtBB(hand.pot || 0, getHandBB(hand)) +
    "</strong></span>" +
    (function () {
      if (forOpp) {
        var v = getStackPnlByName(hand, opponentName);
        var bb = getHandBB(hand);
        var money = function (x) { return (_displayBB && bb > 0) ? fmtBBRaw(x / bb) : fmt(x); };
        var lbl, cls;
        if (v == null) { lbl = "&mdash;"; cls = "c-muted"; }
        else if (v > 0) { lbl = "won +" + money(v); cls = "c-pos"; }
        else if (v < 0) { lbl = "lost -" + money(Math.abs(v)); cls = "c-neg"; }
        else { lbl = "even"; cls = "c-muted"; }
        return '<span class="text-meta">Result: <strong class="' + cls + '">' + lbl + "</strong></span>";
      }
      var pnl = getHandPnl(hand);
      var res = hand.outcome ? hand.outcome.result : "?";
      var label = res;
      if (res === "folded" && pnl.text !== "folded") label = "folded " + pnl.text;
      else if (res === "won") label = "won " + pnl.text;
      else if (res === "lost") label = "lost " + pnl.text;
      return '<span class="text-meta">Result: <strong class="' + pnl.cls + '">' + label + "</strong></span>";
    })() +
    "</div>";

  var stacksHtml = buildStacksBlock(hand);

  var actionsHtml = buildModalActionLines(hand) + buildShowdownBlock(hand);

  var coaching = coachingNote
    ? '<div class="inner-section">' + '<div class="section-head c-warn">What to improve</div>' + '<div class="card card-s2"><div class="text-body">' + coachingNote + "</div></div>" + "</div>"
    : "";

  var starred = isHandStarred(hand);
  var starBtn =
    '<button class="btn btn-icon modal-star-btn' +
    (starred ? " starred" : "") +
    '" id="modal-star-btn" title="' +
    (starred ? "Unsave hand" : "Save hand") +
    '">' +
    (starred ? "&#9733;" : "&#9734;") +
    "</button>";

  var noteVal = getHandNote(hand).replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  var notesSection =
    '<div class="modal-notes' +
    (starred ? " show" : "") +
    '" id="modal-notes">' +
    '<div class="head">' +
    '<div class="eyebrow">Your Notes</div>' +
    '<div class="text-meta modal-notes-status" id="modal-notes-status">Saves automatically</div>' +
    "</div>" +
    '<textarea id="modal-notes-input" placeholder="Add notes about this hand...">' +
    noteVal +
    "</textarea>" +
    "</div>";

  var equitySlot = '<div class="eq-slot" id="equity-slot"></div>';
  box.innerHTML = closeBtn + pngBtn + copyBtn + starBtn + header + metaHtml + stacksHtml + equitySlot + actionsHtml + coaching + notesSection;
  mountExampleModal(overlay, box);

  if (typeof injectEquityButton === "function") {
    injectEquityButton(box, hand);
  }

  var copyEl = document.getElementById("modal-copy-btn");
  if (copyEl) {
    copyEl.onclick = function () {
      var btn = this;
      copyTextToClipboard(buildHandReplayText(hand), function (ok) {
        btn.innerHTML = ok ? "&#10003;" : "&#10007;";
        btn.classList.toggle("copied", ok);
        btn.title = ok ? "Copied" : "Copy failed";
        setTimeout(function () {
          btn.innerHTML = "&#10697;";
          btn.classList.remove("copied");
          btn.title = "Copy hand history";
        }, 1400);
      });
    };
  }

  var pngEl = document.getElementById("modal-png-btn");
  if (pngEl && typeof exportHandShareCardPng === "function") {
    pngEl.onclick = function () {
      var btn = this;
      if (btn.classList.contains("busy")) return;
      btn.classList.add("busy");
      btn.title = "Rendering...";
      exportHandShareCardPng(hand, function (ok) {
        btn.classList.remove("busy");
        btn.innerHTML = ok ? "&#10003;" : "&#10007;";
        btn.classList.toggle("copied", ok);
        btn.title = ok ? "Saved PNG" : "Export failed";
        setTimeout(function () {
          btn.innerHTML = "&#8681;";
          btn.classList.remove("copied");
          btn.title = "Export as PNG";
        }, 1400);
      });
    };
  }

  document.getElementById("modal-star-btn").onclick = function () {
    var nowStarred = toggleStarHand(hand);
    this.innerHTML = nowStarred ? "&#9733;" : "&#9734;";
    this.classList.toggle(CSS.STARRED, nowStarred);
    this.title = nowStarred ? "Unsave hand" : "Save hand";
    var notesEl = document.getElementById("modal-notes");
    if (notesEl) notesEl.classList.toggle(CSS.SHOW, nowStarred);
    renderSavedHands();
  };

  var notesInput = document.getElementById("modal-notes-input");
  if (notesInput) {
    var debounceTimer;
    notesInput.oninput = function () {
      var val = this.value;
      var statusEl = document.getElementById("modal-notes-status");
      if (statusEl) {
        statusEl.textContent = "Saving...";
        statusEl.style.color = "var(--dim)";
      }
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(function () {
        setHandNote(hand, val);
        if (statusEl) {
          statusEl.textContent = "Saved";
          statusEl.style.color = "var(--green)";
        }
        setTimeout(function () {
          if (statusEl) {
            statusEl.textContent = "Saves automatically";
            statusEl.style.color = "var(--muted)";
          }
        }, 1500);
        renderSavedHands();
      }, 300);
    };
  }
}

function closeModal() {
  var m = document.getElementById("example-hand-modal");
  if (m) {
    m.classList.remove(CSS.SHOW);
    setTimeout(function () {
      m.remove();
    }, 200);
  }
}

function findExampleHand(filterFn) {
  var results = [];
  for (var i = State.modalHands.length - 1; i >= 0; i--) {
    if (filterFn(State.modalHands[i])) results.push(State.modalHands[i]);
  }
  return results;
}

// The one hand-row used by every panel's example-hands modal. .hand-row owns
// its whole layout in CSS (a grid); each child carries a single class.
// opponentName != null renders the row from that opponent's perspective (their
// seat, their revealed cards, their chip swing, their action line) rather than
// the hero's. Used by the per-opponent tendency examples, where showing the
// hero's cards/result beside "they entered the pot" was the wrong player's data.
function buildHandRow(h, idx, opponentName) {
  var pos, holeHtml, resultHtml, actsHtml;
  if (opponentName != null) {
    var oppHole = getRevealedHoleByName(h, opponentName);
    pos = getPositionByName(h, opponentName) || "?";
    // Their cards only exist if they showed down; never fabricate a holding.
    holeHtml = oppHole && oppHole.length ? displayCards(oppHole.map(normCard)) : "??";
    resultHtml = renderPnlValueCell(getStackPnlByName(h, opponentName), h, "span", "hand-row-result");
    actsHtml = getActsSummaryByName(h, opponentName);
  } else {
    pos = h.position || "?";
    holeHtml = h.hole && h.hole.length ? displayCards(h.hole.map(normCard)) : "??";
    resultHtml = renderResult(h, "span", "hand-row-result");
    actsHtml = getActsSummary(h);
  }
  return (
    '<div class="hand-row" data-ridx="' +
    idx +
    '">' +
    '<span class="hand-row-pos">' +
    pos +
    "</span>" +
    '<span class="hand-row-hole">' +
    holeHtml +
    "</span>" +
    '<span class="hand-row-board">' +
    (h.board && h.board.length ? displayCards(h.board.map(normCard)) : "-") +
    "</span>" +
    resultHtml +
    '<span class="hand-row-acts">' +
    actsHtml +
    "</span>" +
    "</div>"
  );
}

function showExampleHandListModal(title, handsList, coachingNote, opponentName) {
  var BATCH = 10;
  var shown = 0;

  var modal = createExampleModal();
  var overlay = modal.overlay;
  var box = modal.box;

  var header =
    '<div class="panel-header">' +
    '<div class="title title-lg c-gold">' +
    title +
    "</div>" +
    '<div class="text-meta">' +
    handsList.length +
    " example hand" +
    (handsList.length !== 1 ? "s" : "") +
    "</div>" +
    "</div>";

  if (coachingNote) {
    header +=
      '<div class="inner-section">' + '<div class="section-head c-warn">What to look for</div>' + '<div class="card card-s2"><div class="text-body">' + coachingNote + "</div></div>" + "</div>";
  }

  box.innerHTML = '<button class="modal-close" id="modal-close-btn">&times;</button>' + header + '<div id="hand-list-rows"></div>';

  var rowsContainer = box.querySelector("#hand-list-rows");

  function wireRow(row) {
    row.onclick = function () {
      var idx = parseInt(row.getAttribute("data-ridx"));
      if (!isNaN(idx) && handsList[idx]) showExampleHandModal(handsList[idx], coachingNote, opponentName);
    };
  }

  function loadBatch() {
    var end = Math.min(shown + BATCH, handsList.length);
    for (var i = shown; i < end; i++) {
      var tmp = document.createElement("div");
      tmp.innerHTML = buildHandRow(handsList[i], i, opponentName);
      var row = tmp.firstChild;
      wireRow(row);
      rowsContainer.appendChild(row);
    }
    shown = end;
    updateLoadMore();
  }

  function updateLoadMore() {
    var existing = box.querySelector("#load-more-btn");
    if (existing) existing.remove();
    var remaining = handsList.length - shown;
    if (remaining > 0) {
      var btn = document.createElement("button");
      btn.id = "load-more-btn";
      btn.className = "btn btn-ghost";
      btn.textContent = "Load more (" + remaining + " remaining)";
      btn.onclick = loadBatch;
      rowsContainer.parentNode.appendChild(btn);
    }
  }

  mountExampleModal(overlay, box);

  loadBatch();
}
