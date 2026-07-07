// Shared panel-shell components. A panel view builds its chrome from these;
// output matches the shell mountPanel used to emit, so style.css is unchanged.

// Panel header: title + optional description.
function panelHeader(title, desc) {
  return `
    <div class="panel-header">
      <div class="title title-lg c-gold">${title}</div>
      ${desc ? `<div class="text-body">${desc}</div>` : ''}
    </div>`;
}

// One full-width message in the standard section/row/container shell.
function emptyState(msg) {
  return `
    <div class="section"><div class="row"><div class="container">
      <div class="box lead">${msg}</div>
    </div></div></div>`;
}

// Standard titled section: content sits in the row/container shell.
function section(title, innerHtml) {
  return `
    <div class="section">
      ${title ? `<div class="section-head">${title}</div>` : ''}
      <div class="row"><div class="container">${innerHtml}</div></div>
    </div>`;
}

// Titled section holding one chart canvas.
function chartSection(title, canvasId) {
  return section(title, `<canvas id="${canvasId}"></canvas>`);
}

// A group of charts laid out two-per-row (2x2 on desktop, stacking on mobile
// via the responsive .row rule). Each chart carries its own eyebrow title.
// charts: [{ title, id }]. An odd chart out gets its row (and width) to itself.
function chartGrid(sectionTitle, charts) {
  var list = (charts || []).filter(Boolean);
  if (!list.length) return '';
  var rows = '';
  for (var i = 0; i < list.length; i += 2) {
    rows += '<div class="row">' + list.slice(i, i + 2).map(function (c) {
      return '<div class="container">' +
        (c.title ? '<div class="eyebrow">' + c.title + '</div>' : '') +
        '<canvas id="' + c.id + '"></canvas></div>';
    }).join('') + '</div>';
  }
  return '<div class="section">' +
    (sectionTitle ? '<div class="section-head">' + sectionTitle + '</div>' : '') +
    rows + '</div>';
}
