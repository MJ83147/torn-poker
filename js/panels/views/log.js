// Hand Log panel view: assembles the UI from shared components + logModel.
// Entry point keeps the renderLog name so app.js dispatch is unchanged.

var _logPage = 0;
var _logSort = { col: null, dir: "desc" };

function renderLog(container, hands) {
  var PAGE_SIZE = 50;
  _logPage = 0;
  var allHands = hands.slice().reverse();

  function renderLogPage() {
    var m = logModel(allHands, _logSort, _logPage, PAGE_SIZE);

    var rows = m.pageHands
      .map(function (h, pi) {
        var globalIdx = m.start + pi;
        return renderHandRow(h, globalIdx, { starHtml: _logStarBtn(h, globalIdx) });
      })
      .join("");

    container.innerHTML =
      panelHeader("Hand Log", "Every hand played. Click any row to replay.") +
      `<div class="section">
        <div class="section-head">All Hands</div>
        <div class="row"><div class="container">
          ${renderSavedSection()}
          <div class="row between">
            <div class="text-meta">${m.total} hands total &middot; showing ${m.start + 1}-${m.end}</div>
            <div class="row center">${renderPagination(_logPage, m.total, PAGE_SIZE, "log-prev", "log-next")}</div>
          </div>
          <div class="overflow-x">
            <table class="table">
              <thead>${tableHead(["", { label: "Pos", sort: "pos" }, "Cards", "Context", "Board", "Pot", "Actions", { label: "Result", sort: "result" }], _logSort)}</thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
        </div></div>
      </div>`;

    wireSavedSection(container);

    container.querySelectorAll(".hrow[data-hand-idx]").forEach(function (row) {
      row.onclick = function (e) {
        if (e.target.closest(".hrow-star")) return;
        var idx = parseInt(this.getAttribute("data-hand-idx"));
        if (!isNaN(idx) && m.sorted[idx]) showExampleHandModal(m.sorted[idx]);
      };
    });
    container.querySelectorAll(".hrow-star").forEach(function (star) {
      star.onclick = function (e) {
        e.stopPropagation();
        var idx = parseInt(this.getAttribute("data-star-idx"));
        if (isNaN(idx) || !m.sorted[idx]) return;
        var nowStarred = toggleStarHand(m.sorted[idx]);
        this.innerHTML = nowStarred ? "&#9733;" : "&#9734;";
        this.classList.toggle("starred", nowStarred);
        this.title = nowStarred ? "Unsave" : "Save hand";
        refreshSavedSection(container);
      };
    });
    container.querySelectorAll(".sortable[data-sort-col]").forEach(function (th) {
      th.onclick = function () {
        var col = this.getAttribute("data-sort-col");
        if (_logSort.col === col) {
          _logSort.dir = _logSort.dir === "asc" ? "desc" : "asc";
        } else {
          _logSort.col = col;
          _logSort.dir = col === "pos" ? "asc" : "desc";
        }
        _logPage = 0;
        renderLogPage();
      };
    });
    var prevBtn = document.getElementById("log-prev");
    var nextBtn = document.getElementById("log-next");
    if (prevBtn)
      prevBtn.onclick = function () {
        _logPage--;
        renderLogPage();
      };
    if (nextBtn)
      nextBtn.onclick = function () {
        _logPage++;
        renderLogPage();
      };
  }
  renderLogPage();
}

function _logStarBtn(h, globalIdx) {
  var starred = isHandStarred(h);
  return `<span class="btn btn-icon hrow-star${starred ? " starred" : ""}" data-star-idx="${globalIdx}" data-hand-key="${getHandKey(h)}" title="${starred ? "Unsave" : "Save"} hand">${starred ? "&#9733;" : "&#9734;"}</span>`;
}

function renderSavedSection() {
  var saved = savedHandsModel();
  if (!saved.length) return "";

  var expanded = State.savedExpanded !== false;

  var cards = saved
    .map(function (x) {
      var h = x.entry.hand;
      var keyAttr = x.key.replace(/"/g, "&quot;");
      var notePreview = x.entry.note ? `<div class="text-meta saved-note-preview">${x.entry.note.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, " ")}</div>` : "";
      return `<div class="card card-link list saved-card" data-saved-key="${keyAttr}">
      <div class="row between">
        <div class="saved-card-hole">${h.hole ? displayCards(h.hole.map(normCard)) : "??"}</div>
        <div class="text-meta row center">
          <span class="saved-pos">${h.position || "?"}</span>
          ${renderResult(h, "span", "saved-res")}
        </div>
        <button class="btn btn-icon saved-unsave" data-unsave-key="${keyAttr}" title="Remove from saved">&#9733;</button>
      </div>
      <div class="text-meta">${h.board && h.board.length ? displayCards(h.board.map(normCard)) : "No board"}</div>
      <div class="text-meta saved-card-acts">${getActsSummary(h) || "No actions"}</div>
      ${notePreview ? `<div class="card card-s2 saved-card-note-wrap">${notePreview}</div>` : '<div class="text-meta saved-card-note-empty">No notes</div>'}
      <div class="text-meta text-right">${fmtDateShort(x.entry.savedAt)}</div>
    </div>`;
    })
    .join("");

  return `<div class="saved-section saved-section-divider">
    <div class="saved-toggle row center">
      <span class="saved-toggle-arrow" style="transform:rotate(${expanded ? "90" : "0"}deg);">&#9654;</span>
      <span class="eyebrow">&#9733; Saved Hands</span>
      <span class="text-meta">(${saved.length})</span>
    </div>
    <div class="saved-section-body"${expanded ? "" : ' style="display:none;"'}>
      <div class="saved-hands-list">${cards}</div>
    </div>
  </div>`;
}

function wireSavedSection(container) {
  var toggle = container.querySelector(".saved-toggle");
  if (toggle) {
    toggle.onclick = function () {
      var body = container.querySelector(".saved-section-body");
      var arrow = container.querySelector(".saved-toggle-arrow");
      if (!body) return;
      var isVisible = body.style.display !== "none";
      body.style.display = isVisible ? "none" : "";
      if (arrow) arrow.style.transform = isVisible ? "rotate(0deg)" : "rotate(90deg)";
      State.savedExpanded = !isVisible;
    };
  }

  var map = getStarredHands();

  container.querySelectorAll(".saved-card").forEach(function (card) {
    card.onclick = function (e) {
      if (e.target.closest(".saved-unsave")) return;
      var key = this.getAttribute("data-saved-key");
      var entry = map[key];
      if (entry && entry.hand) showExampleHandModal(entry.hand);
    };
  });

  container.querySelectorAll(".saved-unsave").forEach(function (btn) {
    btn.onclick = function (e) {
      e.stopPropagation();
      var key = this.getAttribute("data-unsave-key");
      var m = getStarredHands();
      delete m[key];
      setStarredHands(m);
      refreshSavedSection(container);
    };
  });
}

// Surgical refresh so a star toggle does not rebuild the whole log page.
// The saved section is the first element inside the All Hands container.
function refreshSavedSection(container) {
  var oldSection = container.querySelector(".saved-section");
  var newHtml = renderSavedSection();
  if (oldSection) {
    if (newHtml) {
      oldSection.outerHTML = newHtml;
    } else {
      oldSection.remove();
    }
  } else if (newHtml) {
    var host = container.querySelector(".section .container");
    if (host) host.insertAdjacentHTML("afterbegin", newHtml);
  }
  wireSavedSection(container);

  // Keep the table's star icons in step with storage, so unsaving from a
  // saved card (or the modal) repaints the matching row immediately.
  var starMap = getStarredHands();
  container.querySelectorAll(".hrow-star[data-hand-key]").forEach(function (star) {
    var starred = !!starMap[star.getAttribute("data-hand-key")];
    star.innerHTML = starred ? "&#9733;" : "&#9734;";
    star.classList.toggle("starred", starred);
    star.title = starred ? "Unsave hand" : "Save hand";
  });
}

function renderSavedHands() {
  var logPanel = document.getElementById("p-log");
  if (logPanel) refreshSavedSection(logPanel);
}
