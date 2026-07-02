// ==UserScript==
// @name         TC Poker Tracker
// @namespace    https://poker.systoned.cc/
// @version      5.1.0
// @description  Records your Torn City Hold'em hands as you play (structured, from the game's own WebSocket frames — never chat) and exports them to the poker analysis app. Captures per-player starting/ending stacks and action timing.
// @author       systoned
// @match        https://www.torn.com/*
// @match        https://*.torn.com/*
// @run-at       document-start
// @grant        GM_setClipboard
// @noframes
// ==/UserScript==

(function () {
  'use strict';

  // --------------------------------------------------------------------------
  // Config
  // --------------------------------------------------------------------------
  var SRC_DB  = 'tc_poker_tm';        // old v4.9 capture DB. Read only.
  var DB      = 'tcp_data_export';    // our store. All writes go here.
  var STORE   = 'hands';              // autoIncrement store, NO inline keys
  var IMPORT_FLAG = 'tcp_data_export_history_imported';

  // The player is detected live, never hardcoded. Hero's userID comes from the
  // personal getState channel name (holdem<N>#<userID>); name from the frames.
  var heroUserID = null;
  var heroName   = '';

  // Live capture buffer, keyed by hand token (shared by the personal hole-card
  // frame and every public action frame for that hand).
  var liveHands = {};
  var partialsSkipped = 0;

  // userID -> last seen player name, learned from frames.
  var nameByUid = {};

  var lastStatus = '';

  // child table ID -> parent (canonical) table ID, learned from holdemlobby.
  var tableParents = {};
  try {
    var _tp = JSON.parse(localStorage.getItem('tcp_table_parents') || '{}');
    if (_tp && typeof _tp === 'object') tableParents = _tp;
  } catch (e) {}
  function saveTableParents() {
    try { localStorage.setItem('tcp_table_parents', JSON.stringify(tableParents)); } catch (e) {}
  }

  // --------------------------------------------------------------------------
  // Card conversion — Torn ships cards as "suitword-rank", e.g. "diamonds-6",
  // "spades-Q", "spades-10". Convert to the app format "rank+suit-letter":
  // "6d", "Qs", "Ts". Also tolerates a few other shapes defensively.
  // --------------------------------------------------------------------------
  var SUIT_WORD_TO_CODE = {
    diamonds: 'd', hearts: 'h', spades: 's', clubs: 'c',
    diamond:  'd', heart:  'h', spade:  's', club:  'c'
  };
  function rankToApp(r) { r = String(r).toUpperCase(); return r === '10' ? 'T' : r; }
  function suitToCode(s) {
    s = String(s).toLowerCase();
    if (SUIT_WORD_TO_CODE[s]) return SUIT_WORD_TO_CODE[s];
    var c = s.charAt(0);
    if (c === 'h' || c === '♥') return 'h';
    if (c === 'd' || c === '♦') return 'd';
    if (c === 's' || c === '♠') return 's';
    if (c === 'c' || c === '♣') return 'c';
    return null;
  }
  function cardToApp(card) {
    if (card == null) return null;
    if (typeof card === 'object') {
      var r = card.rank != null ? card.rank : (card.value != null ? card.value : card.number);
      var s = card.suit;
      if (r != null && s != null) { var cc = suitToCode(s); return cc ? rankToApp(r) + cc : null; }
      card = card.card || card.code || card.short || null;
    }
    if (typeof card !== 'string') return null;
    var str = card.trim();
    if (!str) return null;
    var m;
    // Primary: "suitword-rank"  e.g. diamonds-6, spades-10
    m = str.match(/^([A-Za-z]+)-(10|[2-9]|[AaKkQqJjTt])$/);
    if (m) { var c1 = suitToCode(m[1]); return c1 ? rankToApp(m[2]) + c1 : null; }
    // "rank-suitword"
    m = str.match(/^(10|[2-9]|[AaKkQqJjTt])-([A-Za-z]+)$/);
    if (m) { var c2 = suitToCode(m[2]); return c2 ? rankToApp(m[1]) + c2 : null; }
    // "rank+suit" no dash  e.g. 10diamonds, Qh, 6♥
    m = str.match(/^(10|[2-9]|[AaKkQqJjTt])\s*([A-Za-z♠♥♦♣]+)$/);
    if (m) { var c3 = suitToCode(m[2]); return c3 ? rankToApp(m[1]) + c3 : null; }
    // "suit+rank" no dash
    m = str.match(/^([A-Za-z♠♥♦♣]+)\s*(10|[2-9]|[AaKkQqJjTt])$/);
    if (m) { var c4 = suitToCode(m[1]); return c4 ? rankToApp(m[2]) + c4 : null; }
    return null;
  }
  function cardsToApp(arr) {
    if (!Array.isArray(arr)) return [];
    var out = [];
    for (var i = 0; i < arr.length; i++) { var c = cardToApp(arr[i]); if (c) out.push(c); }
    return out;
  }

  // --------------------------------------------------------------------------
  // Channel / table identity
  // --------------------------------------------------------------------------
  // "holdem71" -> { tableId: 71, userID: null }
  // "holdem71#3583736" -> { tableId: 71, userID: 3583736 }  (hero's personal channel)
  function parseChannel(channel) {
    var m = String(channel || '').match(/^holdem(\d+)(?:#(\d+))?$/);
    if (!m) return null;
    return { tableId: Number(m[1]), userID: m[2] ? Number(m[2]) : null };
  }
  function canonicalTableId(id) {
    if (id == null) return id;
    var n = Number(id);
    if (!isFinite(n) || !n) return id;
    return tableParents[n] || n;
  }
  function handleLobby(message) {
    if (!message) return;
    var groups = [message.tables, message.tournaments, message.tsop];
    var changed = false;
    for (var g = 0; g < groups.length; g++) {
      var arr = groups[g];
      if (!Array.isArray(arr)) continue;
      for (var i = 0; i < arr.length; i++) {
        var t = arr[i];
        if (!t || t.ID == null) continue;
        var pid = (t.parentID && t.parentID !== 0) ? t.parentID : null;
        if (pid != null && tableParents[t.ID] !== pid) { tableParents[t.ID] = pid; changed = true; }
      }
    }
    if (changed) saveTableParents();
  }

  // --------------------------------------------------------------------------
  // Player helpers — a player is "in the hand" if seated and not sitting out.
  // --------------------------------------------------------------------------
  function isInHand(p) {
    return !!(p && p.userID != null && !p.isSitOut && p.status !== 'Sitting out');
  }
  function seatedCount(players) {
    var n = 0;
    for (var k in players) {
      if (!Object.prototype.hasOwnProperty.call(players, k)) continue;
      if (isInHand(players[k])) n++;
    }
    return n;
  }
  function findPlayerByUserID(players, uid) {
    if (!players || uid == null) return null;
    for (var k in players) {
      if (!Object.prototype.hasOwnProperty.call(players, k)) continue;
      var p = players[k];
      if (p && Number(p.userID) === Number(uid)) return p;
    }
    return null;
  }
  function nameFor(uid) {
    if (uid == null) return 'Unknown';
    return nameByUid[uid] || ('#' + uid);
  }

  // Canonical labels by offset from the button. Blinds/button are exact (flags);
  // the middle seats are interpolated and approximate.
  function positionLabels(n) {
    var base = ['BTN', 'SB', 'BB'];
    if (n <= 3) return base.slice(0, n);
    var mid = n - 3;
    var early = ['UTG', 'UTG+1', 'MP'];
    var late  = ['LJ', 'HJ', 'CO'];
    var frontN = Math.ceil(mid / 2);
    var backN  = mid - frontN;
    return base.concat(early.slice(0, frontN)).concat(late.slice(late.length - backN));
  }
  function derivePosition(players, heroUid) {
    var hero = findPlayerByUserID(players, heroUid);
    if (!hero) return null;
    if (hero.isBigBlind)   return 'BB';
    if (hero.isSmallBlind) return 'SB';
    if (hero.isDealer)     return 'BTN';
    var seats = [];
    for (var k in players) {
      if (!Object.prototype.hasOwnProperty.call(players, k)) continue;
      if (isInHand(players[k])) seats.push(players[k]);
    }
    if (!seats.length) return null;
    seats.sort(function (a, b) { return (a.place || 0) - (b.place || 0); });
    var dealerIdx = -1, heroIdx = -1;
    for (var i = 0; i < seats.length; i++) {
      if (seats[i].isDealer) dealerIdx = i;
      if (Number(seats[i].userID) === Number(heroUid)) heroIdx = i;
    }
    if (dealerIdx === -1 || heroIdx === -1) return null;
    var n = seats.length;
    var offset = (heroIdx - dealerIdx + n) % n;
    var labels = positionLabels(n);
    return labels[offset] || null;
  }

  // --------------------------------------------------------------------------
  // Live capture
  //   * Personal getState (holdem<N>#<uid>): hero's hole cards + token.
  //   * Public getState / playerMakeMove (holdem<N>): full table state.
  //   Buffers are keyed by token; finalized on the playerMakeMove ended frame.
  // --------------------------------------------------------------------------
  function bufFor(token) {
    if (token == null) return null;
    var t = String(token);
    return liveHands[t] || (liveHands[t] = {
      token: t, frames: [], frameTimes: [], hole: [], tableId: null, heroUserID: null
    });
  }

  function streetFromBoard(len) {
    if (len >= 5) return 'River';
    if (len === 4) return 'Turn';
    if (len === 3) return 'Flop';
    return 'Preflop';
  }
  function mapUserAction(userAction) {
    switch ((userAction || '').toLowerCase()) {
      case 'fold':       return 'fold';
      case 'check':      return 'check';
      case 'call':       return 'call';
      case 'callany':    return 'call';
      case 'raise':      return 'raise';
      case 'raiseto':    return 'raise';
      case 'bet':        return 'bet';
      case 'allin':      return 'raise';
      case 'all in':     return 'raise';
      default:           return null;
    }
  }

  // Strip the chatLog (the human-readable action/chat log) from a getState frame
  // before we keep it — we reconstruct only from the structured player state.
  function sanitizeFrame(m) {
    if (!m || typeof m !== 'object' || m.chatLog === undefined) return m;
    var c = {};
    for (var k in m) { if (k === 'chatLog') continue; if (Object.prototype.hasOwnProperty.call(m, k)) c[k] = m[k]; }
    return c;
  }

  // Hero's hole cards + token, from the personal getState channel.
  function handlePersonalState(uid, message) {
    if (uid != null) heroUserID = uid;
    var buf = bufFor(message.token);
    if (!buf) return;
    buf.heroUserID = heroUserID;
    if (Array.isArray(message.hand) && message.hand.length) buf.hole = message.hand.slice();
  }

  // A public table frame (getState snapshot or playerMakeMove). Only frames that
  // carry a full `players` map are kept; updatePlayer/removePlayer are ignored.
  function handleTableFrame(tableId, message) {
    var players = message.players;
    if (!players || typeof players !== 'object') return;

    for (var k in players) {
      if (!Object.prototype.hasOwnProperty.call(players, k)) continue;
      var p = players[k];
      if (p && p.userID != null && p.playername) nameByUid[p.userID] = p.playername;
    }
    if (heroUserID != null && !heroName) {
      var h = findPlayerByUserID(players, heroUserID);
      if (h && h.playername) heroName = h.playername;
    }

    var buf = bufFor(message.token);
    if (!buf) return;
    if (buf.tableId == null) buf.tableId = canonicalTableId(tableId);
    if (buf.heroUserID == null) buf.heroUserID = heroUserID;

    buf.frames.push(sanitizeFrame(message));
    buf.frameTimes.push(Date.now());

    if (message.eventType === 'playerMakeMove' && message.gameStatus === 'ended') {
      var hand = null;
      try { hand = reconstructHand(buf); } catch (e) { console.warn('[TC Poker] reconstruct failed', e); }
      delete liveHands[String(message.token)];
      if (hand) persistHand(hand);
    }
  }

  // Reconstruct a structured v2 hand from a buffer of public frames.
  function reconstructHand(buf) {
    var frames = buf.frames || [];
    var frameTimes = buf.frameTimes || [];
    var heroUid = buf.heroUserID != null ? buf.heroUserID : heroUserID;
    if (!frames.length) return null;

    var firstFrame = frames[0];
    var firstPlayers = firstFrame.players || {};
    var startedAtPreflop = (firstFrame.communityCards || []).length === 0;

    // Torn frames carry no per-hand timestamp; stamp with capture time (ms).
    var handTs = Date.now();

    var tableId = buf.tableId != null ? buf.tableId : null;
    var bigBlind = firstFrame.bigBlind != null ? firstFrame.bigBlind : null;

    var actions = [];
    var prevTurn = null;
    var prevStreet = null;
    var prevMoneyByUid = {};

    // Per-player stacks: start = money+pot the first frame we see the seat (their
    // full stack), end = money in the most recent frame (post-payout on the
    // ended frame, which is the correct stack after the hand). `invested` accrues
    // every drop in `money` plus whatever was already committed the first frame.
    var stackByUid = {};
    var board = firstFrame.communityCards || [];      // track the LONGEST board seen
    var lastTotalPot = firstFrame.totalPot != null ? firstFrame.totalPot : null;

    for (var f = 0; f < frames.length; f++) {
      var msg = frames[f];
      var players = msg.players || {};
      var fb = msg.communityCards || [];
      if (fb.length > board.length) board = fb;        // never shrink (ended frame = [])
      var street = streetFromBoard(fb.length);
      if (msg.totalPot != null) lastTotalPot = msg.totalPot;
      if (msg.bigBlind != null && bigBlind == null) bigBlind = msg.bigBlind;

      for (var sk in players) {
        if (!Object.prototype.hasOwnProperty.call(players, sk)) continue;
        var sp = players[sk];
        if (!isInHand(sp)) continue;
        var uid = sp.userID;
        var money = sp.money != null ? sp.money : 0;
        var pot = sp.pot != null ? sp.pot : 0;
        if (!stackByUid[uid]) {
          stackByUid[uid] = {
            userID: uid, name: sp.playername || nameFor(uid),
            startStack: money + pot, endStack: money,
            invested: pot, _lastMoney: money
          };
        } else {
          var prevM = stackByUid[uid]._lastMoney;
          if (prevM != null && money < prevM) stackByUid[uid].invested += (prevM - money);
          stackByUid[uid]._lastMoney = money;
          stackByUid[uid].endStack = money;
          if (sp.playername) stackByUid[uid].name = sp.playername;
        }
      }

      // First frame: emit the posted blinds from the seat flags.
      if (f === 0 && startedAtPreflop) {
        for (var bk in players) {
          if (!Object.prototype.hasOwnProperty.call(players, bk)) continue;
          var bp = players[bk];
          if (!isInHand(bp)) continue;
          if (bp.isSmallBlind) actions.push({
            author: bp.playername || nameFor(bp.userID),
            isMe: Number(bp.userID) === Number(heroUid),
            street: 'Preflop', type: 'sb',
            amount: bp.pot != null ? bp.pot : (bigBlind != null ? Math.round(bigBlind / 2) : 0),
            raiseTo: null, allIn: bp.status === 'All in', actedMs: null
          });
          if (bp.isBigBlind) actions.push({
            author: bp.playername || nameFor(bp.userID),
            isMe: Number(bp.userID) === Number(heroUid),
            street: 'Preflop', type: 'bb',
            amount: bp.pot != null ? bp.pot : (bigBlind != null ? bigBlind : 0),
            raiseTo: null, allIn: bp.status === 'All in', actedMs: null
          });
        }
      }

      // Attribute the move in THIS frame to the PREVIOUS frame's `turn`. The
      // action's street is the PREVIOUS frame's board: the frame that shows a new
      // board is produced by the action that CLOSED the prior street.
      var actorUid = (prevTurn != null) ? prevTurn : null;
      if (actorUid != null && msg.userAction) {
        var actorP = findPlayerByUserID(players, actorUid);
        var type = mapUserAction(msg.userAction);
        if (type) {
          var curMoney = actorP && actorP.money != null ? actorP.money : null;
          var prevMoney = prevMoneyByUid[actorUid];
          var curPot = actorP && actorP.pot != null ? actorP.pot : 0;
          var amount = 0;
          if (type !== 'fold' && type !== 'check') {
            if (curMoney != null && prevMoney != null && prevMoney > curMoney) amount = prevMoney - curMoney;
            else amount = curPot;
          }
          var isAllIn = !!(actorP && actorP.status === 'All in') ||
                        (msg.userAction || '').toLowerCase() === 'allin';
          var raiseTo = (type === 'raise' || type === 'bet') ? curPot : null;
          actions.push({
            author: actorP ? (actorP.playername || nameFor(actorUid)) : nameFor(actorUid),
            isMe: Number(actorUid) === Number(heroUid),
            street: prevStreet || street,
            type: type,
            amount: (type === 'fold' || type === 'check') ? 0 : amount,
            raiseTo: raiseTo,
            allIn: isAllIn,
            actedMs: (f > 0 && frameTimes[f] != null && frameTimes[f - 1] != null)
                   ? (frameTimes[f] - frameTimes[f - 1]) : null
          });
        }
      }

      for (var s3 in players) {
        if (!Object.prototype.hasOwnProperty.call(players, s3)) continue;
        var p3 = players[s3];
        if (p3 && p3.userID != null && p3.money != null) prevMoneyByUid[p3.userID] = p3.money;
      }
      prevTurn = msg.turn;
      prevStreet = street;
    }

    // Finalize from the ended frame (the last frame).
    var endFrame = frames[frames.length - 1];
    var endPlayers = endFrame.players || {};
    var heroP = findPlayerByUserID(endPlayers, heroUid);

    var outcome;
    var heroWin = heroP && heroP.winnings != null ? heroP.winnings : 0;
    if (heroWin > 0) {
      outcome = { result: 'won', amount: heroWin };
    } else {
      var heroFolded = heroP && (heroP.status === 'Folded' || heroP.status === 'Fold');
      var heroRevealed = heroP && Array.isArray(heroP.hand) && heroP.hand.length;
      outcome = (heroFolded && !heroRevealed) ? { result: 'folded', amount: 0 } : { result: 'lost', amount: 0 };
    }

    var revealedCount = 0;
    for (var sd in endPlayers) {
      if (!Object.prototype.hasOwnProperty.call(endPlayers, sd)) continue;
      var sdp = endPlayers[sd];
      if (sdp && Array.isArray(sdp.hand) && sdp.hand.length >= 2) revealedCount++;
    }
    var showdown = revealedCount >= 2;

    // Enrich every seat's record from the final frame.
    for (var eu in stackByUid) {
      if (!Object.prototype.hasOwnProperty.call(stackByUid, eu)) continue;
      var rec = stackByUid[eu];
      var ep = findPlayerByUserID(endPlayers, rec.userID) || findPlayerByUserID(firstPlayers, rec.userID);
      rec.position = derivePosition(firstPlayers, rec.userID);
      rec.winnings = ep && ep.winnings != null ? ep.winnings : 0;
      rec.profit = (rec.winnings || 0) - (rec.invested || 0);
      rec.status = ep && ep.status != null ? ep.status : null;
      rec.isDealer = !!(ep && ep.isDealer);
      rec.isSmallBlind = !!(ep && ep.isSmallBlind);
      rec.isBigBlind = !!(ep && ep.isBigBlind);
      var rev = ep && Array.isArray(ep.hand) ? cardsToApp(ep.hand) : [];
      rec.revealed = rev.length >= 2 ? rev : [];
      rec.handName = ep && ep.handName != null ? ep.handName
                   : (ep && ep.bestCombination != null ? ep.bestCombination : null);
      rec.isHero = Number(rec.userID) === Number(heroUid);
      delete rec._lastMoney;
    }
    var stacks = [];
    for (var su in stackByUid) {
      if (!Object.prototype.hasOwnProperty.call(stackByUid, su)) continue;
      stacks.push(stackByUid[su]);
    }
    var heroStack = heroUid != null ? stackByUid[heroUid] : null;

    var heroHole = cardsToApp(buf.hole && buf.hole.length ? buf.hole : (heroP && heroP.hand) || []);

    return {
      timestamp: handTs,
      heroUserID: heroUid != null ? heroUid : null,
      position: derivePosition(firstPlayers, heroUid),
      hole: heroHole,
      board: cardsToApp(board),
      pot: lastTotalPot != null ? lastTotalPot : null,
      invested: heroStack ? heroStack.invested : 0,
      outcome: outcome,
      showdown: showdown,
      tableSize: seatedCount(firstPlayers) || seatedCount(endPlayers),
      bigBlind: bigBlind,
      tableId: tableId,
      table: tableId != null ? ('Table ' + tableId) : null,
      actions: actions,
      startStack: heroStack ? heroStack.startStack : null,
      endStack: heroStack ? heroStack.endStack : null,
      stacks: stacks,
      _v2: true,
      _live: true,
      _partial: !startedAtPreflop,
      // Structured player frames (chatLog stripped), kept so fields can be
      // re-derived later without re-migrating. Scoped to YOUR hand at the table
      // you are playing. Stripped from exports.
      _raw: { hole: buf.hole || [], frames: frames, frameTimes: frameTimes }
    };
  }

  // --------------------------------------------------------------------------
  // WebSocket inspection — read-only. All poker data is on the socket.
  // --------------------------------------------------------------------------
  function inspectWsData(data) {
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

    if (channel === 'holdemlobby' || Array.isArray(message.tables)) { handleLobby(message); return; }

    var ch = parseChannel(channel);
    if (!ch) return;

    if (ch.userID != null) {
      // Personal channel: hero's hole cards (getState only).
      if (message.eventType === 'getState') handlePersonalState(ch.userID, message);
      return;
    }
    // Public table channel.
    handleTableFrame(ch.tableId, message);
  }

  // Patch the WebSocket prototype (addEventListener + onmessage setter) — proven
  // to catch Torn's socket however the page listens.
  try {
    var _addEL = window.WebSocket && window.WebSocket.prototype.addEventListener;
    if (_addEL) {
      window.WebSocket.prototype.addEventListener = function (type, listener, options) {
        if (type === 'message') {
          var wrapped = function (e) { try { inspectWsData(e.data); } catch (_) {} return listener.call(this, e); };
          return _addEL.call(this, type, wrapped, options);
        }
        return _addEL.call(this, type, listener, options);
      };
    }
    var _onmsgDesc = window.WebSocket &&
      Object.getOwnPropertyDescriptor(window.WebSocket.prototype, 'onmessage');
    if (_onmsgDesc && _onmsgDesc.set) {
      Object.defineProperty(window.WebSocket.prototype, 'onmessage', {
        configurable: true,
        get: _onmsgDesc.get,
        set: function (fn) {
          _onmsgDesc.set.call(this, function (e) {
            try { inspectWsData(e.data); } catch (_) {}
            if (fn) return fn.call(this, e);
          });
        }
      });
    }
  } catch (e) { /* never break the page */ }

  // --------------------------------------------------------------------------
  // LEGACY IMPORT — convert old v4.9 TEXT hands once (best-effort, defensive).
  // --------------------------------------------------------------------------
  function parseAmount(str) { var n = parseInt(String(str || '').replace(/[^0-9]/g, ''), 10); return isFinite(n) ? n : 0; }

  function parseActions(actionsArr) {
    if (!Array.isArray(actionsArr)) return [];
    if (actionsArr.length && typeof actionsArr[0] === 'object' && actionsArr[0] !== null) return actionsArr;
    var out = [];
    var street = 'Preflop';
    for (var n = 0; n < actionsArr.length; n++) {
      var raw = String(actionsArr[n] || '');
      var isMe = raw.indexOf('>>') === 0;
      var line = raw.replace(/^>>\s*/, '').replace(/^\s+/, '').trim();
      if (line.indexOf('The flop') === 0)    { street = 'Flop';    continue; }
      if (line.indexOf('The turn') === 0)    { street = 'Turn';    continue; }
      if (line.indexOf('The river') === 0)   { street = 'River';   continue; }
      if (line.indexOf('The preflop') === 0) { street = 'Preflop'; continue; }
      var ci = line.indexOf(': ');
      if (ci === -1) continue;
      var author = line.slice(0, ci).trim();
      var rest = line.slice(ci + 2).trim();
      var low = rest.toLowerCase();
      var type = null, amount = 0, raiseTo = null, allIn = false;
      if (low.indexOf('fold') === 0)              { type = 'fold'; }
      else if (low.indexOf('check') === 0)        { type = 'check'; }
      else if (low.indexOf('small blind') !== -1) { type = 'sb'; amount = parseAmount(rest); }
      else if (low.indexOf('big blind') !== -1)   { type = 'bb'; amount = parseAmount(rest); }
      else if (low.indexOf('call') === 0)         { type = 'call'; amount = parseAmount(rest); }
      else if (low.indexOf('bet') === 0)          { type = 'bet'; amount = parseAmount(rest); raiseTo = amount; }
      else if (low.indexOf('raise') === 0)        { type = 'raise'; amount = parseAmount(rest); raiseTo = amount; }
      else if (low.indexOf('win') === 0)          { type = 'won'; amount = parseAmount(rest); }
      else continue;
      if (low.indexOf('all') !== -1 && low.indexOf('in') !== -1) allIn = true;
      out.push({ author: author, isMe: isMe, street: street, type: type, amount: amount, raiseTo: raiseTo, allIn: allIn });
    }
    return out;
  }
  function calcInvestmentFromActions(acts, heroAuthor) {
    var invested = 0;
    for (var i = 0; i < acts.length; i++) {
      var a = acts[i];
      var mine = a.isMe || (heroAuthor && a.author === heroAuthor);
      if (mine && a.type !== 'won' && a.type !== 'fold' && a.type !== 'check') invested += a.amount || 0;
    }
    return invested;
  }
  function convertHand(legacy) {
    legacy = legacy || {};
    var acts = parseActions(legacy.actions || []);
    var heroAuthor = null;
    for (var i = 0; i < acts.length; i++) { if (acts[i].isMe) { heroAuthor = acts[i].author; break; } }
    var hole = cardsToApp(legacy.hole || legacy.cards || legacy.holeCards || []);
    var boardL = cardsToApp(legacy.board || legacy.community || legacy.communityCards || []);
    var outcome = legacy.outcome;
    if (!outcome) {
      if (legacy.result) outcome = { result: String(legacy.result).toLowerCase(), amount: parseAmount(legacy.won || legacy.winnings || 0) };
      else {
        var wonAct = null;
        for (var w = 0; w < acts.length; w++) { if (acts[w].type === 'won' && (acts[w].isMe || acts[w].author === heroAuthor)) wonAct = acts[w]; }
        outcome = wonAct ? { result: 'won', amount: wonAct.amount || 0 } : { result: 'lost', amount: 0 };
      }
    }
    var ts = legacy.timestamp != null ? Number(legacy.timestamp) : (legacy.time != null ? Number(legacy.time) : Date.now());
    if (ts < 1e12) ts *= 1000;
    return { structured: {
      timestamp: ts, position: legacy.position || null, hole: hole, board: boardL,
      pot: legacy.pot != null ? legacy.pot : null,
      invested: legacy.invested != null ? legacy.invested : calcInvestmentFromActions(acts, heroAuthor),
      outcome: outcome,
      showdown: typeof legacy.showdown === 'boolean' ? legacy.showdown : false,
      tableSize: legacy.tableSize != null ? legacy.tableSize : null,
      bigBlind: legacy.bigBlind != null ? legacy.bigBlind : null,
      tableId: legacy.tableId != null ? legacy.tableId : null,
      table: legacy.table != null ? legacy.table : null,
      actions: acts,
      startStack: legacy.startStack != null ? legacy.startStack : null,
      endStack: legacy.endStack != null ? legacy.endStack : null,
      stacks: legacy.stacks || [],
      _v2: true, _legacy: true
    } };
  }

  // --------------------------------------------------------------------------
  // IndexedDB
  // --------------------------------------------------------------------------
  function openDB(name, createStore) {
    return new Promise(function (resolve, reject) {
      var req = indexedDB.open(name);
      req.onupgradeneeded = function (e) {
        var db = e.target.result;
        if (createStore && !db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { autoIncrement: true });
      };
      req.onsuccess = function (e) { resolve(e.target.result); };
      req.onerror = function () { reject(req.error); };
    });
  }
  function openStoreDB() { return openDB(DB, true); }
  function getAll(db, store) {
    return new Promise(function (resolve, reject) {
      try {
        var req = db.transaction([store], 'readonly').objectStore(store).getAll();
        req.onsuccess = function () { resolve(req.result || []); };
        req.onerror = function () { reject(req.error); };
      } catch (e) { resolve([]); }
    });
  }
  function getAllFirstStore(db) {
    var names = db.objectStoreNames;
    if (!names || !names.length) return Promise.resolve([]);
    return getAll(db, names[0]);
  }
  function countStore() {
    return openStoreDB().then(function (db) {
      return new Promise(function (resolve) {
        try {
          var req = db.transaction([STORE], 'readonly').objectStore(STORE).count();
          req.onsuccess = function () { db.close(); resolve(req.result || 0); };
          req.onerror = function () { db.close(); resolve(0); };
        } catch (e) { try { db.close(); } catch (_) {} resolve(0); }
      });
    });
  }
  function persistHand(hand) {
    if (!hand || !Array.isArray(hand.hole) || hand.hole.length !== 2) return;
    if (hand._partial) { partialsSkipped++; setStatus('Skipped a partial hand (joined mid-hand).'); return; }
    openStoreDB().then(function (db) {
      var tx = db.transaction([STORE], 'readwrite');
      tx.objectStore(STORE).add(hand);
      tx.oncomplete = function () { db.close(); refreshTrigger(); };
      tx.onerror = function () { db.close(); };
    }).catch(function () {});
  }
  function clearStore() {
    return openStoreDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction([STORE], 'readwrite');
        tx.objectStore(STORE).clear();
        tx.oncomplete = function () { db.close(); resolve(); };
        tx.onerror = function () { db.close(); reject(tx.error); };
      });
    });
  }
  function importHistoryOnce() {
    if (localStorage.getItem(IMPORT_FLAG)) return Promise.resolve({ skipped: true, added: 0 });
    var srcRows = [];
    return openDB(SRC_DB, false)
      .then(function (db) { return getAllFirstStore(db).then(function (rows) { db.close(); return rows; }); })
      .then(function (rows) { srcRows = rows || []; return openStoreDB(); })
      .then(function (db) {
        return getAll(db, STORE).then(function (existing) {
          var seen = {};
          for (var i = 0; i < existing.length; i++) if (existing[i] && existing[i].timestamp != null) seen[existing[i].timestamp] = true;
          return new Promise(function (resolve, reject) {
            var tx = db.transaction([STORE], 'readwrite');
            var store = tx.objectStore(STORE);
            var added = 0;
            for (var j = 0; j < srcRows.length; j++) {
              var legacy = JSON.parse(JSON.stringify(srcRows[j]));
              if (legacy.timestamp != null && seen[legacy.timestamp]) continue;
              try { store.add(convertHand(legacy).structured); added++; } catch (e) {}
            }
            tx.oncomplete = function () { db.close(); try { localStorage.setItem(IMPORT_FLAG, String(Date.now())); } catch (e) {} resolve({ skipped: false, added: added }); };
            tx.onerror = function () { db.close(); reject(tx.error); };
          });
        });
      });
  }
  function purgeForeignHands() {
    if (localStorage.getItem('tcp_purged_foreign')) return Promise.resolve(0);
    return openStoreDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction([STORE], 'readwrite');
        var req = tx.objectStore(STORE).openCursor();
        var removed = 0;
        req.onsuccess = function (e) {
          var c = e.target.result;
          if (!c) return;
          var h = c.value;
          if (!h || !Array.isArray(h.hole) || h.hole.length !== 2) { c.delete(); removed++; }
          c.continue();
        };
        tx.oncomplete = function () { db.close(); try { localStorage.setItem('tcp_purged_foreign', '1'); } catch (e) {} resolve(removed); };
        tx.onerror = function () { db.close(); reject(tx.error); };
      });
    });
  }

  // --------------------------------------------------------------------------
  // DELIVERY
  // --------------------------------------------------------------------------
  function downloadFile(filename, text) {
    try {
      var blob = new Blob([text], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click();
      setTimeout(function () { try { document.body.removeChild(a); URL.revokeObjectURL(url); } catch (e) {} }, 0);
      return true;
    } catch (e) { return false; }
  }
  var APP_URL = 'https://poker.systoned.cc/';
  function buildV2Envelope(hands) {
    return { schemaVersion: 2, player: heroName || 'Unknown', exportedAt: new Date().toISOString(), hands: hands || [] };
  }
  // Drop the heavy raw payload (and internal bookkeeping) from exported hands.
  function stripForExport(h) {
    if (!h || typeof h !== 'object') return h;
    var c = {};
    for (var k in h) { if (!Object.prototype.hasOwnProperty.call(h, k)) continue; if (k === '_raw') continue; c[k] = h[k]; }
    if (Array.isArray(c.stacks)) c.stacks = c.stacks.map(function (s) { var t = {}; for (var kk in s) { if (kk !== '_lastMoney') t[kk] = s[kk]; } return t; });
    return c;
  }
  // Re-derive a stored hand's structured fields from retained raw frames, with
  // the CURRENT extractor. Future-proofs the data: improve the parser, re-export,
  // and every hand that still has _raw is upgraded — no replay, no re-migration.
  function rederiveHand(record) {
    if (!record) return record;
    if (!record._raw || !Array.isArray(record._raw.frames) || !record._raw.frames.length) return stripForExport(record);
    var buf = {
      token: 'rederive', tableId: record.tableId,
      heroUserID: record.heroUserID != null ? record.heroUserID : heroUserID,
      hole: record._raw.hole || record.hole || [],
      frames: record._raw.frames, frameTimes: record._raw.frameTimes || []
    };
    try { var h = reconstructHand(buf); return h ? stripForExport(h) : stripForExport(record); }
    catch (e) { return stripForExport(record); }
  }
  function prepareExportHands(rows) {
    var out = [];
    for (var i = 0; i < (rows || []).length; i++) { var r = rederiveHand(rows[i]); if (r) out.push(r); }
    return out;
  }
  function syncToApp() {
    return openStoreDB()
      .then(function (db) { return getAll(db, STORE).then(function (rows) { db.close(); return rows; }); })
      .then(function (rows) {
        var hands = prepareExportHands(rows || []);
        var text = JSON.stringify(buildV2Envelope(hands));
        var ok = false;
        try { if (typeof GM_setClipboard === 'function') { GM_setClipboard(text); ok = true; } } catch (e) {}
        try { window.open(APP_URL, '_blank'); } catch (e) {}
        setStatus((ok ? 'Copied ' : 'Clipboard failed for ') + hands.length + ' hands — opened app, paste there');
      });
  }
  function exportData() {
    return openStoreDB()
      .then(function (db) { return getAll(db, STORE).then(function (rows) { db.close(); return rows; }); })
      .then(function (rows) {
        var hands = prepareExportHands(rows || []);
        var text = JSON.stringify(buildV2Envelope(hands));
        var ok = downloadFile('tcp-data-export-' + new Date().toISOString().replace(/[:.]/g, '-') + '.json', text);
        setStatus((ok ? 'Saved file: ' : 'Save failed: ') + hands.length + ' hands (' + Math.round(text.length / 1024) + ' KB) — open app + upload it');
      });
  }
  function openApp() { try { window.open(APP_URL, '_blank'); } catch (e) {} setStatus('Opened app — use "Upload hand files"'); }

  // --------------------------------------------------------------------------
  // UI
  // --------------------------------------------------------------------------
  function setStatus(text) {
    lastStatus = text || '';
    var el = document.getElementById('tc-status');
    if (el && lastStatus) { el.style.display = 'block'; el.textContent = lastStatus; }
  }
  function refreshTrigger() {
    var btn = document.getElementById('tc-trigger');
    if (!btn) return;
    countStore().then(function (n) { btn.textContent = 'TC Poker Tracker · ' + n + ' hand' + (n !== 1 ? 's' : ''); });
  }
  function dropBtn(id, label, colour, disabled, extra) {
    return '<button id="' + id + '" style="padding:8px 14px;border-radius:4px;' +
      'border:1px solid ' + colour + ';background:transparent;color:' + colour + ';' +
      'cursor:pointer;font-size:11px;font-family:Georgia,serif;width:100%;text-align:center;' +
      (extra || '') + '"' + (disabled ? ' disabled' : '') + '>' + label + '</button>';
  }
  function wire(id, enabled, fn) { var b = document.getElementById(id); if (b && enabled) b.onclick = fn; }
  function toggleDropdown() {
    var existing = document.getElementById('tc-dropdown');
    if (existing) { existing.remove(); return; }
    var trigger = document.getElementById('tc-trigger');
    if (!trigger) return;
    countStore().then(function (count) {
      var none = count === 0;
      var drop = document.createElement('div');
      drop.id = 'tc-dropdown';
      drop.style.cssText = [
        'position:absolute', 'top:100%', 'left:0', 'margin-top:6px',
        'background:#0c0c0c', 'border:1px solid #242424', 'border-radius:6px',
        'font-family:Georgia,serif', 'padding:16px 18px', 'min-width:300px',
        'box-shadow:0 8px 30px rgba(0,0,0,0.9)', 'z-index:100000'
      ].join(';');
      drop.innerHTML =
        '<div style="font-size:11px;color:#8a7a5a;line-height:1.6;margin-bottom:12px;">' +
          'Records your hands as you play.<br>' +
          'Desktop: <b>Copy to clipboard</b>, then paste in the app.<br>' +
          'Mobile: <b>Export file</b>, then <b>Open app</b> and upload it.' +
        '</div>' +
        '<div style="font-size:12px;color:#c8d4c8;margin-bottom:14px;">' +
          '<strong style="color:#c8a94a;">' + count + '</strong> hands logged' +
        '</div>' +
        '<div id="tc-actions" style="display:flex;flex-direction:column;gap:8px;">' +
          dropBtn('tc-copy',   'Copy to clipboard', '#c8a94a', none) +
          dropBtn('tc-export', 'Export file',       '#7a8a7a', none) +
          dropBtn('tc-open',   'Open app',          '#7a8a7a', false) +
          '<div id="tc-status" style="font-size:11px;color:#8a7a5a;display:none;margin-top:4px;line-height:1.5;"></div>' +
          dropBtn('tc-clear',  'Clear all logged hands', '#6a4a4a', none, 'margin-top:8px;') +
        '</div>';
      trigger.parentNode.appendChild(drop);
      if (lastStatus) setStatus(lastStatus);
      wire('tc-copy',   !none, function () { setStatus('Copying and opening app...'); syncToApp(); });
      wire('tc-export', !none, function () { setStatus('Saving file...'); exportData(); });
      wire('tc-open',   true,  function () { openApp(); });
      wire('tc-clear',  !none, function () { confirmClear(count); });
      setTimeout(function () {
        function outside(e) {
          var d = document.getElementById('tc-dropdown');
          var t = document.getElementById('tc-trigger');
          if (d && !d.contains(e.target) && e.target !== t) { d.remove(); document.removeEventListener('click', outside, true); }
        }
        document.addEventListener('click', outside, true);
      }, 10);
    });
  }
  function confirmClear(count) {
    var actions = document.getElementById('tc-actions');
    if (!actions) return;
    actions.innerHTML =
      '<div style="font-size:11px;color:#c94040;margin-bottom:10px;line-height:1.5;">' +
        'Permanently delete all ' + count + ' logged hands? Export first if you want to keep them.' +
      '</div>' +
      '<div style="display:flex;gap:8px;">' +
        '<button id="tc-confirm" style="flex:1;padding:8px 14px;border-radius:4px;border:1px solid #c94040;background:transparent;color:#c94040;cursor:pointer;font-size:11px;font-family:Georgia,serif;">Yes, clear all</button>' +
        '<button id="tc-cancel" style="flex:1;padding:8px 14px;border-radius:4px;border:1px solid #8a7a5a;background:transparent;color:#8a7a5a;cursor:pointer;font-size:11px;font-family:Georgia,serif;">Cancel</button>' +
      '</div>';
    document.getElementById('tc-confirm').onclick = function () {
      clearStore().then(function () { var d = document.getElementById('tc-dropdown'); if (d) d.remove(); refreshTrigger(); });
    };
    document.getElementById('tc-cancel').onclick = function () { var d = document.getElementById('tc-dropdown'); if (d) d.remove(); toggleDropdown(); };
  }
  function buildPanel() {
    if (document.getElementById('tc-trigger')) return;
    var wrapper = document.createElement('div');
    wrapper.id = 'tc-panel';
    wrapper.style.cssText = 'position:relative;display:inline-block;margin-left:12px;vertical-align:middle;';
    var btn = document.createElement('button');
    btn.id = 'tc-trigger';
    btn.textContent = 'TC Poker Tracker · loading...';
    btn.style.cssText = [
      'background:#0c0c0c', 'border:1px solid #242424', 'border-radius:6px',
      'color:#c8a94a', 'font-family:Georgia,serif', 'font-size:11px',
      'padding:6px 14px', 'cursor:pointer', 'font-weight:bold', 'letter-spacing:0.3px'
    ].join(';');
    btn.onclick = toggleDropdown;
    wrapper.appendChild(btn);
    var linksContainer = document.querySelector('[class*="linksContainer"]');
    if (linksContainer) linksContainer.appendChild(wrapper);
    else { wrapper.style.cssText = 'position:fixed;top:10px;left:50%;transform:translateX(-50%);z-index:99999;'; document.body.appendChild(wrapper); }
    refreshTrigger();
    purgeForeignHands().then(function (removed) { if (removed) refreshTrigger(); }, function () {});
    importHistoryOnce().then(function (r) {
      if (!r.skipped && r.added) { refreshTrigger(); setStatus('Imported ' + r.added + ' hands from your old data.'); }
    }, function (e) { console.warn('[TC Poker] history import failed', e); setStatus('Could not import your old hands.'); });
  }
  function tryBuild() {
    if (document.getElementById('tc-trigger')) return;
    if (window.location.href.indexOf('sid=holdem') === -1) return;
    if (document.querySelector('[class*="linksContainer"]')) buildPanel();
  }

  // --------------------------------------------------------------------------
  // Boot
  // --------------------------------------------------------------------------
  if (document.body) tryBuild();
  document.addEventListener('DOMContentLoaded', tryBuild);
  new MutationObserver(tryBuild).observe(document.documentElement, { childList: true, subtree: true });
})();
