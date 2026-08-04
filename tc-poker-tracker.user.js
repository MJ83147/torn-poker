// ==UserScript==
// @name         TC Poker Export
// @namespace    https://torn.com
// @version      6.0
// @description  Analyse your entire poker play on Torn
// @author       Systoned
// @match        https://www.torn.com/page.php?sid=holdem*
// @match        https://*.torn.com/page.php?sid=holdem*
// @run-at       document-start
// @grant        GM_setClipboard
// @noframes
// @downloadURL https://update.greasyfork.org/scripts/569290/TC%20Poker%20Export.user.js
// @updateURL https://update.greasyfork.org/scripts/569290/TC%20Poker%20Export.meta.js
// ==/UserScript==

(function () {
  "use strict";

  // Only run on the poker page. Everything below (WebSocket hooks, observer,
  // panel) is skipped everywhere else on torn.com.
  if (window.location.href.indexOf("sid=holdem") === -1) return;

  // --------------------------------------------------------------------------
  // Config
  // --------------------------------------------------------------------------
  var SRC_DB = "tc_poker_tm"; // old v4.9 capture DB. Read only.
  var DB = "tcp_data_export"; // our store. All writes go here.
  var STORE = "hands"; // autoIncrement store, NO inline keys
  // Export-ready copies (stripped, no _raw), maintained at capture time so the
  // Copy/Export buttons never parse anything: they only read + stringify.
  var EXPORT_STORE = "export";
  var IMPORT_FLAG = "tcp_data_export_history_imported";
  // Bump when reconstructHand's output changes: the export cache is rebuilt
  // from _raw once, in the background, on the next page load.
  var PARSER_VERSION = 1;
  var CACHE_FLAG = "tcp_export_cache_version";

  // The player is detected live, never hardcoded. Hero's userID comes from the
  // personal getState channel name (holdem<N>#<userID>); name from the frames.
  var heroUserID = null;
  var heroName = "";

  // Live capture buffer, keyed by hand token (shared by the personal hole-card
  // frame and every public action frame for that hand).
  var liveHands = {};
  var partialsSkipped = 0;

  // userID -> last seen player name, learned from frames.
  var nameByUid = {};

  var lastStatus = "";

  // child table ID -> parent (canonical) table ID, learned from holdemlobby.
  var tableParents = {};
  try {
    var _tp = JSON.parse(localStorage.getItem("tcp_table_parents") || "{}");
    if (_tp && typeof _tp === "object") tableParents = _tp;
  } catch (e) {}
  function saveTableParents() {
    try {
      localStorage.setItem("tcp_table_parents", JSON.stringify(tableParents));
    } catch (e) {}
  }

  // --------------------------------------------------------------------------
  // Card conversion — Torn ships cards as "suitword-rank", e.g. "diamonds-6",
  // "spades-Q", "spades-10". Convert to the app format "rank+suit-letter":
  // "6d", "Qs", "Ts". Also tolerates a few other shapes defensively.
  // --------------------------------------------------------------------------
  var SUIT_WORD_TO_CODE = {
    diamonds: "d",
    hearts: "h",
    spades: "s",
    clubs: "c",
    diamond: "d",
    heart: "h",
    spade: "s",
    club: "c",
  };
  function rankToApp(r) {
    r = String(r).toUpperCase();
    return r === "10" ? "T" : r;
  }
  function suitToCode(s) {
    s = String(s).toLowerCase();
    if (SUIT_WORD_TO_CODE[s]) return SUIT_WORD_TO_CODE[s];
    var c = s.charAt(0);
    if (c === "h" || c === "♥") return "h";
    if (c === "d" || c === "♦") return "d";
    if (c === "s" || c === "♠") return "s";
    if (c === "c" || c === "♣") return "c";
    return null;
  }
  function cardToApp(card) {
    if (card == null) return null;
    if (typeof card === "object") {
      var r =
        card.rank != null
          ? card.rank
          : card.value != null
            ? card.value
            : card.number;
      var s = card.suit;
      if (r != null && s != null) {
        var cc = suitToCode(s);
        return cc ? rankToApp(r) + cc : null;
      }
      card = card.card || card.code || card.short || null;
    }
    if (typeof card !== "string") return null;
    var str = card.trim();
    if (!str) return null;
    var m;
    // Primary: "suitword-rank"  e.g. diamonds-6, spades-10
    m = str.match(/^([A-Za-z]+)-(10|[2-9]|[AaKkQqJjTt])$/);
    if (m) {
      var c1 = suitToCode(m[1]);
      return c1 ? rankToApp(m[2]) + c1 : null;
    }
    // "rank-suitword"
    m = str.match(/^(10|[2-9]|[AaKkQqJjTt])-([A-Za-z]+)$/);
    if (m) {
      var c2 = suitToCode(m[2]);
      return c2 ? rankToApp(m[1]) + c2 : null;
    }
    // "rank+suit" no dash  e.g. 10diamonds, Qh, 6♥
    m = str.match(/^(10|[2-9]|[AaKkQqJjTt])\s*([A-Za-z♠♥♦♣]+)$/);
    if (m) {
      var c3 = suitToCode(m[2]);
      return c3 ? rankToApp(m[1]) + c3 : null;
    }
    // "suit+rank" no dash
    m = str.match(/^([A-Za-z♠♥♦♣]+)\s*(10|[2-9]|[AaKkQqJjTt])$/);
    if (m) {
      var c4 = suitToCode(m[1]);
      return c4 ? rankToApp(m[2]) + c4 : null;
    }
    return null;
  }
  function cardsToApp(arr) {
    if (!Array.isArray(arr)) return [];
    var out = [];
    for (var i = 0; i < arr.length; i++) {
      var c = cardToApp(arr[i]);
      if (c) out.push(c);
    }
    return out;
  }

  // --------------------------------------------------------------------------
  // Channel / table identity
  // --------------------------------------------------------------------------
  // "holdem71" -> { tableId: 71, userID: null }
  // "holdem71#3583736" -> { tableId: 71, userID: 3583736 }  (hero's personal channel)
  function parseChannel(channel) {
    var m = String(channel || "").match(/^holdem(\d+)(?:#(\d+))?$/);
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
        var pid = t.parentID && t.parentID !== 0 ? t.parentID : null;
        if (pid != null && tableParents[t.ID] !== pid) {
          tableParents[t.ID] = pid;
          changed = true;
        }
      }
    }
    if (changed) saveTableParents();
  }

  // --------------------------------------------------------------------------
  // Player helpers — a player is "in the hand" if seated and not sitting out.
  // --------------------------------------------------------------------------
  function isInHand(p) {
    return !!(
      p &&
      p.userID != null &&
      !p.isSitOut &&
      p.status !== "Sitting out"
    );
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
    if (uid == null) return "Unknown";
    return nameByUid[uid] || "#" + uid;
  }

  // Canonical labels by offset from the button. Blinds/button are exact (flags);
  // the middle seats are interpolated and approximate.
  function positionLabels(n) {
    var base = ["BTN", "SB", "BB"];
    if (n <= 3) return base.slice(0, n);
    var mid = n - 3;
    var early = ["UTG", "UTG+1", "MP"];
    var late = ["LJ", "HJ", "CO"];
    var frontN = Math.ceil(mid / 2);
    var backN = mid - frontN;
    return base
      .concat(early.slice(0, frontN))
      .concat(late.slice(late.length - backN));
  }
  function derivePosition(players, heroUid) {
    var hero = findPlayerByUserID(players, heroUid);
    if (!hero) return null;
    if (hero.isBigBlind) return "BB";
    if (hero.isSmallBlind) return "SB";
    if (hero.isDealer) return "BTN";
    var seats = [];
    for (var k in players) {
      if (!Object.prototype.hasOwnProperty.call(players, k)) continue;
      if (isInHand(players[k])) seats.push(players[k]);
    }
    if (!seats.length) return null;
    seats.sort(function (a, b) {
      return (a.place || 0) - (b.place || 0);
    });
    var dealerIdx = -1,
      heroIdx = -1;
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
    return (
      liveHands[t] ||
      (liveHands[t] = {
        token: t,
        frames: [],
        frameTimes: [],
        hole: [],
        tableId: null,
        heroUserID: null,
      })
    );
  }

  function streetFromBoard(len) {
    if (len >= 5) return "River";
    if (len === 4) return "Turn";
    if (len === 3) return "Flop";
    return "Preflop";
  }
  function mapUserAction(userAction) {
    switch ((userAction || "").toLowerCase()) {
      case "fold":
        return "fold";
      case "check":
        return "check";
      case "call":
        return "call";
      case "callany":
        return "call";
      case "raise":
        return "raise";
      case "raiseto":
        return "raise";
      case "bet":
        return "bet";
      case "allin":
        return "raise";
      case "all in":
        return "raise";
      default:
        return null;
    }
  }

  // Strip the chatLog (the human-readable action/chat log) from a getState frame
  // before we keep it — we reconstruct only from the structured player state.
  function sanitizeFrame(m) {
    if (!m || typeof m !== "object" || m.chatLog === undefined) return m;
    var c = {};
    for (var k in m) {
      if (k === "chatLog") continue;
      if (Object.prototype.hasOwnProperty.call(m, k)) c[k] = m[k];
    }
    return c;
  }

  // Hero's hole cards + token, from the personal getState channel.
  function handlePersonalState(uid, message) {
    if (uid != null) heroUserID = uid;
    var buf = bufFor(message.token);
    if (!buf) return;
    buf.heroUserID = heroUserID;
    if (Array.isArray(message.hand) && message.hand.length)
      buf.hole = message.hand.slice();
  }

  // A public table frame (getState snapshot or playerMakeMove). Only frames that
  // carry a full `players` map are kept; updatePlayer/removePlayer are ignored.
  function handleTableFrame(tableId, message) {
    var players = message.players;
    if (!players || typeof players !== "object") return;

    for (var k in players) {
      if (!Object.prototype.hasOwnProperty.call(players, k)) continue;
      var p = players[k];
      if (p && p.userID != null && p.playername)
        nameByUid[p.userID] = p.playername;
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

    if (
      message.eventType === "playerMakeMove" &&
      message.gameStatus === "ended"
    ) {
      // A second tab or window on the poker page receives the same table
      // frames and reconstructs the same hand. Claim the hand in localStorage
      // (shared across tabs) BEFORE the reconstruct: only the first instance
      // to claim it saves it.
      var claimed = claimHand(buf.tableId, message.token);
      var hand = null;
      if (claimed) {
        try {
          hand = reconstructHand(buf);
        } catch (e) {
          console.warn("[TC Poker] reconstruct failed", e);
        }
      }
      delete liveHands[String(message.token)];
      if (hand) persistHand(hand);
    }
  }

  // Cross-tab dedup for hand persistence. Claims live in localStorage keyed by
  // table + hand token and expire so the key space never grows unbounded. If
  // storage is unavailable, claim anyway: better a rare duplicate (the export
  // dedup catches it) than a lost hand.
  var CLAIM_PREFIX = "tcp_claimed_";
  var CLAIM_TTL_MS = 10 * 60 * 1000;
  function claimHand(tableId, token) {
    try {
      var now = Date.now();
      for (var i = localStorage.length - 1; i >= 0; i--) {
        var k = localStorage.key(i);
        if (k && k.indexOf(CLAIM_PREFIX) === 0) {
          var ts = parseInt(localStorage.getItem(k), 10);
          if (!ts || now - ts > CLAIM_TTL_MS) localStorage.removeItem(k);
        }
      }
      var key =
        CLAIM_PREFIX + (tableId != null ? tableId : "x") + "_" + String(token);
      if (localStorage.getItem(key)) return false;
      localStorage.setItem(key, String(now));
      return true;
    } catch (e) {
      return true;
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
    // On re-derive (export), keep the original captured time instead of restamping.
    var handTs = buf.timestamp != null ? buf.timestamp : Date.now();

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
    var board = firstFrame.communityCards || []; // track the LONGEST board seen
    var lastTotalPot = firstFrame.totalPot != null ? firstFrame.totalPot : null;

    for (var f = 0; f < frames.length; f++) {
      var msg = frames[f];
      var players = msg.players || {};
      var fb = msg.communityCards || [];
      if (fb.length > board.length) board = fb; // never shrink (ended frame = [])
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
            userID: uid,
            name: sp.playername || nameFor(uid),
            startStack: money + pot,
            endStack: money,
            invested: pot,
            _lastMoney: money,
          };
        } else {
          var prevM = stackByUid[uid]._lastMoney;
          if (prevM != null && money < prevM)
            stackByUid[uid].invested += prevM - money;
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
          if (bp.isSmallBlind)
            actions.push({
              author: bp.playername || nameFor(bp.userID),
              isMe: Number(bp.userID) === Number(heroUid),
              street: "Preflop",
              type: "sb",
              amount:
                bp.pot != null
                  ? bp.pot
                  : bigBlind != null
                    ? Math.round(bigBlind / 2)
                    : 0,
              raiseTo: null,
              allIn: bp.status === "All in",
              actedMs: null,
            });
          if (bp.isBigBlind)
            actions.push({
              author: bp.playername || nameFor(bp.userID),
              isMe: Number(bp.userID) === Number(heroUid),
              street: "Preflop",
              type: "bb",
              amount: bp.pot != null ? bp.pot : bigBlind != null ? bigBlind : 0,
              raiseTo: null,
              allIn: bp.status === "All in",
              actedMs: null,
            });
        }
      }

      // Attribute the move in THIS frame to the PREVIOUS frame's `turn`. The
      // action's street is the PREVIOUS frame's board: the frame that shows a new
      // board is produced by the action that CLOSED the prior street.
      var actorUid = prevTurn != null ? prevTurn : null;
      if (actorUid != null && msg.userAction) {
        var actorP = findPlayerByUserID(players, actorUid);
        var type = mapUserAction(msg.userAction);
        if (type) {
          var curMoney = actorP && actorP.money != null ? actorP.money : null;
          var prevMoney = prevMoneyByUid[actorUid];
          var curPot = actorP && actorP.pot != null ? actorP.pot : 0;
          var amount = 0;
          if (type !== "fold" && type !== "check") {
            if (curMoney != null && prevMoney != null && prevMoney > curMoney)
              amount = prevMoney - curMoney;
            else amount = curPot;
          }
          var isAllIn =
            !!(actorP && actorP.status === "All in") ||
            (msg.userAction || "").toLowerCase() === "allin";
          var raiseTo = type === "raise" || type === "bet" ? curPot : null;
          actions.push({
            author: actorP
              ? actorP.playername || nameFor(actorUid)
              : nameFor(actorUid),
            isMe: Number(actorUid) === Number(heroUid),
            street: prevStreet || street,
            type: type,
            amount: type === "fold" || type === "check" ? 0 : amount,
            raiseTo: raiseTo,
            allIn: isAllIn,
            actedMs:
              f > 0 && frameTimes[f] != null && frameTimes[f - 1] != null
                ? frameTimes[f] - frameTimes[f - 1]
                : null,
          });
        }
      }

      for (var s3 in players) {
        if (!Object.prototype.hasOwnProperty.call(players, s3)) continue;
        var p3 = players[s3];
        if (p3 && p3.userID != null && p3.money != null)
          prevMoneyByUid[p3.userID] = p3.money;
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
      outcome = { result: "won", amount: heroWin };
    } else {
      var heroFolded =
        heroP && (heroP.status === "Folded" || heroP.status === "Fold");
      var heroRevealed =
        heroP && Array.isArray(heroP.hand) && heroP.hand.length;
      outcome =
        heroFolded && !heroRevealed
          ? { result: "folded", amount: 0 }
          : { result: "lost", amount: 0 };
    }

    var revealedCount = 0;
    for (var sd in endPlayers) {
      if (!Object.prototype.hasOwnProperty.call(endPlayers, sd)) continue;
      var sdp = endPlayers[sd];
      if (sdp && Array.isArray(sdp.hand) && sdp.hand.length >= 2)
        revealedCount++;
    }
    var showdown = revealedCount >= 2;

    // Enrich every seat's record from the final frame.
    for (var eu in stackByUid) {
      if (!Object.prototype.hasOwnProperty.call(stackByUid, eu)) continue;
      var rec = stackByUid[eu];
      var ep =
        findPlayerByUserID(endPlayers, rec.userID) ||
        findPlayerByUserID(firstPlayers, rec.userID);
      rec.position = derivePosition(firstPlayers, rec.userID);
      rec.winnings = ep && ep.winnings != null ? ep.winnings : 0;
      rec.profit = (rec.winnings || 0) - (rec.invested || 0);
      rec.status = ep && ep.status != null ? ep.status : null;
      rec.isDealer = !!(ep && ep.isDealer);
      rec.isSmallBlind = !!(ep && ep.isSmallBlind);
      rec.isBigBlind = !!(ep && ep.isBigBlind);
      var rev = ep && Array.isArray(ep.hand) ? cardsToApp(ep.hand) : [];
      rec.revealed = rev.length >= 2 ? rev : [];
      rec.handName =
        ep && ep.handName != null
          ? ep.handName
          : ep && ep.bestCombination != null
            ? ep.bestCombination
            : null;
      rec.isHero = Number(rec.userID) === Number(heroUid);
      delete rec._lastMoney;
    }
    var stacks = [];
    for (var su in stackByUid) {
      if (!Object.prototype.hasOwnProperty.call(stackByUid, su)) continue;
      stacks.push(stackByUid[su]);
    }
    var heroStack = heroUid != null ? stackByUid[heroUid] : null;

    var heroHole = cardsToApp(
      buf.hole && buf.hole.length ? buf.hole : (heroP && heroP.hand) || [],
    );

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
      table: tableId != null ? "Table " + tableId : null,
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
      _raw: { hole: buf.hole || [], frames: frames, frameTimes: frameTimes },
    };
  }

  // --------------------------------------------------------------------------
  // WebSocket inspection — read-only. All poker data is on the socket.
  // --------------------------------------------------------------------------
  function inspectWsData(data) {
    if (typeof data !== "string") return;
    if (data.indexOf("holdem") === -1) return;
    var frame;
    try {
      frame = JSON.parse(data);
    } catch (e) {
      return;
    }
    if (!frame) return;
    var push = frame.push || frame;
    var channel = (push && push.channel) || frame.channel || null;
    var message =
      (push && push.pub && push.pub.data && push.pub.data.message) ||
      (frame.pub && frame.pub.data && frame.pub.data.message) ||
      frame.message ||
      (frame.data && frame.data.message) ||
      null;
    if (!channel || !message) return;

    if (channel === "holdemlobby" || Array.isArray(message.tables)) {
      handleLobby(message);
      return;
    }

    var ch = parseChannel(channel);
    if (!ch) return;

    if (ch.userID != null) {
      // Personal channel: hero's hole cards (getState only).
      if (message.eventType === "getState")
        handlePersonalState(ch.userID, message);
      return;
    }
    // Public table channel.
    handleTableFrame(ch.tableId, message);
  }

  // --------------------------------------------------------------------------
  // WebSocket inspection — read-only, defensive against other WS scripts.
  // Frames can arrive via more than one hook path; dedupe by event object.
  // --------------------------------------------------------------------------
  var seenEvents = typeof WeakSet !== "undefined" ? new WeakSet() : null;
  function inspectEvent(e) {
    if (seenEvents) {
      if (seenEvents.has(e)) return;
      seenEvents.add(e);
    }
    try {
      inspectWsData(e.data);
    } catch (err) {
      console.warn("[TC Poker] inspect error", err);
    }
  }

  try {
    var CurrentWS = window.WebSocket;
    var pristineAdd = CurrentWS.prototype.addEventListener;

    // 1. Constructor wrap — primary capture path
    window.WebSocket = new Proxy(CurrentWS, {
      construct: function (target, args) {
        var ws = new (Function.prototype.bind.apply(
          target,
          [null].concat(args),
        ))();
        try {
          pristineAdd.call(ws, "message", inspectEvent);
        } catch (err) {}
        return ws;
      },
    });

    // 2. Fallback: prototype addEventListener
    CurrentWS.prototype.addEventListener = function (type, listener, options) {
      if (type === "message" && typeof listener === "function") {
        var wrapped = function (e) {
          inspectEvent(e);
          return listener.call(this, e);
        };
        return pristineAdd.call(this, type, wrapped, options);
      }
      return pristineAdd.call(this, type, listener, options);
    };

    // 3. Fallback: onmessage setter
    var onmsgDesc = Object.getOwnPropertyDescriptor(
      CurrentWS.prototype,
      "onmessage",
    );
    if (onmsgDesc && onmsgDesc.set) {
      Object.defineProperty(CurrentWS.prototype, "onmessage", {
        configurable: true,
        get: function () {
          return this.__tcpOnMsg !== undefined
            ? this.__tcpOnMsg
            : onmsgDesc.get.call(this);
        },
        set: function (fn) {
          this.__tcpOnMsg = fn;
          onmsgDesc.set.call(
            this,
            fn
              ? function (e) {
                  inspectEvent(e);
                  return fn.call(this, e);
                }
              : fn,
          );
        },
      });
    }
  } catch (e) {
    console.warn("[TC Poker] hook install failed", e);
  }

  // --------------------------------------------------------------------------
  // LEGACY IMPORT — convert old v4.9 TEXT hands once (best-effort, defensive).
  // --------------------------------------------------------------------------
  function parseAmount(str) {
    var n = parseInt(String(str || "").replace(/[^0-9]/g, ""), 10);
    return isFinite(n) ? n : 0;
  }

  function parseActions(actionsArr) {
    if (!Array.isArray(actionsArr)) return [];
    if (
      actionsArr.length &&
      typeof actionsArr[0] === "object" &&
      actionsArr[0] !== null
    )
      return actionsArr;
    var out = [];
    var street = "Preflop";
    for (var n = 0; n < actionsArr.length; n++) {
      var raw = String(actionsArr[n] || "");
      var isMe = raw.indexOf(">>") === 0;
      var line = raw
        .replace(/^>>\s*/, "")
        .replace(/^\s+/, "")
        .trim();
      if (line.indexOf("The flop") === 0) {
        street = "Flop";
        continue;
      }
      if (line.indexOf("The turn") === 0) {
        street = "Turn";
        continue;
      }
      if (line.indexOf("The river") === 0) {
        street = "River";
        continue;
      }
      if (line.indexOf("The preflop") === 0) {
        street = "Preflop";
        continue;
      }
      var ci = line.indexOf(": ");
      if (ci === -1) continue;
      var author = line.slice(0, ci).trim();
      var rest = line.slice(ci + 2).trim();
      var low = rest.toLowerCase();
      var type = null,
        amount = 0,
        raiseTo = null,
        allIn = false;
      if (low.indexOf("fold") === 0) {
        type = "fold";
      } else if (low.indexOf("check") === 0) {
        type = "check";
      } else if (low.indexOf("small blind") !== -1) {
        type = "sb";
        amount = parseAmount(rest);
      } else if (low.indexOf("big blind") !== -1) {
        type = "bb";
        amount = parseAmount(rest);
      } else if (low.indexOf("call") === 0) {
        type = "call";
        amount = parseAmount(rest);
      } else if (low.indexOf("bet") === 0) {
        type = "bet";
        amount = parseAmount(rest);
        raiseTo = amount;
      } else if (low.indexOf("raise") === 0) {
        type = "raise";
        amount = parseAmount(rest);
        raiseTo = amount;
      } else if (low.indexOf("win") === 0) {
        type = "won";
        amount = parseAmount(rest);
      } else continue;
      if (low.indexOf("all") !== -1 && low.indexOf("in") !== -1) allIn = true;
      out.push({
        author: author,
        isMe: isMe,
        street: street,
        type: type,
        amount: amount,
        raiseTo: raiseTo,
        allIn: allIn,
      });
    }
    return out;
  }
  function calcInvestmentFromActions(acts, heroAuthor) {
    var invested = 0;
    for (var i = 0; i < acts.length; i++) {
      var a = acts[i];
      var mine = a.isMe || (heroAuthor && a.author === heroAuthor);
      if (mine && a.type !== "won" && a.type !== "fold" && a.type !== "check")
        invested += a.amount || 0;
    }
    return invested;
  }
  function convertHand(legacy) {
    legacy = legacy || {};
    var acts = parseActions(legacy.actions || []);
    var heroAuthor = null;
    for (var i = 0; i < acts.length; i++) {
      if (acts[i].isMe) {
        heroAuthor = acts[i].author;
        break;
      }
    }
    var hole = cardsToApp(
      legacy.hole || legacy.cards || legacy.holeCards || [],
    );
    var boardL = cardsToApp(
      legacy.board || legacy.community || legacy.communityCards || [],
    );
    var outcome = legacy.outcome;
    if (!outcome) {
      if (legacy.result)
        outcome = {
          result: String(legacy.result).toLowerCase(),
          amount: parseAmount(legacy.won || legacy.winnings || 0),
        };
      else {
        var wonAct = null;
        for (var w = 0; w < acts.length; w++) {
          if (
            acts[w].type === "won" &&
            (acts[w].isMe || acts[w].author === heroAuthor)
          )
            wonAct = acts[w];
        }
        outcome = wonAct
          ? { result: "won", amount: wonAct.amount || 0 }
          : { result: "lost", amount: 0 };
      }
    }
    var ts =
      legacy.timestamp != null
        ? Number(legacy.timestamp)
        : legacy.time != null
          ? Number(legacy.time)
          : Date.now();
    if (ts < 1e12) ts *= 1000;
    return {
      structured: {
        timestamp: ts,
        position: legacy.position || null,
        hole: hole,
        board: boardL,
        pot: legacy.pot != null ? legacy.pot : null,
        invested:
          legacy.invested != null
            ? legacy.invested
            : calcInvestmentFromActions(acts, heroAuthor),
        outcome: outcome,
        showdown:
          typeof legacy.showdown === "boolean" ? legacy.showdown : false,
        tableSize: legacy.tableSize != null ? legacy.tableSize : null,
        bigBlind: legacy.bigBlind != null ? legacy.bigBlind : null,
        tableId: legacy.tableId != null ? legacy.tableId : null,
        table: legacy.table != null ? legacy.table : null,
        actions: acts,
        startStack: legacy.startStack != null ? legacy.startStack : null,
        endStack: legacy.endStack != null ? legacy.endStack : null,
        stacks: legacy.stacks || [],
        _v2: true,
        _legacy: true,
      },
    };
  }

  // --------------------------------------------------------------------------
  // IndexedDB
  // --------------------------------------------------------------------------
  function openDB(name, createStore) {
    return new Promise(function (resolve, reject) {
      // Our DB opens at version 2 so the export store can be added to DBs
      // created by older versions. Foreign DBs (SRC_DB) open versionless.
      var req = createStore ? indexedDB.open(name, 2) : indexedDB.open(name);
      var settled = false;
      req.onupgradeneeded = function (e) {
        var db = e.target.result;
        if (createStore) {
          if (!db.objectStoreNames.contains(STORE))
            db.createObjectStore(STORE, { autoIncrement: true });
          if (!db.objectStoreNames.contains(EXPORT_STORE))
            db.createObjectStore(EXPORT_STORE, { autoIncrement: true });
        }
      };
      req.onsuccess = function (e) {
        var db = e.target.result;
        // If a future version bump needs an upgrade, close this connection so
        // it never blocks the other tab's open.
        db.onversionchange = function () {
          try {
            db.close();
          } catch (err) {}
        };
        if (settled) {
          try {
            db.close();
          } catch (err) {}
          return;
        }
        settled = true;
        resolve(db);
      };
      req.onerror = function () {
        if (settled) return;
        settled = true;
        reject(req.error);
      };
      // The version-2 upgrade cannot start while any other connection to the
      // DB is open at version 1 (another poker tab, or an older copy of this
      // script). Without this, open() waits forever and everything that needs
      // the DB silently hangs. Fail fast instead so the UI can say why.
      req.onblocked = function () {
        console.warn(
          "[TC Poker] database upgrade blocked — close other Torn poker tabs and any older copy of this script, then reload",
        );
      };
      setTimeout(function () {
        if (settled) return;
        settled = true;
        reject(
          new Error(
            "Database open timed out. Close other Torn poker tabs (and disable any older copy of this script), then reload.",
          ),
        );
      }, 4000);
    });
  }
  function openStoreDB() {
    return openDB(DB, true);
  }
  function getAll(db, store) {
    return new Promise(function (resolve, reject) {
      try {
        var req = db
          .transaction([store], "readonly")
          .objectStore(store)
          .getAll();
        req.onsuccess = function () {
          resolve(req.result || []);
        };
        req.onerror = function () {
          reject(req.error);
        };
      } catch (e) {
        resolve([]);
      }
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
          var req = db
            .transaction([STORE], "readonly")
            .objectStore(STORE)
            .count();
          req.onsuccess = function () {
            db.close();
            resolve(req.result || 0);
          };
          req.onerror = function () {
            db.close();
            resolve(0);
          };
        } catch (e) {
          try {
            db.close();
          } catch (_) {}
          resolve(0);
        }
      });
    });
  }
  function persistHand(hand) {
    if (!hand || !Array.isArray(hand.hole) || hand.hole.length !== 2) return;
    if (hand._partial) {
      partialsSkipped++;
      setStatus("Skipped a partial hand (joined mid-hand).");
      return;
    }
    openStoreDB()
      .then(function (db) {
        // Raw record and its export-ready copy commit in one transaction so
        // the two stores can never disagree on a saved hand.
        var tx = db.transaction([STORE, EXPORT_STORE], "readwrite");
        tx.objectStore(STORE).add(hand);
        tx.objectStore(EXPORT_STORE).add(stripForExport(hand));
        tx.oncomplete = function () {
          db.close();
          refreshTrigger();
        };
        tx.onerror = function () {
          db.close();
        };
      })
      .catch(function () {});
  }
  function clearStore() {
    return openStoreDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction([STORE, EXPORT_STORE], "readwrite");
        tx.objectStore(STORE).clear();
        tx.objectStore(EXPORT_STORE).clear();
        tx.oncomplete = function () {
          db.close();
          resolve();
        };
        tx.onerror = function () {
          db.close();
          reject(tx.error);
        };
      });
    });
  }
  function importHistoryOnce() {
    if (localStorage.getItem(IMPORT_FLAG))
      return Promise.resolve({ skipped: true, added: 0 });
    var srcRows = [];
    return openDB(SRC_DB, false)
      .then(function (db) {
        return getAllFirstStore(db).then(function (rows) {
          db.close();
          return rows;
        });
      })
      .then(function (rows) {
        srcRows = rows || [];
        return openStoreDB();
      })
      .then(function (db) {
        return getAll(db, STORE).then(function (existing) {
          var seen = {};
          for (var i = 0; i < existing.length; i++)
            if (existing[i] && existing[i].timestamp != null)
              seen[existing[i].timestamp] = true;
          return new Promise(function (resolve, reject) {
            var tx = db.transaction([STORE], "readwrite");
            var store = tx.objectStore(STORE);
            var added = 0;
            for (var j = 0; j < srcRows.length; j++) {
              var legacy = JSON.parse(JSON.stringify(srcRows[j]));
              if (legacy.timestamp != null && seen[legacy.timestamp]) continue;
              try {
                store.add(convertHand(legacy).structured);
                added++;
              } catch (e) {}
            }
            tx.oncomplete = function () {
              db.close();
              try {
                localStorage.setItem(IMPORT_FLAG, String(Date.now()));
              } catch (e) {}
              resolve({ skipped: false, added: added });
            };
            tx.onerror = function () {
              db.close();
              reject(tx.error);
            };
          });
        });
      });
  }
  function purgeForeignHands() {
    if (localStorage.getItem("tcp_purged_foreign")) return Promise.resolve(0);
    return openStoreDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction([STORE], "readwrite");
        var req = tx.objectStore(STORE).openCursor();
        var removed = 0;
        req.onsuccess = function (e) {
          var c = e.target.result;
          if (!c) return;
          var h = c.value;
          if (!h || !Array.isArray(h.hole) || h.hole.length !== 2) {
            c.delete();
            removed++;
          }
          c.continue();
        };
        tx.oncomplete = function () {
          db.close();
          try {
            localStorage.setItem("tcp_purged_foreign", "1");
          } catch (e) {}
          resolve(removed);
        };
        tx.onerror = function () {
          db.close();
          reject(tx.error);
        };
      });
    });
  }

  // --------------------------------------------------------------------------
  // DELIVERY
  // --------------------------------------------------------------------------
  function downloadFile(filename, text) {
    try {
      var blob = new Blob([text], { type: "application/json" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      // Remove the anchor now, but keep the blob URL alive: Torn PDA's native
      // download handler fetches the blob asynchronously after the click, so
      // revoking immediately makes mobile downloads fail silently.
      setTimeout(function () {
        try {
          document.body.removeChild(a);
        } catch (e) {}
      }, 0);
      setTimeout(function () {
        try {
          URL.revokeObjectURL(url);
        } catch (e) {}
      }, 120000);
      return true;
    } catch (e) {
      return false;
    }
  }
  var APP_URL = "https://poker.systoned.cc/";
  // Hero's name is learned live from table frames; if we're exporting after a
  // reload (no live session yet) it's blank, so recover it from the hands — each
  // stores the hero's name in its stacks[] entry flagged isHero.
  function heroNameFromHands(hands) {
    for (var i = 0; i < (hands || []).length; i++) {
      var st = hands[i] && hands[i].stacks;
      if (!Array.isArray(st)) continue;
      for (var j = 0; j < st.length; j++) {
        if (st[j] && st[j].isHero && st[j].name) return st[j].name;
      }
    }
    return "";
  }
  function buildV2Envelope(hands) {
    var player = heroName || heroNameFromHands(hands) || "Unknown";
    return {
      schemaVersion: 2,
      player: player,
      exportedAt: new Date().toISOString(),
      hands: hands || [],
    };
  }
  // Drop the heavy raw payload (and internal bookkeeping) from exported hands.
  function stripForExport(h) {
    if (!h || typeof h !== "object") return h;
    var c = {};
    for (var k in h) {
      if (!Object.prototype.hasOwnProperty.call(h, k)) continue;
      if (k === "_raw") continue;
      c[k] = h[k];
    }
    if (Array.isArray(c.stacks))
      c.stacks = c.stacks.map(function (s) {
        var t = {};
        for (var kk in s) {
          if (kk !== "_lastMoney") t[kk] = s[kk];
        }
        return t;
      });
    return c;
  }
  // Re-derive a stored hand's structured fields from retained raw frames, with
  // the CURRENT extractor. Future-proofs the data: improve the parser, re-export,
  // and every hand that still has _raw is upgraded — no replay, no re-migration.
  function rederiveHand(record) {
    if (!record) return record;
    if (
      !record._raw ||
      !Array.isArray(record._raw.frames) ||
      !record._raw.frames.length
    )
      return stripForExport(record);
    var buf = {
      token: "rederive",
      tableId: record.tableId,
      heroUserID: record.heroUserID != null ? record.heroUserID : heroUserID,
      hole: record._raw.hole || record.hole || [],
      frames: record._raw.frames,
      frameTimes: record._raw.frameTimes || [],
      timestamp: record.timestamp,
    };
    try {
      var h = reconstructHand(buf);
      return h ? stripForExport(h) : stripForExport(record);
    } catch (e) {
      return stripForExport(record);
    }
  }
  // Hands double-saved by two open tabs (before cross-tab claims existed) sit
  // in the store as pairs written milliseconds apart. Their timestamps differ
  // (each tab stamped its own capture time), so dedup on CONTENT: same table,
  // hole, board, pot, position, outcome, and action sequence (ignoring the
  // capture-timing actedMs), within a 2-second window.
  function dedupeKey(h) {
    var acts = (h.actions || [])
      .map(function (a) {
        return (a.author || "") + ":" + (a.type || "") + ":" + (a.amount || 0);
      })
      .join(",");
    return [
      h.tableId,
      (h.hole || []).join(""),
      (h.board || []).join(""),
      h.pot,
      h.position,
      h.outcome && h.outcome.result,
      acts,
    ].join("|");
  }
  function dedupeHands(hands) {
    var out = [];
    var lastTsByKey = {};
    for (var i = 0; i < hands.length; i++) {
      var h = hands[i];
      if (h.timestamp == null) {
        out.push(h);
        continue;
      }
      var k = dedupeKey(h);
      var prev = lastTsByKey[k];
      if (prev != null && Math.abs(h.timestamp - prev) < 2000) continue;
      lastTsByKey[k] = h.timestamp;
      out.push(h);
    }
    return out;
  }
  // One-time physical cleanup of the raw store: delete the double-captured
  // records (same content within 2s) that accumulated before cross-tab claims
  // existed. Same rule as dedupeHands, applied with a streaming cursor so only
  // the key map is held in memory. After this the panel count, the export
  // count, and the app agree.
  var STORE_DEDUP_FLAG = "tcp_store_deduped_v1";
  function dedupeStoreOnce() {
    try {
      if (localStorage.getItem(STORE_DEDUP_FLAG)) return Promise.resolve(0);
    } catch (e) {}
    return openStoreDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction([STORE], "readwrite");
        var req = tx.objectStore(STORE).openCursor();
        var lastTsByKey = {};
        var removed = 0;
        req.onsuccess = function (e) {
          var c = e.target.result;
          if (!c) return;
          var h = c.value || {};
          if (h.timestamp != null) {
            var k = dedupeKey(h);
            var prev = lastTsByKey[k];
            if (prev != null && Math.abs(h.timestamp - prev) < 2000) {
              c.delete();
              removed++;
            } else {
              lastTsByKey[k] = h.timestamp;
            }
          }
          c.continue();
        };
        tx.oncomplete = function () {
          db.close();
          try {
            localStorage.setItem(STORE_DEDUP_FLAG, "1");
          } catch (e2) {}
          resolve(removed);
        };
        tx.onerror = function () {
          db.close();
          reject(tx.error);
        };
      });
    });
  }

  // --------------------------------------------------------------------------
  // Export cache. The raw store carries _raw (every frame of every hand), far
  // too heavy to load or re-parse on a button click. The export store holds a
  // stripped copy of each hand, written at capture time. The one expensive
  // pass — re-deriving all hands from _raw with the current parser — happens
  // in the background at page load, and only when PARSER_VERSION changed or
  // the two stores disagree (e.g. hands saved by an older script version).
  // --------------------------------------------------------------------------
  function countOf(db, store) {
    return new Promise(function (resolve) {
      try {
        var req = db.transaction([store], "readonly").objectStore(store).count();
        req.onsuccess = function () {
          resolve(req.result || 0);
        };
        req.onerror = function () {
          resolve(-1);
        };
      } catch (e) {
        resolve(-1);
      }
    });
  }
  function rebuildExportCache(db) {
    return new Promise(function (resolve, reject) {
      var tx = db.transaction([STORE, EXPORT_STORE], "readwrite");
      var exp = tx.objectStore(EXPORT_STORE);
      exp.clear();
      var req = tx.objectStore(STORE).openCursor();
      var n = 0;
      req.onsuccess = function (e) {
        var c = e.target.result;
        if (!c) return;
        var r = rederiveHand(c.value);
        if (r) exp.add(r);
        n++;
        c.continue();
      };
      tx.oncomplete = function () {
        try {
          localStorage.setItem(CACHE_FLAG, String(PARSER_VERSION));
        } catch (e2) {}
        resolve(n);
      };
      tx.onerror = function () {
        reject(tx.error);
      };
    });
  }
  // Memoized: a click while the boot-time rebuild is still running waits for
  // that run instead of starting a second one. Reset on failure so it retries.
  var _ensureCachePromise = null;
  function ensureExportCache() {
    if (_ensureCachePromise) return _ensureCachePromise;
    _ensureCachePromise = _ensureExportCache();
    _ensureCachePromise.then(null, function () {
      _ensureCachePromise = null;
    });
    return _ensureCachePromise;
  }
  function _ensureExportCache() {
    return openStoreDB().then(function (db) {
      var flag = null;
      try {
        flag = localStorage.getItem(CACHE_FLAG);
      } catch (e) {}
      return Promise.all([countOf(db, STORE), countOf(db, EXPORT_STORE)]).then(
        function (counts) {
          if (flag === String(PARSER_VERSION) && counts[0] === counts[1]) {
            db.close();
            return 0;
          }
          return rebuildExportCache(db).then(
            function (n) {
              db.close();
              return n;
            },
            function (err) {
              db.close();
              throw err;
            },
          );
        },
      );
    });
  }
  // Click path: read the pre-stripped hands and drop known duplicate pairs.
  // No parsing, no _raw. ensureExportCache is a cheap count check when the
  // cache is already current (the normal case — boot fills it).
  function collectExportHands() {
    return ensureExportCache().then(function () {
      return openStoreDB().then(function (db) {
        return getAll(db, EXPORT_STORE).then(function (rows) {
          db.close();
          return dedupeHands(rows || []);
        });
      });
    });
  }
  function syncToApp() {
    return collectExportHands().then(
      function (hands) {
        var text = JSON.stringify(buildV2Envelope(hands));
        var ok = false;
        try {
          if (typeof GM_setClipboard === "function") {
            GM_setClipboard(text);
            ok = true;
          }
        } catch (e) {}
        try {
          window.open(APP_URL, "_blank");
        } catch (e) {}
        setStatus(
          (ok ? "Copied " : "Clipboard failed for ") +
            hands.length +
            " hands — opened app, paste there",
        );
      },
      function (e) {
        setStatus("Copy failed: " + String((e && e.message) || e));
      },
    );
  }
  function exportData() {
    return collectExportHands().then(
      function (hands) {
        var text = JSON.stringify(buildV2Envelope(hands));
        var ok = downloadFile(
          "tcp-data-export-" +
            new Date().toISOString().replace(/[:.]/g, "-") +
            ".json",
          text,
        );
        setStatus(
          (ok ? "Saved file: " : "Save failed: ") +
            hands.length +
            " hands (" +
            Math.round(text.length / 1024) +
            " KB) — open app + upload it",
        );
      },
      function (e) {
        setStatus("Export failed: " + String((e && e.message) || e));
      },
    );
  }
  function openApp() {
    try {
      window.open(APP_URL, "_blank");
    } catch (e) {}
    setStatus('Opened app — use "Upload hand files"');
  }

  // --------------------------------------------------------------------------
  // UI
  // --------------------------------------------------------------------------
  function setStatus(text) {
    lastStatus = text || "";
    var el = document.getElementById("tc-status");
    if (el && lastStatus) {
      el.style.display = "block";
      el.textContent = lastStatus;
    }
  }
  function refreshTrigger() {
    var btn = document.getElementById("tc-trigger");
    if (!btn) return;
    countStore().then(
      function (n) {
        btn.innerHTML =
          '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">' +
          '<path fill="currentColor" d="M11 1a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2zm0 11v2h1v-2zM9.586 6c-.375 0-.735.149-1 .414L8 7l-.586-.586a1.415 1.415 0 0 0-2 2L8 11l2.586-2.586a1.414 1.414 0 0 0-1-2.414M4 4h1V2H4z"/>' +
          "</svg>";
        btn.title = "TC Poker Tracker · " + n + " hand" + (n !== 1 ? "s" : "");
      },
      function () {},
    );
  }
  function dropBtn(id, label, colour, disabled, extra) {
    return (
      '<button id="' +
      id +
      '" style="padding:8px 14px;border-radius:4px;' +
      "border:1px solid " +
      colour +
      ";background:transparent;color:" +
      colour +
      ";" +
      "cursor:pointer;font-size:11px;font-family:Georgia,serif;width:100%;text-align:center;" +
      (extra || "") +
      '"' +
      (disabled ? " disabled" : "") +
      ">" +
      label +
      "</button>"
    );
  }
  function wire(id, enabled, fn) {
    var b = document.getElementById(id);
    if (b && enabled) b.onclick = fn;
  }
  function toggleDropdown() {
    var existing = document.getElementById("tc-dropdown");
    if (existing) {
      existing.remove();
      return;
    }
    var trigger = document.getElementById("tc-trigger");
    if (!trigger) return;
    // Render the panel synchronously — the hand count fills in when the DB
    // answers. If the DB hangs or errors the panel still opens and says so,
    // instead of the click silently doing nothing.
    var drop = document.createElement("div");
    drop.id = "tc-dropdown";
    drop.style.cssText = [
      "position:absolute",
      "top:100%",
      "left:0",
      "margin-top:6px",
      "background:#0c0c0c",
      "border:1px solid #242424",
      "border-radius:6px",
      "font-family:Georgia,serif",
      "padding:16px 18px",
      "min-width:300px",
      "box-shadow:0 8px 30px rgba(0,0,0,0.9)",
      "z-index:100000",
    ].join(";");
    drop.innerHTML =
      '<div style="font-size:11px;color:#8a7a5a;line-height:1.6;margin-bottom:12px;">' +
      "Records your hands as you play.<br>" +
      "Desktop: <b>Copy to clipboard</b>, then paste in the app.<br>" +
      "Mobile: <b>Export file</b>, then <b>Open app</b> and upload it." +
      "</div>" +
      '<div style="font-size:12px;color:#c8d4c8;margin-bottom:14px;">' +
      '<strong id="tc-count" style="color:#c8a94a;">&hellip;</strong> hands logged' +
      "</div>" +
      '<div id="tc-actions" style="display:flex;flex-direction:column;gap:8px;">' +
      dropBtn("tc-copy", "Copy to clipboard", "#c8a94a", false) +
      dropBtn("tc-export", "Export file", "#7a8a7a", false) +
      dropBtn("tc-open", "Open app", "#7a8a7a", false) +
      '<div id="tc-status" style="font-size:11px;color:#8a7a5a;display:none;margin-top:4px;line-height:1.5;"></div>' +
      dropBtn(
        "tc-clear",
        "Clear all logged hands",
        "#6a4a4a",
        false,
        "margin-top:8px;",
      ) +
      "</div>";
    trigger.parentNode.appendChild(drop);
    if (lastStatus) setStatus(lastStatus);
    var latestCount = 0;
    wire("tc-copy", true, function () {
      setStatus("Copying and opening app...");
      syncToApp();
    });
    wire("tc-export", true, function () {
      setStatus("Saving file...");
      exportData();
    });
    wire("tc-open", true, function () {
      openApp();
    });
    wire("tc-clear", true, function () {
      if (latestCount > 0) confirmClear(latestCount);
    });
    setTimeout(function () {
      function outside(e) {
        var d = document.getElementById("tc-dropdown");
        var t = document.getElementById("tc-trigger");
        if (d && !d.contains(e.target) && e.target !== t) {
          d.remove();
          document.removeEventListener("click", outside, true);
        }
      }
      document.addEventListener("click", outside, true);
    }, 10);
    countStore().then(
      function (count) {
        latestCount = count;
        var el = document.getElementById("tc-count");
        if (el) el.textContent = count;
        if (count === 0) {
          ["tc-copy", "tc-export", "tc-clear"].forEach(function (id) {
            var b = document.getElementById(id);
            if (b) b.disabled = true;
          });
        }
      },
      function (e) {
        var el = document.getElementById("tc-count");
        if (el) el.textContent = "?";
        setStatus(String((e && e.message) || e));
      },
    );
  }
  function confirmClear(count) {
    var actions = document.getElementById("tc-actions");
    if (!actions) return;
    actions.innerHTML =
      '<div style="font-size:11px;color:#c94040;margin-bottom:10px;line-height:1.5;">' +
      "Permanently delete all " +
      count +
      " logged hands? Export first if you want to keep them." +
      "</div>" +
      '<div style="display:flex;gap:8px;">' +
      '<button id="tc-confirm" style="flex:1;padding:8px 14px;border-radius:4px;border:1px solid #c94040;background:transparent;color:#c94040;cursor:pointer;font-size:11px;font-family:Georgia,serif;">Yes, clear all</button>' +
      '<button id="tc-cancel" style="flex:1;padding:8px 14px;border-radius:4px;border:1px solid #8a7a5a;background:transparent;color:#8a7a5a;cursor:pointer;font-size:11px;font-family:Georgia,serif;">Cancel</button>' +
      "</div>";
    document.getElementById("tc-confirm").onclick = function () {
      clearStore().then(function () {
        var d = document.getElementById("tc-dropdown");
        if (d) d.remove();
        refreshTrigger();
      });
    };
    document.getElementById("tc-cancel").onclick = function () {
      var d = document.getElementById("tc-dropdown");
      if (d) d.remove();
      toggleDropdown();
    };
  }
  function buildPanel() {
    if (document.getElementById("tc-trigger")) return;
    var wrapper = document.createElement("div");
    wrapper.id = "tc-panel";
    wrapper.style.cssText =
      "position:relative;display:inline-flex;align-items:center;margin-right:10px;vertical-align:middle;";
    var btn = document.createElement("button");
    btn.id = "tc-trigger";
    btn.title = "TC Poker Tracker";
    btn.style.cssText = [
      "display:inline-flex",
      "align-items:center",
      "justify-content:center",
      "background:#0c0c0c",
      "border:1px solid #242424",
      "border-radius:6px",
      "color:#c8a94a",
      "font-family:Georgia,serif",
      "padding:5px 8px",
      "cursor:pointer",
      "line-height:1",
    ].join(";");
    btn.onclick = toggleDropdown;
    wrapper.appendChild(btn);
    var linksContainer = document.querySelector('[class*="linksContainer"]');
    if (linksContainer) linksContainer.prepend(wrapper);
    else {
      wrapper.style.cssText =
        "position:fixed;top:10px;left:50%;transform:translateX(-50%);z-index:99999;";
      document.body.appendChild(wrapper);
    }
    refreshTrigger();
    purgeForeignHands().then(
      function (removed) {
        if (removed) refreshTrigger();
      },
      function () {},
    );
    importHistoryOnce()
      .then(
        function (r) {
          if (!r.skipped && r.added) {
            refreshTrigger();
            setStatus("Imported " + r.added + " hands from your old data.");
          }
        },
        function (e) {
          console.warn("[TC Poker] history import failed", e);
          setStatus("Could not import your old hands.");
        },
      )
      .then(function () {
        // One-time duplicate cleanup first: deleting raw records makes the
        // store counts disagree, which the cache check below then repairs.
        return dedupeStoreOnce().then(
          function (removed) {
            if (removed) {
              console.log("[TC Poker] removed " + removed + " duplicate hands");
              refreshTrigger();
            }
          },
          function (e) {
            console.warn("[TC Poker] duplicate cleanup failed", e);
          },
        );
      })
      .then(function () {
        // Front-load the one-time export cache build so the Copy/Export
        // buttons never pay for it. No-op when the cache is current.
        ensureExportCache().then(
          function (n) {
            if (n) console.log("[TC Poker] export cache rebuilt: " + n + " hands");
          },
          function (e) {
            console.warn("[TC Poker] export cache rebuild failed", e);
          },
        );
      });
  }
  function tryBuild() {
    if (document.getElementById("tc-trigger")) return;
    if (window.location.href.indexOf("sid=holdem") === -1) return;
    if (document.querySelector('[class*="linksContainer"]')) buildPanel();
  }

  // --------------------------------------------------------------------------
  // Boot
  // --------------------------------------------------------------------------
  if (document.body) tryBuild();
  document.addEventListener("DOMContentLoaded", tryBuild);
  new MutationObserver(tryBuild).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
})();
