// Purpose-built share card for a single hand, drawn directly to a <canvas> with
// the 2D API (no html2canvas / CDN dependency). Fixed 1080px width, rendered at
// 2x for a crisp retina PNG; height grows to fit the action list. Palette/fonts
// mirror the app's design tokens.
//
// Public: renderHandShareCard(hand) -> Promise<HTMLCanvasElement>
//         exportHandShareCardPng(hand, onDone) -> downloads the PNG.

var SHARE_CARD = {
  W: 1080,
  SCALE: 2,
  PAD: 60,
  // vertical rhythm for the action list (measure and draw must agree)
  LINE_H: 36,
  STREET_H: 54,
  BLOCK_GAP: 14,
  col: {
    bg1: "#0d150e",
    bg2: "#070a08",
    felt: "rgba(63, 120, 80, 0.14)",
    gold: "#c8a94a",
    gold2: "#8a7030",
    text: "#d0d8d0",
    dim: "#7a9a7a",
    muted: "#5a7a5c",
    green: "#3fad64",
    red: "#c94040",
    faceBg: "#f5f2e9",
    faceEdge: "#cfc9b8",
    ink: "#1a1f1a",
    inkRed: "#c23b3b",
    backBg: "#16231a",
    backEdge: "#2a3e2c",
  },
  serif: "'Cormorant Garamond', Georgia, serif",
  mono: "'IBM Plex Mono', ui-monospace, monospace",
  sans: "'Helvetica Neue', Arial, sans-serif",
};

// Rounded-rect subpath. Uses native ctx.roundRect where available.
function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(x, y, w, h, r);
    return;
  }
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Rank + suit metadata for a card string, tolerating both letter suits ("Th")
// and glyph suits ("T♥"). Mirrors displayCard()'s resolution.
function shareCardParts(cardStr) {
  var c = normCard(cardStr || "");
  if (!c || c.length < 2) return null;
  var suitChar = c.slice(-1);
  var code = SUIT_TO_CODE[suitChar] || suitChar; // glyph -> h/d/c/s, letter stays
  var symbol = SUIT_LETTER[code] || suitChar; // h/d/c/s -> glyph
  var rank = c.slice(0, -1);
  if (rank === "T") rank = "10";
  return { rank: rank, symbol: symbol, red: code === "h" || code === "d" };
}

// Compact "rank+glyph" list for a set of board/hole cards, e.g. "2♦ 8♦ 3♥".
function shareCardsInline(cards) {
  return (cards || [])
    .map(function (c) {
      var p = shareCardParts(c);
      return p ? p.rank + p.symbol : "";
    })
    .filter(Boolean)
    .join(" ");
}

// One playing card. cardStr null/"??" draws a face-down back.
function drawShareCard(ctx, x, y, w, h, cardStr) {
  var col = SHARE_CARD.col;
  var r = w * 0.11;
  var parts = shareCardParts(cardStr);

  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.45)";
  ctx.shadowBlur = w * 0.12;
  ctx.shadowOffsetY = h * 0.03;
  roundRectPath(ctx, x, y, w, h, r);
  ctx.fillStyle = parts ? col.faceBg : col.backBg;
  ctx.fill();
  ctx.restore();

  ctx.save();
  roundRectPath(ctx, x, y, w, h, r);
  ctx.lineWidth = Math.max(1, w * 0.012);
  ctx.strokeStyle = parts ? col.faceEdge : col.backEdge;
  ctx.stroke();

  if (!parts) {
    ctx.clip();
    ctx.fillStyle = "rgba(200, 169, 74, 0.16)";
    ctx.font = "700 " + h * 0.42 + "px " + SHARE_CARD.sans;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("♠", x + w / 2, y + h / 2);
    ctx.restore();
    return;
  }

  var ink = parts.red ? col.inkRed : col.ink;
  ctx.fillStyle = ink;

  var pad = w * 0.14;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.font = "700 " + h * 0.22 + "px " + SHARE_CARD.sans;
  ctx.fillText(parts.rank, x + pad, y + pad * 0.7);
  ctx.font = "700 " + h * 0.16 + "px " + SHARE_CARD.sans;
  ctx.fillText(parts.symbol, x + pad, y + pad * 0.7 + h * 0.22);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "700 " + h * 0.46 + "px " + SHARE_CARD.sans;
  ctx.fillText(parts.symbol, x + w / 2, y + h * 0.58);

  ctx.restore();
}

// Center a row of `count` cards of width cw (gap g) within [x0, x0+avail].
function shareRowStart(x0, avail, count, cw, g) {
  var total = count * cw + (count - 1) * g;
  return x0 + (avail - total) / 2;
}

function shareText(ctx, text, x, y, font, color, align, baseline, spacing) {
  ctx.save();
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = align || "left";
  ctx.textBaseline = baseline || "alphabetic";
  if (spacing != null && "letterSpacing" in ctx) ctx.letterSpacing = spacing + "px";
  ctx.fillText(text, x, y);
  ctx.restore();
}

// Structured action list grouped by street (same grouping as the modal/text
// export): [{street, board:[cards], lines:[{who, text, isMe}]}].
function shareActionBlocks(hand) {
  var acts = parseActions(hand.actions) || [];
  var board = (hand.board || []).map(normCard);
  var streetBoard = { Flop: board.slice(0, 3), Turn: board.slice(3, 4), River: board.slice(4, 5) };
  var blocks = [];
  var cur = null;
  var lastStreet = null;
  for (var i = 0; i < acts.length; i++) {
    var a = acts[i];
    if (!a || !a.type) continue;
    if (a.street && a.street !== lastStreet) {
      lastStreet = a.street;
      cur = { street: a.street, board: streetBoard[a.street] || [], lines: [] };
      blocks.push(cur);
    } else if (!cur) {
      cur = { street: "Action", board: [], lines: [] };
      blocks.push(cur);
    }
    cur.lines.push({ who: a.isMe ? "You" : a.author || "?", text: describeAction(a, hand), isMe: !!a.isMe });
  }
  return blocks;
}

// Showdown reveals + winners for the action list tail.
function shareShowdown(hand) {
  var bb = getHandBB(hand);
  var revs = (typeof getRevealedHands === "function" ? getRevealedHands(hand) : []).slice();
  revs.sort(function (a, b) {
    return (b && b.isMe ? 1 : 0) - (a && a.isMe ? 1 : 0);
  });
  var reveals = revs.map(function (r) {
    return { name: r.isMe ? "You" : r.author || "?", hole: (r.hole || []).map(normCard), handName: r.handName || "", isMe: !!r.isMe };
  });
  var wins = typeof getHandWinners === "function" ? getHandWinners(hand) : [];
  var winners = wins.map(function (w) {
    return { name: w.isMe ? "You" : w.author || "?", amount: fmtBB(w.winnings, bb), handName: w.handName || "" };
  });
  return { reveals: reveals, winners: winners };
}

function renderHandShareCard(hand) {
  function draw() {
    var S = SHARE_CARD.SCALE;
    var W = SHARE_CARD.W;
    var col = SHARE_CARD.col;
    var pad = SHARE_CARD.PAD;
    var LINE_H = SHARE_CARD.LINE_H;
    var STREET_H = SHARE_CARD.STREET_H;
    var BLOCK_GAP = SHARE_CARD.BLOCK_GAP;
    var contentW = W - pad * 2;
    var bb = getHandBB(hand);

    var blocks = shareActionBlocks(hand);
    var showdown = shareShowdown(hand);

    // --- fixed top region y-coordinates ---
    var yHoleCards = 200;
    var hcW = 116,
      hcH = 162,
      hcGap = 22;
    var yBoardLabel = yHoleCards + hcH + 46;
    var bcW = 84,
      bcH = 118,
      bcGap = 15;
    var yBoardCards = yBoardLabel + 22;
    var board = (hand.board || []).filter(Boolean);
    var boardBottom = board.length ? yBoardCards + bcH : yHoleCards + hcH;
    var yResultWord = boardBottom + 66;
    var yResultAmt = yResultWord + 60;
    var yResultCtx = yResultAmt + 40;
    var yActionsStart = yResultCtx + 60;

    // --- measure action list to get total height ---
    var actH = 0;
    blocks.forEach(function (b) {
      actH += STREET_H + b.lines.length * LINE_H + BLOCK_GAP;
    });
    var shLines = showdown.reveals.length + showdown.winners.length;
    var shH = shLines ? STREET_H + shLines * LINE_H + BLOCK_GAP : 0;
    var footerH = 82;
    var H = Math.round(yActionsStart + actH + shH + footerH);

    var canvas = document.createElement("canvas");
    canvas.width = W * S;
    canvas.height = H * S;
    var ctx = canvas.getContext("2d");
    ctx.scale(S, S);

    // background
    var grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, col.bg1);
    grad.addColorStop(1, col.bg2);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    var glow = ctx.createRadialGradient(W / 2, H * 0.22, 60, W / 2, H * 0.22, W * 0.75);
    glow.addColorStop(0, col.felt);
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    // inset gold frame
    var inset = 30;
    roundRectPath(ctx, inset, inset, W - inset * 2, H - inset * 2, 22);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = col.gold2;
    ctx.stroke();

    // header
    shareText(ctx, "TC POKER ANALYSIS", pad, 88, "600 24px " + SHARE_CARD.mono, col.gold, "left", "alphabetic", 4);
    var tableName = (typeof TABLE_META !== "undefined" && TABLE_META[hand.tableId] && TABLE_META[hand.tableId].name) || hand.table || "";
    var stakeLabel = tableName + (hand.bigBlind ? (tableName ? "  ·  " : "") + fmt(hand.bigBlind) + " BB" : "");
    if (stakeLabel) shareText(ctx, stakeLabel.toUpperCase(), W - pad, 88, "500 20px " + SHARE_CARD.mono, col.dim, "right", "alphabetic", 2);
    ctx.save();
    ctx.strokeStyle = col.gold2;
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.moveTo(pad, 112);
    ctx.lineTo(W - pad, 112);
    ctx.stroke();
    ctx.restore();

    // hole cards
    shareText(ctx, "HOLE CARDS", W / 2, yHoleCards - 22, "500 20px " + SHARE_CARD.mono, col.muted, "center", "alphabetic", 6);
    var hole = hand.hole && hand.hole.length ? hand.hole : ["??", "??"];
    var hx = shareRowStart(pad, contentW, hole.length, hcW, hcGap);
    for (var i = 0; i < hole.length; i++) {
      drawShareCard(ctx, hx + i * (hcW + hcGap), yHoleCards, hcW, hcH, hole[i]);
    }

    // board
    if (board.length) {
      shareText(ctx, "BOARD", W / 2, yBoardLabel, "500 20px " + SHARE_CARD.mono, col.muted, "center", "alphabetic", 6);
      var bx = shareRowStart(pad, contentW, board.length, bcW, bcGap);
      for (var b2 = 0; b2 < board.length; b2++) {
        drawShareCard(ctx, bx + b2 * (bcW + bcGap), yBoardCards, bcW, bcH, board[b2]);
      }
    }

    // result headline
    var pnl = getHandPnl(hand);
    var res = hand.outcome ? hand.outcome.result : "?";
    var word = res === "won" ? "YOU WON" : res === "lost" ? "YOU LOST" : res === "folded" ? "FOLDED" : String(res).toUpperCase();
    var color = pnl.cls === "c-pos" ? col.green : pnl.cls === "c-neg" ? col.red : col.dim;
    var amount = pnl.text === "folded" ? "FOLDED" : pnl.text;
    shareText(ctx, word, W / 2, yResultWord, "600 22px " + SHARE_CARD.mono, col.dim, "center", "alphabetic", 6);
    shareText(ctx, amount, W / 2, yResultAmt, "600 62px " + SHARE_CARD.serif, color, "center", "alphabetic");
    var ctxBits = [];
    if (hand.position) ctxBits.push(hand.position + " position");
    ctxBits.push("Pot " + fmtBB(hand.pot || 0, bb));
    shareText(ctx, ctxBits.join("   ·   "), W / 2, yResultCtx, "400 24px " + SHARE_CARD.serif, col.dim, "center", "alphabetic");

    // --- action list ---
    var y = yActionsStart;

    function streetHeader(label, sub) {
      ctx.save();
      ctx.strokeStyle = col.gold2;
      ctx.globalAlpha = 0.4;
      ctx.beginPath();
      ctx.moveTo(pad, y + 4);
      ctx.lineTo(W - pad, y + 4);
      ctx.stroke();
      ctx.restore();
      shareText(ctx, String(label).toUpperCase(), pad, y + 40, "600 22px " + SHARE_CARD.mono, col.gold, "left", "alphabetic", 4);
      if (sub) shareText(ctx, sub, W - pad, y + 40, "500 22px " + SHARE_CARD.mono, col.dim, "right", "alphabetic", 1);
      y += STREET_H;
    }

    function actionLine(name, text, isMe, forceColor) {
      var lineColor = forceColor || (isMe ? col.gold : col.text);
      var marker = isMe ? "▸ " : "  ";
      shareText(ctx, marker + name + ": " + text, pad + 2, y + 26, (isMe ? "600 " : "400 ") + "23px " + SHARE_CARD.mono, lineColor, "left", "alphabetic", 0);
      y += LINE_H;
    }

    blocks.forEach(function (blk) {
      streetHeader(blk.street, shareCardsInline(blk.board));
      blk.lines.forEach(function (l) {
        actionLine(l.who, l.text, l.isMe);
      });
      y += BLOCK_GAP;
    });

    if (shLines) {
      streetHeader("Showdown", "");
      showdown.reveals.forEach(function (r) {
        actionLine(r.name, shareCardsInline(r.hole) + (r.handName ? "  (" + r.handName + ")" : ""), r.isMe);
      });
      showdown.winners.forEach(function (w) {
        actionLine(w.name, "won " + w.amount + (w.handName ? " with " + w.handName : ""), false, col.green);
      });
      y += BLOCK_GAP;
    }

    // footer watermark
    shareText(ctx, "TC POKER ANALYSIS", W / 2, H - 42, "500 18px " + SHARE_CARD.mono, col.gold2, "center", "alphabetic", 3);

    return canvas;
  }

  // Ensure the brand webfonts are loaded so canvas text uses them, not a fallback.
  if (document.fonts && document.fonts.ready && document.fonts.load) {
    return Promise.all([document.fonts.load("600 62px 'Cormorant Garamond'"), document.fonts.load("600 24px 'IBM Plex Mono'"), document.fonts.load("400 23px 'IBM Plex Mono'")])
      .catch(function () {})
      .then(function () {
        return document.fonts.ready;
      })
      .catch(function () {})
      .then(draw);
  }
  return Promise.resolve(draw());
}

// Render the card and trigger a PNG download. onDone(ok) reports success.
function exportHandShareCardPng(hand, onDone) {
  onDone = onDone || function () {};
  renderHandShareCard(hand).then(
    function (canvas) {
      function finish(blob) {
        if (!blob) {
          onDone(false);
          return;
        }
        var slug = "hand";
        if (hand.hole && hand.hole.length) {
          slug = hand.hole
            .map(function (c) {
              return normCard(c).replace(/[^A-Za-z0-9]/g, "");
            })
            .join("-");
        }
        var url = URL.createObjectURL(blob);
        var a = document.createElement("a");
        a.href = url;
        a.download = "tc-poker-" + slug + ".png";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function () {
          URL.revokeObjectURL(url);
        }, 1000);
        onDone(true);
      }
      if (canvas.toBlob) canvas.toBlob(finish, "image/png");
      else {
        try {
          var durl = canvas.toDataURL("image/png");
          var a2 = document.createElement("a");
          a2.href = durl;
          a2.download = "tc-poker-hand.png";
          document.body.appendChild(a2);
          a2.click();
          document.body.removeChild(a2);
          onDone(true);
        } catch (e) {
          onDone(false);
        }
      }
    },
    function () {
      onDone(false);
    }
  );
}
