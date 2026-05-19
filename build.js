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

// Hand-listed load order for the ordering-sensitive layers (helpers, root
// standalones). Panels are auto-discovered because their order does not
// matter and forgetting to add one used to silently break the build.
//
// matrix.js and styleDetector.js sit in helpers/ as shared infrastructure:
// matrix.js owns the table-dynamics target bands, styleDetector.js owns the
// VPIP/AF -> style classification. They load before context.js and
// target-bands.js (which wrap matrixTarget) so those can reference them.
var helperOrder = [
  'js/helpers/constants.js',
  'js/helpers/css-classes.js',
  'js/helpers/cards.js',
  'js/helpers/tables.js',
  'js/helpers/format.js',
  'js/helpers/hand-parsing.js',
  'js/helpers/stack-bands.js',
  'js/helpers/analysis.js',
  'js/helpers/hand-predicates.js',
  'js/helpers/sessions.js',
  'js/helpers/storage.js',
  'js/helpers/ui.js',
  'js/helpers/migration.js',
  'js/helpers/panel-shared.js',
  'js/helpers/opponent-stats.js',
  'js/helpers/opponent-profile.js',
];

var panels = listJs('js/panels');

// Sections framework + sections. Sits before panels so panels can call
// Sections.evaluateSections at render time. Each section's run() reads
// matrixTarget/getUserStyle from the shared helpers above.
var insightsOrder = [
  'js/insights/story-engine.js',
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
  .concat([
    'js/helpers/matrix.js',
    'js/helpers/styleDetector.js',
    'js/helpers/context.js',
    'js/helpers/target-bands.js',
    'js/helpers/pnl-slice.js',
  ])
  .concat(insightsOrder)
  .concat(['js/loader.js', 'js/state.js', 'js/modal.js', 'js/charting.js'])
  .concat(panels)
  .concat([
    'js/hand-evaluator.js',
    'js/equity-monte-carlo.js',
    'js/equity-guidance.js',
    'js/equity.js',
    'js/tour.js',
    'js/ui-bindings.js',
    'app.js',
  ]);

// Sanity 1: every file we plan to read must exist.
files.forEach(function(f) {
  if (!fs.existsSync(path.join(__dirname, f))) {
    throw new Error('build.js: missing source file ' + f);
  }
});

// Sanity 2: every .js file present in the audited directories must appear in
// the manifest. Catches the "added a new helper / panel but forgot to
// register it" mistake, which used to silently break runtime behaviour.
var auditedDirs = ['js/helpers', 'js/panels'];
auditedDirs.forEach(function(dir) {
  listJs(dir).forEach(function(f) {
    if (files.indexOf(f) === -1) {
      throw new Error('build.js: ' + f + ' exists on disk but is not in the load order. ' +
        'Add it to helperOrder (or, for panels, it should auto-discover).');
    }
  });
});

// Concatenate all source files in order.
var combined = files
  .map(function(f) { return fs.readFileSync(path.join(__dirname, f), 'utf8'); })
  .join('\n');

// Inline panel HTML templates. Each js/panels/<name>.html becomes
// window.__TPL['<name>'] = '<minified html>'. Loaded once at bundle init so
// panels never fetch at render time. Minify by collapsing whitespace runs
// and trimming each line — preserves attribute values and text content
// reading order, drops cosmetic indentation.
function minifyHtml(src) {
  return src
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\s+/g, ' ')
    .replace(/>\s+</g, '><')
    .trim();
}
var tplFiles = listJs('js/panels').map(function(jsPath) {
  return jsPath.replace(/\.js$/, '.html');
});
var tplAssignments = [];
tplFiles.forEach(function(htmlPath) {
  var full = path.join(__dirname, htmlPath);
  if (!fs.existsSync(full)) return; // optional during migration
  var name = path.basename(htmlPath, '.html');
  var html = minifyHtml(fs.readFileSync(full, 'utf8'));
  tplAssignments.push("window.__TPL['" + name + "']=" + JSON.stringify(html) + ";");
});
if (tplAssignments.length) {
  combined = "window.__TPL=window.__TPL||{};" + tplAssignments.join('') + '\n' + combined;
}

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
