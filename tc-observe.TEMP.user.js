// ==UserScript==
// @name         TC Poker — OBSERVE (temporary)
// @namespace    https://poker.systoned.cc/
// @version      0.1.0
// @description  TEMPORARY read-only observer. Shows the raw holdem frames for the ONE table you are currently viewing, so we can see what the expanded capture looks like. Never logs chat. Never logs any other table or the lobby. Stores nothing, sends nothing — console + a copy button only.
// @author       systoned
// @match        https://www.torn.com/*
// @match        https://*.torn.com/*
// @run-at       document-start
// @grant        unsafeWindow
// @grant        GM_setClipboard
// @noframes
// ==/UserScript==

(function () {
  'use strict';

  // The table this page is viewing. We lock onto the FIRST holdem<N> channel we
  // see and ignore every other table id — so nothing from a table you aren't
  // looking at is ever touched (Torn ToC).
  var ourTable = null;

  // In-memory only. Capped. Never persisted, never uploaded.
  var captured = [];
  var MAX = 800;

  function tableIdOf(channel) {
    var m = String(channel || '').match(/^holdem(\d+)/);   // matches holdem9 and holdem9#123
    return m ? Number(m[1]) : null;
  }

  // Best-effort chat detector — we drop anything that looks like table chat.
  function looksLikeChat(channel, msg) {
    var et = String((msg && msg.eventType) || '').toLowerCase();
    if (/chat|message|talk|emote|comment/.test(et)) return true;
    if (/chat/i.test(String(channel || ''))) return true;
    if (msg && (msg.chat || msg.chatMessage || msg.comment)) return true;
    return false;
  }

  function record(channel, msg) {
    // Never the lobby snapshot (it lists tables you are not viewing).
    if (channel === 'holdemlobby' || (msg && Array.isArray(msg.tables))) return;

    var tid = tableIdOf(channel);
    if (tid == null) return;                 // not a table channel

    if (ourTable == null) ourTable = tid;    // lock onto the current page's table
    if (tid !== ourTable) return;            // ignore any other table — hard stop

    if (looksLikeChat(channel, msg)) return; // never log chat

    captured.push({ t: Date.now(), channel: channel, eventType: (msg && msg.eventType) || null, message: msg });
    if (captured.length > MAX) captured.splice(0, captured.length - MAX);

    console.log('[TC OBSERVE]', channel, (msg && msg.eventType) || '(no eventType)', msg);
    updatePanel();
  }

  // --- WebSocket inspection (read-only; we never alter frames) -----------------
  function inspect(data) {
    if (typeof data !== 'string') return;
    if (data.indexOf('holdem') === -1) return;
    var frame;
    try { frame = JSON.parse(data); } catch (e) { return; }
    if (!frame) return;
    var push = frame.push || frame;
    var channel = (push && push.channel) || frame.channel || null;
    var message = (push && push.pub && push.pub.data && push.pub.data.message)
               || (frame.pub && frame.pub.data && frame.pub.data.message)
               || frame.message
               || (frame.data && frame.data.message)
               || null;
    if (!channel || !message) return;
    record(channel, message);
  }

  try {
    var _addEL = window.WebSocket && window.WebSocket.prototype.addEventListener;
    if (_addEL) {
      window.WebSocket.prototype.addEventListener = function (type, listener, options) {
        if (type === 'message') {
          var wrapped = function (e) { try { inspect(e.data); } catch (_) {} return listener.call(this, e); };
          return _addEL.call(this, type, wrapped, options);
        }
        return _addEL.call(this, type, listener, options);
      };
    }
    var _desc = window.WebSocket && Object.getOwnPropertyDescriptor(window.WebSocket.prototype, 'onmessage');
    if (_desc && _desc.set) {
      Object.defineProperty(window.WebSocket.prototype, 'onmessage', {
        configurable: true,
        get: _desc.get,
        set: function (fn) {
          _desc.set.call(this, function (e) { try { inspect(e.data); } catch (_) {} if (fn) return fn.call(this, e); });
        }
      });
    }
  } catch (e) {}

  // --- Tiny panel: count + copy + clear ---------------------------------------
  function copyOut() {
    var text = JSON.stringify({ table: ourTable, count: captured.length, events: captured }, null, 2);
    try { if (typeof GM_setClipboard === 'function') { GM_setClipboard(text); return true; } } catch (e) {}
    try { navigator.clipboard.writeText(text); return true; } catch (e) {}
    console.log('[TC OBSERVE] copy failed — full dump follows:\n', text);
    return false;
  }

  function updatePanel() {
    var c = document.getElementById('tc-observe-count');
    if (c) c.textContent = 'table ' + (ourTable == null ? '?' : ourTable) + ' · ' + captured.length + ' events';
  }

  function buildPanel() {
    if (document.getElementById('tc-observe')) return;
    if (!document.body) return;
    var box = document.createElement('div');
    box.id = 'tc-observe';
    box.style.cssText = [
      'position:fixed', 'top:8px', 'right:8px', 'z-index:2147483647',
      'background:#120c0c', 'border:1px solid #5a3a3a', 'border-radius:6px',
      'font-family:Georgia,serif', 'font-size:11px', 'color:#e0c0c0', 'padding:8px 10px',
      'box-shadow:0 6px 20px rgba(0,0,0,0.8)'
    ].join(';');
    box.innerHTML =
      '<div style="font-weight:bold;color:#e08a8a;margin-bottom:4px;">TC OBSERVE (temp)</div>' +
      '<div id="tc-observe-count" style="margin-bottom:6px;">waiting for a hand…</div>' +
      '<button id="tc-observe-copy" style="font:inherit;color:#c8a94a;background:transparent;border:1px solid #c8a94a;border-radius:4px;padding:4px 8px;cursor:pointer;margin-right:6px;">Copy JSON</button>' +
      '<button id="tc-observe-clear" style="font:inherit;color:#8a8a8a;background:transparent;border:1px solid #8a8a8a;border-radius:4px;padding:4px 8px;cursor:pointer;">Clear</button>';
    document.body.appendChild(box);
    document.getElementById('tc-observe-copy').onclick = function () {
      var ok = copyOut();
      this.textContent = ok ? 'Copied!' : 'See console';
      var self = this; setTimeout(function () { self.textContent = 'Copy JSON'; }, 1500);
    };
    document.getElementById('tc-observe-clear').onclick = function () { captured = []; updatePanel(); };
    updatePanel();
  }

  if (document.body) buildPanel();
  document.addEventListener('DOMContentLoaded', buildPanel);
  new MutationObserver(buildPanel).observe(document.documentElement, { childList: true, subtree: true });
})();
