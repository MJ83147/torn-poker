// How a single hand renders: the log/players table row and its pieces.
// Shared by the log and players panels and the hand modal.

function renderResult(h, tag, baseClass) {
  var pnl = getHandPnl(h);
  return `<${tag} class="${baseClass} ${pnl.cls}">${pnl.text}</${tag}>`;
}

function handTagsHtml(h) {
  if (!h || !h.seatBucket) return "";
  var parts = [`<span class="tag tag-gold">${h.seatBucket}</span>`];
  if (h.flopBucket) parts.push(`<span class="tag">${h.flopBucket}</span>`);
  return `<span class="row center">${parts.join("")}</span>`;
}

// Compact "start -> end" stack line for the hero. Returns '' when neither
// stack value is present (legacy hands) so nothing is fabricated as 0.
function heroStackLine(h) {
  if (h == null) return "";
  var start = h.startStack,
    end = h.endStack;
  if (start == null && end == null) return "";
  var bb = getHandBB(h);
  var s = start != null ? fmtBB(start, bb) : "&mdash;";
  var e = end != null ? fmtBB(end, bb) : "&mdash;";
  return `<div class="text-meta c-dim stack-flow">${s} &rarr; ${e}</div>`;
}

function renderHandRow(h, idx, opts) {
  var starCol = opts && opts.starHtml ? `<td>${opts.starHtml}</td>` : "";
  return `<tr class="link" data-hand-idx="${idx}">
    ${starCol}
    <td class="c-gold">${h.position || "?"}</td>
    <td>${h.hole && h.hole.length ? displayCards(h.hole.map(normCard)) : "?? ??"}</td>
    <td>${handTagsHtml(h)}</td>
    <td class="c-dim truncate">${h.board && h.board.length ? displayCards(h.board.map(normCard)) : "-"}</td>
    <td>${fmtBB(h.pot || 0, getHandBB(h))}${heroStackLine(h)}</td>
    <td class="c-dim truncate">${getActsSummary(h)}</td>
    ${renderResult(h, "td", "num")}
  </tr>`;
}
