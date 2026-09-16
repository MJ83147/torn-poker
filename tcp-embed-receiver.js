// Bundled at the end of app.min.js, so it runs after the app has initialised
// (processEnvelope is defined by then). Receives the hand envelope pushed by the
// TC Poker Export userscript via window.open + postMessage, which torn.com's CSP
// (frame-src) does not restrict the way it blocks iframing. See openAppWithData
// in the userscript for the sending side.
(function () {
  var TORN_ORIGINS = { "https://www.torn.com": true, "https://torn.com": true };
  if (location.search.indexOf("embed=1") === -1) return;
  if (!window.opener) return;

  window.addEventListener("message", function (e) {
    if (!TORN_ORIGINS[e.origin]) return;
    if (!e.data || e.data.type !== "tcp-hands") return;
    processEnvelope(e.data.envelope);
  });

  // Keep announcing until the script replies; the opener may still be
  // attaching its listener when this page finishes loading.
  var tries = 0;
  var t = setInterval(function () {
    if (++tries > 40) return clearInterval(t);
    try {
      window.opener.postMessage("tcp-ready", "*");
    } catch (e) {
      clearInterval(t);
    }
  }, 500);
  window.addEventListener("message", function (e) {
    if (e.data && e.data.type === "tcp-hands") clearInterval(t);
  });
})();
