var esbuild = require('esbuild');
var fs = require('fs');
var path = require('path');

// Lists every .js file in `dir` (relative to this script), alphabetically.
function listJs(dir) {
  var full = path.join(__dirname, dir);
  if (!fs.existsSync(full)) return [];
  return fs.readdirSync(full)
    .filter(function(f) { return f.endsWith('.js'); })
    .sort()
    .map(function(f) { return dir + '/' + f; });
}

// Hand-listed load order for the ordering-sensitive layers (helpers, engine,
// root standalones). Panels are auto-discovered because their order does not
// matter and forgetting to add one used to silently break the build.
var helperOrder = [
  'js/helpers/cards.js',
  'js/helpers/tables.js',
  'js/helpers/format.js',
  'js/helpers/hand-parsing.js',
  'js/helpers/analysis.js',
  'js/helpers/sessions.js',
  'js/helpers/storage.js',
  'js/helpers/ui.js',
  'js/helpers/migration.js',
  'js/helpers/panel-shared.js',
];

var engineOrder = [
  'js/engine/matrix.js',
  'js/engine/styleDetector.js',
  'js/engine/verdict.js',
  'js/engine/rules.js',
  'js/engine/panelOverview.js',
  'js/engine/patterns.js',
  'js/engine/narrative.js',
  'js/engine/engine.js',
  'js/engine/ruleset.js',
];

var panels = listJs('js/panels');

var files = []
  .concat(helperOrder)
  .concat(['js/stats.js'])
  .concat(engineOrder)
  .concat(['js/helpers/context.js'])
  .concat(['js/loader.js', 'js/state.js', 'js/modal.js', 'js/charting.js'])
  .concat(panels)
  .concat(['js/equity.js', 'js/tour.js', 'js/ui-bindings.js', 'app.js']);

// Sanity 1: every file we plan to read must exist.
files.forEach(function(f) {
  if (!fs.existsSync(path.join(__dirname, f))) {
    throw new Error('build.js: missing source file ' + f);
  }
});

// Sanity 2: every .js file present in the audited directories must appear in
// the manifest. This catches the "added a new helper / engine file but forgot
// to register it" mistake, which used to silently break runtime behaviour.
var auditedDirs = ['js/helpers', 'js/engine', 'js/panels'];
auditedDirs.forEach(function(dir) {
  listJs(dir).forEach(function(f) {
    if (files.indexOf(f) === -1) {
      throw new Error('build.js: ' + f + ' exists on disk but is not in the load order. ' +
        'Add it to helperOrder / engineOrder, or (for panels) it should auto-discover.');
    }
  });
});

// Concatenate all source files in order.
var combined = files
  .map(function(f) { return fs.readFileSync(path.join(__dirname, f), 'utf8'); })
  .join('\n');

// Minify with esbuild.
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
