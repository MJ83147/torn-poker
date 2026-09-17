// Receives hands handed off from the TC Poker Tracker userscript. The userscript
// opens this app with #relay=<id>&key=<key>; we fetch the payload, decrypt it
// locally with the key from the fragment (which never left the device), and
// import. Bundled last so processEnvelope and the loader DOM already exist, and
// so we can override loader.js (which reveals the landing screen on every load).
(function () {
  var RELAY_URL = "https://relay.systoned.cc";

  var hash = location.hash || "";
  var mId = hash.match(/[#&]relay=([A-Za-z0-9_-]+)/);
  var mKey = hash.match(/[#&]key=([A-Za-z0-9_-]+)/);
  if (!mId || !mKey) return;
  var id = mId[1];
  var keyB64 = mKey[1];

  // Strip the key from the URL and history immediately.
  try {
    history.replaceState(null, '', location.pathname + location.search);
  } catch (e) {}

  var appEl = document.getElementById('app');
  var loaderEl = document.getElementById('loader');

  // This is a sync open, not a manual visit. loader.js revealed the landing
  // screen a moment ago (earlier in the bundle); undo that and show the loading
  // animation before the first paint, so the landing screen never flashes.
  function showLoader() {
    if (appEl) appEl.classList.remove('on');
    if (loaderEl) {
      loaderEl.style.display = 'flex';
      loaderEl.classList.remove('out');
    }
    var cards = document.querySelectorAll('#loader .card-face');
    for (var i = 0; i < cards.length; i++) cards[i].classList.add('show');
  }
  // On failure, drop back to the landing screen with a plain-language message.
  function fail(msg) {
    if (loaderEl) loaderEl.style.display = 'none';
    if (appEl) appEl.classList.add('on');
    var el = document.getElementById('paste-error');
    if (el) {
      el.textContent = msg;
      el.style.display = 'block';
    }
  }
  showLoader();

  function b64urlToBytes(s) {
    s = s.replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    var bin = atob(s);
    var out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  // The store may not be readable the instant after the write. Retry a 404 up to
  // 5 times, 1s apart, before giving up.
  function fetchBlob(tries) {
    return fetch(RELAY_URL + '/get/' + id, { cache: 'no-store' }).then(function (r) {
      if (r.status === 404 && tries < 5) {
        return new Promise(function (res) { setTimeout(res, 1000); }).then(function () {
          return fetchBlob(tries + 1);
        });
      }
      if (r.status === 404) throw new Error('expired');
      if (!r.ok) throw new Error('http');
      return r.arrayBuffer();
    });
  }

  fetchBlob(0)
    .then(function (ab) {
      var bytes = new Uint8Array(ab);
      if (bytes[0] !== 1) throw new Error('format');
      var gzip = (bytes[1] & 1) === 1;
      var iv = bytes.subarray(2, 14);
      var ct = bytes.subarray(14);
      return crypto.subtle
        .importKey('raw', b64urlToBytes(keyB64), { name: 'AES-GCM' }, false, ['decrypt'])
        .then(function (key) {
          return crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv }, key, ct);
        })
        .then(function (plainBuf) {
          var plain = new Uint8Array(plainBuf);
          if (!gzip) return plain;
          var ds = new Blob([plain]).stream().pipeThrough(new DecompressionStream('gzip'));
          return new Response(ds).arrayBuffer().then(function (a) { return new Uint8Array(a); });
        })
        .then(function (plainBytes) {
          var envelope = JSON.parse(new TextDecoder().decode(plainBytes));
          processEnvelope(envelope);
        });
    })
    .catch(function (e) {
      if (e && e.message === 'expired') {
        fail('That link has expired. Go back to Torn and click "Open app with my hands" again.');
      } else {
        fail('Could not load your hands. Try again, or use Export file on Torn and upload it here.');
      }
    });
})();
