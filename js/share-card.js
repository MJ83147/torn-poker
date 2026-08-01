// Purpose-built share card for a single hand, drawn directly to a <canvas> with
// the 2D API (no html2canvas / CDN dependency). Fixed 1080x1080 layout rendered
// at 2x for a crisp, retina PNG. Palette/fonts mirror the app's design tokens.
//
// Public: renderHandShareCard(hand) -> Promise<HTMLCanvasElement>
//         exportHandShareCardPng(hand, onDone) -> downloads the PNG.

var SHARE_CARD = {
  W: 1080,
  H: 1080,
  SCALE: 2,
  PAD: 56,
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

// One playing card. cardStr null/"??" draws a face-down back.
function drawShareCard(ctx, x, y, w, h, cardStr) {
  var col = SHARE_CARD.col;
  var r = w * 0.11;
  var parts = shareCardParts(cardStr);

  ctx.save();
  // drop shadow
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
    // face-down: a centered gold suit watermark on felt
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

  // top-left rank + suit
  var pad = w * 0.13;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.font = "700 " + h * 0.2 + "px " + SHARE_CARD.sans;
  ctx.fillText(parts.rank, x + pad, y + pad * 0.75);
  ctx.font = "700 " + h * 0.15 + "px " + SHARE_CARD.sans;
  ctx.fillText(parts.symbol, x + pad, y + pad * 0.75 + h * 0.2);

  // large centered suit
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "700 " + h * 0.44 + "px " + SHARE_CARD.sans;
  ctx.fillText(parts.symbol, x + w / 2, y + h * 0.56);

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

function renderHandShareCard(hand) {
  function draw() {
    var S = SHARE_CARD.SCALE;
    var W = SHARE_CARD.W;
    var H = SHARE_CARD.H;
    var col = SHARE_CARD.col;
    var bb = getHandBB(hand);

    var canvas = document.createElement("canvas");
    canvas.width = W * S;
    canvas.height = H * S;
    var ctx = canvas.getContext("2d");
    ctx.scale(S, S);

    // background: vertical gradient + soft felt glow
    var grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, col.bg1);
    grad.addColorStop(1, col.bg2);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    var glow = ctx.createRadialGradient(W / 2, H * 0.38, 60, W / 2, H * 0.38, W * 0.7);
    glow.addColorStop(0, col.felt);
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    // inset gold hairline frame
    var inset = 34;
    roundRectPath(ctx, inset, inset, W - inset * 2, H - inset * 2, 22);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = col.gold2;
    ctx.stroke();

    var pad = SHARE_CARD.PAD;
    var contentW = W - pad * 2;

    // header: wordmark left, table/stakes right
    shareText(ctx, "TC POKER ANALYSIS", pad + 6, 92, "600 24px " + SHARE_CARD.mono, col.gold, "left", "alphabetic", 4);
    var tableName = (typeof TABLE_META !== "undefined" && TABLE_META[hand.tableId] && TABLE_META[hand.tableId].name) || hand.table || "";
    var stakeLabel = tableName + (hand.bigBlind ? (tableName ? "  ·  " : "") + fmt(hand.bigBlind) + " BB" : "");
    if (stakeLabel) shareText(ctx, stakeLabel.toUpperCase(), W - pad - 6, 92, "500 20px " + SHARE_CARD.mono, col.dim, "right", "alphabetic", 2);
    // thin rule under header
    ctx.strokeStyle = col.gold2;
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.moveTo(pad + 6, 118);
    ctx.lineTo(W - pad - 6, 118);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // hero hand
    shareText(ctx, "HOLE CARDS", W / 2, 196, "500 22px " + SHARE_CARD.mono, col.muted, "center", "alphabetic", 6);
    var hole = hand.hole && hand.hole.length ? hand.hole : ["??", "??"];
    var hcW = 176,
      hcH = 246,
      hcGap = 30;
    var hx = shareRowStart(pad, contentW, hole.length, hcW, hcGap);
    var hy = 226;
    for (var i = 0; i < hole.length; i++) {
      drawShareCard(ctx, hx + i * (hcW + hcGap), hy, hcW, hcH, hole[i]);
    }

    // board
    var board = (hand.board || []).filter(Boolean);
    var boardBottom = hy + hcH;
    if (board.length) {
      var byLabel = hy + hcH + 78;
      shareText(ctx, "BOARD", W / 2, byLabel, "500 22px " + SHARE_CARD.mono, col.muted, "center", "alphabetic", 6);
      var bcW = 128,
        bcH = 180,
        bcGap = 20;
      var bx = shareRowStart(pad, contentW, board.length, bcW, bcGap);
      var by = byLabel + 30;
      for (var b = 0; b < board.length; b++) {
        drawShareCard(ctx, bx + b * (bcW + bcGap), by, bcW, bcH, board[b]);
      }
      boardBottom = by + bcH;
    }

    // result headline
    var pnl = getHandPnl(hand);
    var res = hand.outcome ? hand.outcome.result : "?";
    var word = res === "won" ? "YOU WON" : res === "lost" ? "YOU LOST" : res === "folded" ? "FOLDED" : String(res).toUpperCase();
    var color = pnl.cls === "c-pos" ? col.green : pnl.cls === "c-neg" ? col.red : col.dim;
    var amount = pnl.text === "folded" ? "" : pnl.text;

    var resY = Math.max(boardBottom + 118, H - 168);
    shareText(ctx, word, W / 2, resY - 58, "600 24px " + SHARE_CARD.mono, col.dim, "center", "alphabetic", 6);
    if (amount) {
      shareText(ctx, amount, W / 2, resY + 18, "600 88px " + SHARE_CARD.serif, color, "center", "middle");
    } else {
      shareText(ctx, "FOLDED", W / 2, resY + 18, "600 76px " + SHARE_CARD.serif, color, "center", "middle");
    }

    // context line: position + pot
    var ctxBits = [];
    if (hand.position) ctxBits.push(hand.position + " position");
    ctxBits.push("Pot " + fmtBB(hand.pot || 0, bb));
    shareText(ctx, ctxBits.join("   ·   "), W / 2, resY + 76, "400 26px " + SHARE_CARD.serif, col.dim, "center", "middle");

    return canvas;
  }

  // Ensure the brand webfonts are loaded so canvas text uses them, not a fallback.
  if (document.fonts && document.fonts.ready && document.fonts.load) {
    return Promise.all([document.fonts.load("600 88px 'Cormorant Garamond'"), document.fonts.load("600 24px 'IBM Plex Mono'")])
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
        // very old fallback: data URL
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
