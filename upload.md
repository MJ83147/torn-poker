I have enough. Here's what I'll produce:
index.html changes:

Add the third link in paste-nav
Add a new upload-wrap div (sibling to paste-wrap, hidden by default)

app.js changes:
3. Wire up the nav link to toggle between paste and upload views
4. Handle file input, show file list with hand counts, merge and feed to process()
No new CSS file needed since the upload view reuses paste-box, paste-title, desc-text, go-btn etc.
Here are the changes:
1. index.html — add to the paste-nav:
html<span id="upload-nav-btn" class="paste-nav-link">Multiple devices or can't paste?</span>
2. index.html — add a new div after paste-wrap, before dash:
html<div id="upload-wrap" style="display:none;">
  <div class="paste-box">
    <div class="paste-suit">♣</div>
    <div class="paste-title">Upload hand files</div>
    <div class="desc-text mb-24">Use the Download Hands button in the TC Poker Tracker to save your hand data as a .json file, then upload it here. You can upload multiple files to merge sessions from different devices.</div>
    <input type="file" id="upload-input" accept=".json" multiple style="display:none;">
    <button class="go-btn go-btn-primary" id="upload-pick-btn">Choose .json files</button>
    <div id="upload-file-list" style="margin-top:16px;"></div>
    <div id="upload-error" class="paste-error"></div>
    <button class="go-btn go-btn-secondary" id="upload-analyse-btn" style="display:none;margin-top:12px;">Analyse merged hands</button>
    <div style="margin-top:20px;">
      <span id="upload-back-btn" class="paste-nav-link" style="cursor:pointer;">← Back to paste</span>
    </div>
  </div>
</div>
3. app.js — add this block alongside the existing input handlers:
javascript// ── UPLOAD / MERGE HANDLERS ─────────────────────────────────────────────────
var _uploadedHands = [];

document.getElementById('upload-nav-btn').onclick = function() {
  document.getElementById('paste-wrap').style.display = 'none';
  document.getElementById('upload-wrap').style.display = 'block';
};

document.getElementById('upload-back-btn').onclick = function() {
  document.getElementById('upload-wrap').style.display = 'none';
  document.getElementById('paste-wrap').style.display = 'block';
  _uploadedHands = [];
  document.getElementById('upload-file-list').innerHTML = '';
  document.getElementById('upload-analyse-btn').style.display = 'none';
  document.getElementById('upload-error').style.display = 'none';
};

document.getElementById('upload-pick-btn').onclick = function() {
  document.getElementById('upload-input').click();
};

document.getElementById('upload-input').onchange = function() {
  var files = this.files;
  if (!files || !files.length) return;
  var errEl = document.getElementById('upload-error');
  var listEl = document.getElementById('upload-file-list');
  errEl.style.display = 'none';
  _uploadedHands = [];
  listEl.innerHTML = '';

  var pending = files.length;
  var fileResults = [];

  for (var i = 0; i < files.length; i++) {
    (function(file) {
      var reader = new FileReader();
      reader.onload = function(e) {
        try {
          var json = JSON.parse(e.target.result);
          var hands = (Array.isArray(json) ? json : (json.hands || [])).filter(function(h) {
            return h.hole && h.hole.length === 2;
          });
          fileResults.push({ name: file.name, count: hands.length, hands: hands });
        } catch (err) {
          fileResults.push({ name: file.name, count: 0, hands: [], error: err.message });
        }
        pending--;
        if (pending === 0) finishUpload(fileResults);
      };
      reader.onerror = function() {
        fileResults.push({ name: file.name, count: 0, hands: [], error: 'Could not read file' });
        pending--;
        if (pending === 0) finishUpload(fileResults);
      };
      reader.readAsText(file);
    })(files[i]);
  }
};

function finishUpload(results) {
  var listEl = document.getElementById('upload-file-list');
  var errEl = document.getElementById('upload-error');
  var analyseBtn = document.getElementById('upload-analyse-btn');
  _uploadedHands = [];
  var html = '';

  for (var i = 0; i < results.length; i++) {
    var r = results[i];
    if (r.error) {
      html += '<div class="desc-text" style="color:var(--red);margin-bottom:6px;">' + r.name + ' — error: ' + r.error + '</div>';
    } else if (r.count === 0) {
      html += '<div class="desc-text" style="color:var(--muted);margin-bottom:6px;">' + r.name + ' — no valid hands found</div>';
    } else {
      html += '<div class="desc-text" style="margin-bottom:6px;"><strong style="color:var(--gold);">' + r.count + '</strong> hands from ' + r.name + '</div>';
      _uploadedHands = _uploadedHands.concat(r.hands);
    }
  }

  listEl.innerHTML = html;

  if (_uploadedHands.length > 0) {
    var total = '<div class="desc-text" style="margin-top:12px;"><strong style="color:var(--text);">' + _uploadedHands.length + '</strong> total hands across ' + results.filter(function(r) { return r.count > 0; }).length + ' file(s)</div>';
    listEl.innerHTML += total;
    analyseBtn.style.display = 'block';
  } else {
    errEl.textContent = 'No valid hands found in the uploaded files.';
    errEl.style.display = 'block';
    analyseBtn.style.display = 'none';
  }
}

document.getElementById('upload-analyse-btn').onclick = function() {
  if (!_uploadedHands.length) return;
  var merged = {
    exportedAt: new Date().toISOString(),
    player: detectPlayerFromActions(_uploadedHands) || 'Unknown',
    totalHands: _uploadedHands.length,
    hands: _uploadedHands,
  };
  process(JSON.stringify(merged));
};