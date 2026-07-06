// Shared data-table component.

// Build a <tr> of <th> from column specs. Each spec is one of:
//   '' / null            -> empty <th></th>
//   'Plain'              -> <th>Plain</th> (raw HTML allowed)
//   { tip: 'Win Rate' }  -> <th> with tipWrap(label)
//   { html: '...' }      -> <th> with custom inner HTML
//   { label/tip, sort: 'key' } -> sortable <th data-sort-col="key"> with arrow
// sortState is { col, dir } and drives the active-column arrow.
function tableHead(cols, sortState) {
  function arrow(key) {
    if (!sortState || sortState.col !== key) return '';
    return sortState.dir === 'asc' ? ' &#9650;' : ' &#9660;';
  }
  var ths = cols.map(function(c) {
    if (c == null || c === '') return '<th></th>';
    if (typeof c === 'string') return `<th>${c}</th>`;
    var label = c.tip ? tipWrap(c.tip) : (c.html != null ? c.html : c.label);
    if (c.sort) return `<th class="sortable" data-sort-col="${c.sort}">${label}${arrow(c.sort)}</th>`;
    return `<th>${label}</th>`;
  });
  return `<tr>${ths.join('')}</tr>`;
}

// Prev/next pager. Empty when everything fits on one page.
function renderPagination(page, totalItems, pageSize, prevId, nextId) {
  var totalPages = Math.ceil(totalItems / pageSize);
  if (totalPages <= 1) return '';
  return `<button class="btn btn-ghost" id="${prevId}" ${page === 0 ? 'disabled' : ''}>&laquo; Prev</button>
    <span class="text-meta">Page ${page + 1}/${totalPages}</span>
    <button class="btn btn-ghost" id="${nextId}" ${page >= totalPages - 1 ? 'disabled' : ''}>Next &raquo;</button>`;
}

// Standard table in the section/row/container shell.
// opts: { head, rows, title?, sort? } — rows is an array of <tr> strings.
function dataTable(opts) {
  return `
    <div class="section">
      ${opts.title ? `<div class="section-head">${opts.title}</div>` : ''}
      <div class="row"><div class="container">
        <div class="overflow-x">
          <table class="table">
            <thead>${tableHead(opts.head, opts.sort)}</thead>
            <tbody>${opts.rows.join('')}</tbody>
          </table>
        </div>
      </div></div>
    </div>`;
}
