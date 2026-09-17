// Receives hands from the TC Poker Export userscript via the encrypted relay.
// The userscript uploads AES-GCM ciphertext to the relay and opens this app with
// #relay=<id>&key=<b64url key>. We fetch the ciphertext, decrypt it locally with
// the key from the fragment (which never reached the server), gunzip, and import.
// This exists because torn.com sends Cross-Origin-Opener-Policy: same-origin,
// which nulls window.opener in a cross-origin popup, ruling out a postMessage
// handoff. Bundled last so processEnvelope is already defined.
(function () {
  // Must match RELAY_URL in the userscript and the Worker's custom domain.
  var RELAY_URL = "https://relay.systoned.cc";

  var hash = location.hash || "";
  var mId = hash.match(/[#&]relay=([A-Za-z0-9_-]+)/);
  var mKey = hash.match(/[#&]key=([A-Za-z0-9_-]+)/);
  if (!mId || !mKey) return;
  var id = mId[1];
  var keyB64 = mKey[1];

  // Wipe the key from the URL and history at once: it must not persist or be
  // shareable.
  try {
    history.replaceState(null, '', location.pathname + location.search);
  } catch (e) {}

  // Self-reporting banner: a fixed overlay independent of the app's own DOM, so
  // every stage (and any failure) is visible on the page without a console.
  var bar;
  function banner(msg, kind) {
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'tcp-relay-banner';
      bar.style.cssText =
        'position:fixed;top:0;left:0;right:0;z-index:2147483647;' +
        'padding:12px 16px;font:600 14px/1.4 Georgia,serif;text-align:center;' +
        'box-shadow:0 2px 12px rgba(0,0,0,.4)';
      (document.body || document.documentElement).appendChild(bar);
    }
    bar.style.background = kind === 'error' ? '#3a1616' : kind === 'ok' ? '#16351f' : '#1a2436';
    bar.style.color = kind === 'error' ? '#ff9a9a' : kind === 'ok' ? '#9ff0b5' : '#cfe0ff';
    bar.textContent = 'TCP relay: ' + msg;
    if (kind === 'ok') setTimeout(function () { if (bar) bar.style.display = 'none'; }, 2500);
  }

  function b64urlToBytes(s) {
    s = s.replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    var bin = atob(s);
    var out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  // KV is eventually consistent; the object may not be readable the instant
  // after the write. Retry a 404 up to 5 times, 1s apart.
  function fetchBlob(tries) {
    banner('fetching hands (id ' + id.slice(0, 6) + '...)' + (tries ? ' retry ' + tries : ''));
    return fetch(RELAY_URL + '/get/' + id, { cache: 'no-store' }).then(function (r) {
      if (r.status === 404 && tries < 5) {
        return new Promise(function (res) { setTimeout(res, 1000); }).then(function () {
          return fetchBlob(tries + 1);
        });
      }
      if (r.status === 404) throw new Error('expired');
      if (!r.ok) throw new Error('relay HTTP ' + r.status);
      return r.arrayBuffer();
    });
  }

  banner('reading link, id ' + id.slice(0, 6) + '...');
  fetchBlob(0)
    .then(function (ab) {
      banner('decrypting (' + Math.round(ab.byteLength / 1024) + ' KB)');
      var bytes = new Uint8Array(ab);
      if (bytes[0] !== 1) throw new Error('bad payload version ' + bytes[0]);
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
          var n = (envelope && envelope.hands && envelope.hands.length) || 0;
          banner('importing ' + n + ' hands', 'ok');
          processEnvelope(envelope);
        });
    })
    .catch(function (e) {
      var msg = e && e.message ? e.message : String(e);
      if (msg === 'expired') {
        banner('link expired or already used. Go back to Torn and click again.', 'error');
      } else {
        banner('failed: ' + msg + '. Use Export file on Torn instead.', 'error');
      }
    });
})();
