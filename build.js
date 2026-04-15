var esbuild = require('esbuild');
var fs = require('fs');
var path = require('path');

// Files in exact load order (matches original script tags)
var files = [
  'js/helpers/cards.js',
  'js/helpers/tables.js',
  'js/helpers/format.js',
  'js/helpers/hand-parsing.js',
  'js/helpers/analysis.js',
  'js/helpers/sessions.js',
  'js/helpers/storage.js',
  'js/helpers/ui.js',
  'js/helpers/migration.js',
  'js/stats.js',
  'js/engine/rules.js',
  'js/engine/patterns.js',
  'js/engine/narrative.js',
  'js/engine/engine.js',
  'js/engine/ruleset.js',
  'js/loader.js',
  'js/state.js',
  'js/modal.js',
  'js/charting.js',
  'js/panels/welcome.js',
  'js/panels/cards.js',
  'js/panels/position.js',
  'js/panels/street.js',
  'js/panels/actions.js',
  'js/panels/range.js',
  'js/panels/tables.js',
  'js/panels/trends.js',
  'js/panels/showdown.js',
  'js/panels/log.js',
  'js/panels/allin.js',
  'js/panels/compare.js',
  'js/panels/players.js',
  'js/panels/mygame.js',
  'js/panels/leaks.js',
  'js/equity.js',
  'js/tour.js',
  'app.js',
];

// Concatenate all source files in order
var combined = files
  .map(function(f) { return fs.readFileSync(path.join(__dirname, f), 'utf8'); })
  .join('\n');

// Minify with esbuild
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
console.log('Built app.min.js (' + size + ' KB)');
