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

  function status(msg, isError) {
    var el = document.getElementById('paste-error');
    if (el) {
      el.textContent = msg;
      el.style.display = 'block';
      el.style.color = isError ? '' : 'var(--c-muted, #8a7a5a)';
    } else if (isError) {
      alert(msg);
    }
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
    return fetch(RELAY_URL + '/get/' + id, { cache: 'no-store' }).then(function (r) {
      if (r.status === 404 && tries < 5) {
        return new Promise(function (res) { setTimeout(res, 1000); }).then(function () {
          return fetchBlob(tries + 1);
        });
      }
      if (r.status === 404) throw new Error('expired');
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.arrayBuffer();
    });
  }

  status('Loading your hands...', false);
  fetchBlob(0)
    .then(function (ab) {
      var bytes = new Uint8Array(ab);
      if (bytes[0] !== 1) throw new Error('bad version');
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
        status('Hand data has expired or was already loaded. Go back to Torn and try again.', true);
      } else {
        status('Could not read the hand data. Use Export file on Torn and upload it here instead.', true);
      }
    });
})();
