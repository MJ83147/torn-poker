function getChartColors() {
  var s = getComputedStyle(document.documentElement);
  return {
    dim:    s.getPropertyValue('--dim').trim()    || '#666',
    border: s.getPropertyValue('--border').trim() || '#333',
    green:  s.getPropertyValue('--green').trim()  || '#2ecc71',
    gold:   s.getPropertyValue('--gold').trim()   || '#f1c40f',
    red:    s.getPropertyValue('--red').trim()     || '#e74c3c',
    amber:  s.getPropertyValue('--amber').trim()   || '#e67e22',
  };
}

function chartTooltip(colors, callbacks) {
  return {
    backgroundColor: 'rgba(20,20,28,0.95)',
    titleColor: '#aaa',
    bodyColor: '#eee',
    borderColor: colors.border,
    borderWidth: 1,
    titleFont: { family: 'IBM Plex Mono', size: 11 },
    bodyFont:  { family: 'IBM Plex Mono', size: 11 },
    padding: 10,
    callbacks: callbacks || {},
  };
}

function chartLegend(colors, show) {
  if (show === false) return { display: false };
  return {
    display: true,
    position: 'top',
    align: 'start',
    labels: {
      color: colors.dim,
      font: { family: 'IBM Plex Mono', size: 11 },
      boxWidth: 14,
      boxHeight: 2,
      padding: 16,
    },
  };
}

function chartXScale(colors, opts) {
  opts = opts || {};
  var scale = {
    ticks: {
      color: colors.dim,
      font: { family: 'IBM Plex Mono', size: opts.tickSize || 10 },
    },
    grid: { color: 'transparent' },
    border: { color: colors.border },
  };
  if (opts.stacked) scale.stacked = true;
  if (opts.maxTicksLimit) scale.ticks.maxTicksLimit = opts.maxTicksLimit;
  if (opts.maxRotation !== undefined) scale.ticks.maxRotation = opts.maxRotation;
  if (opts.tickCallback) scale.ticks.callback = opts.tickCallback;
  if (opts.title) {
    scale.title = {
      display: true,
      text: opts.title,
      color: colors.dim,
      font: { family: 'IBM Plex Mono', size: 10 },
    };
  }
  return scale;
}

function chartYScale(colors, opts) {
  opts = opts || {};
  var scale = {
    ticks: {
      color: colors.dim,
      font: { family: 'IBM Plex Mono', size: opts.tickSize || 10 },
    },
    grid: { color: opts.gridColor || 'rgba(255,255,255,0.04)' },
    border: { display: false },
  };
  if (opts.stacked) scale.stacked = true;
  if (opts.max !== undefined) scale.max = opts.max;
  if (opts.tickCallback) scale.ticks.callback = opts.tickCallback;
  if (opts.gridWidth !== undefined) scale.grid.lineWidth = opts.gridWidth;
  return scale;
}

function chartYScaleZeroLine(colors, opts) {
  opts = opts || {};
  return {
    ticks: {
      color: colors.dim,
      font: { family: 'IBM Plex Mono', size: opts.tickSize || 10 },
      callback: opts.tickCallback,
    },
    grid: {
      color: function(ctx) {
        return ctx.tick.value === 0 ? colors.dim : 'rgba(255,255,255,0.04)';
      },
      lineWidth: function(ctx) {
        return ctx.tick.value === 0 ? 1 : 0.5;
      },
    },
    border: { display: false },
  };
}

function createChart(canvas, type, data, opts) {
  opts = opts || {};
  var defaults = {
    responsive: true,
    maintainAspectRatio: true,
    aspectRatio: opts.aspectRatio || 2.8,
  };
  if (opts.interaction) defaults.interaction = opts.interaction;

  defaults.plugins = {
    legend: opts.legend || { display: false },
    tooltip: opts.tooltip || {},
  };

  defaults.scales = {};
  if (opts.scales) {
    if (opts.scales.x) defaults.scales.x = opts.scales.x;
    if (opts.scales.y) defaults.scales.y = opts.scales.y;
  }

  return new Chart(canvas, {
    type: type,
    data: data,
    options: defaults,
  });
}
