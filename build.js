var esbuild = require('esbuild');
var fs = require('fs');
var path = require('path');

function listJs(dir) {
  var full = path.join(__dirname, dir);
  if (!fs.existsSync(full)) return [];
  return fs.readdirSync(full)
    .filter(function(f) { return f.endsWith('.js'); })
    .sort()
    .map(function(f) { return dir + '/' + f; });
}

var helperOrder = [
  'js/helpers/constants.js',
  'js/helpers/cards.js',
  'js/helpers/format.js',
  'js/helpers/analysis.js',
  'js/helpers/sessions.js',
  'js/helpers/storage.js',
  'js/helpers/ui.js',
  'js/helpers/opponents.js',
];

var components = listJs('js/components');
var panels = listJs('js/panels');
var panelViews = listJs('js/panels/views');

var insightsOrder = [
  'js/insights/story-engine.js',
  'js/insights/story-builder.js',
  'js/insights/sections/range.js',
  'js/insights/sections/position.js',
  'js/insights/sections/showdown.js',
  'js/insights/sections/tables.js',
  'js/insights/sections/trends.js',
  'js/insights/sections/streets.js',
  'js/insights/sections/players.js',
  'js/insights/sections/bets.js',
  'js/insights/sections/allin.js',
  'js/insights/sections/cards.js',
];

var files = []
  .concat(helperOrder)
  .concat(['js/stats.js'])
  .concat(['js/helpers/matrix.js'])
  .concat(insightsOrder)
  .concat(['js/loader.js', 'js/state.js', 'js/modal.js', 'js/charting.js'])
  .concat(components)
  .concat(panels)
  .concat(panelViews)
  .concat([
    'js/hand-evaluator.js',
    'js/equity-monte-carlo.js',
    'js/equity-guidance.js',
    'js/equity.js',
    'js/tour.js',
    'app.js',
  ]);

files.forEach(function(f) {
  if (!fs.existsSync(path.join(__dirname, f))) {
    throw new Error('build.js: missing source file ' + f);
  }
});

var auditedDirs = ['js/helpers', 'js/panels', 'js/components', 'js/panels/views'];
auditedDirs.forEach(function(dir) {
  listJs(dir).forEach(function(f) {
    if (files.indexOf(f) === -1) {
      throw new Error('build.js: ' + f + ' exists on disk but is not in the load order. ' +
        'Add it to helperOrder (or, for panels, it should auto-discover).');
    }
  });
});

var combined = files
  .map(function(f) { return fs.readFileSync(path.join(__dirname, f), 'utf8'); })
  .join('\n');

var result = esbuild.buildSync({
  stdin: {
    contents: combined,
    loader: 'js',
  },
  write: false,
  minify: true,
  target: ['es2018'],
  outfile: 'app.min.js',
});

fs.writeFileSync(path.join(__dirname, 'app.min.js'), result.outputFiles[0].text);
var size = (result.outputFiles[0].text.length / 1024).toFixed(1);
console.log('Built app.min.js (' + size + ' KB) from ' + files.length + ' files');
