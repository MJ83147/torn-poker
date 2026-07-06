// The seat-code entries below (BTN, SB, BB, UTG, ...) overlap with the short
// display names in SEAT_NAMES (constants.js), but these are longer-form help
// text shown on hover, so they are intentionally kept separate.
const TIPS = {
  "Pocket Pairs": "Two cards of the same rank (e.g. 9♠ 9♥). Strong preflop, vulnerable to overcards.",
  Broadway: "Any two of T, J, Q, K, A. High-card hands that connect on high boards.",
  "Ace-Rag": "An ace paired with a weak kicker (2 to 9). Looks strong, but often loses to a better ace.",
  "Suited Connectors": "Consecutive ranks of the same suit (e.g. 7♥ 8♥). Play well as draws.",
  Suited: "Same suit, non-connecting. Backdoor flush potential only.",
  Connectors: "Consecutive ranks, different suits. Straight draw potential.",
  "Offsuit Trash": "Non-connected, non-suited weak cards. Fold almost always.",
  VPIP: "Voluntarily Put money In Pot. How often you choose to play a hand (calls and raises, not forced blinds).",
  "Win Rate": "Percentage of hands won out of all hands that reached a result.",
  Aggression: "How often you raise vs call. Higher aggression means you are betting and raising more than calling.",
  "Net P&L": "Net profit and loss. Total money won minus total money invested across all cash game hands.",
  "Avg Pot": "Average pot size across hands played.",
  PFR: "Pre-Flop Raise. How often a player raises before the flop. High PFR means an aggressive opener.",
  Limp: "Entering the pot by just calling the big blind instead of raising. Usually a passive, weak play.",
  "Fold to Raise": "How often a player folds when facing a raise. High values mean they give up easily under pressure.",
  WTSD: "Went To ShowDown. How often a player reaches showdown after seeing a flop. High WTSD means they rarely fold post-flop.",
  WSD: "Won at ShowDown. How often a player wins when they reach showdown. Low WSD suggests they call too much with weak hands.",
  "Fold Pre": "How often you fold before the flop. High fold rates from early position are normal.",
  "3-Bet": 'A re-raise over an opening raise. The "third" bet in a preflop sequence (blinds, open, 3-bet).',
  "All-In": "Betting all remaining chips on a single action. Forces a showdown if called.",
  "C-Bet": "Continuation bet. Betting the flop after raising preflop, continuing aggression regardless of whether the flop helped.",
  "Delayed C-Bet": "Betting the turn after checking the flop as the preflop raiser. A delayed continuation bet.",
  "Donk Bet": "Betting into the preflop raiser on the flop when you were not the raiser. Usually indicates a strong hand or a blocker bet.",
  "Fold to C-Bet": "How often you fold when the preflop raiser bets the flop. High fold rates may indicate exploitability.",
  "Fold to 3-Bet": "How often you fold when your opening raise is re-raised (3-bet). Very high fold rates let opponents steal your opens cheaply.",
  "Fold to 4-Bet": "How often you fold when your 3-bet is re-raised (4-bet). Folding is often correct here unless you have a premium hand.",
  BTN: "Button (Dealer). Best position at the table. Acts last on every street after the flop.",
  SB: "Small Blind. Forced half-bet posted before cards are dealt. Acts second-to-last preflop, first post-flop.",
  BB: "Big Blind. Forced full bet posted before cards are dealt. Defends the widest range preflop.",
  UTG: "Under The Gun. First to act preflop. Worst position, play tight here.",
  "UTG+1": "One seat after UTG. Still early position with poor information.",
  MP: "Middle Position. Moderate positional advantage, can widen range slightly.",
  LJ: "Lojack. Three seats before the button. Early-middle position, start of the steal zone.",
  HJ: "Hijack. Two seats before the button. Late-middle position with decent steal opportunity.",
  CO: "Cutoff. One seat before the button. Strong stealing position, second best seat.",
  Preflop: "The betting round before any community cards are dealt. Each player has only their two hole cards.",
  Flop: "The first three community cards dealt face up. This is where hand strength becomes clearer.",
  Turn: "The fourth community card. Bets typically double here.",
  River: "The fifth and final community card. Last chance to bet or bluff.",
  Fold: "Discard your hand and forfeit any chips already in the pot.",
  Check: "Pass the action without betting, only available if nobody has bet in the current round.",
  Bet: "Place the first wager in a betting round. Distinct from a raise, which increases an existing bet.",
  Call: "Match the current bet to stay in the hand.",
  Raise: "Increase the current bet, forcing others to put in more to continue.",
  Bluff: "Betting or raising with a weak hand to make opponents fold better hands.",
  "Semi-Bluff": "Betting with a drawing hand that could improve. You win if they fold now or if you hit your draw.",
  "Value Bet": "Betting a strong hand to extract chips from weaker hands that will call.",
  Showdown: "When remaining players reveal their cards after the final betting round to determine the winner.",
  Equity: "Your share of the pot based on the probability of winning. 50% equity in a $100 pot means $50 expected value.",
  "EV Diff": "The difference between your actual result and your expected value. Positive means you ran above expectation.",
  "Fair Share": 'The portion of the pot you "deserve" based on your equity at the time of an all-in.',
};

function switchTab(tabId) {
  document.querySelectorAll(".panel").forEach(function (p) {
    p.classList.remove("on");
  });
  var panel = document.getElementById("p-" + tabId);
  if (panel) panel.classList.add("on");
  document.querySelectorAll(".tab-item").forEach(function (t) {
    t.classList.remove("active");
  });
  document.querySelectorAll(".tab-menu-btn").forEach(function (b) {
    b.classList.remove("active");
  });
  var item = document.querySelector('.tab-item[data-tab="' + tabId + '"]');
  if (item) {
    item.classList.add("active");
    var menu = item.closest(".tab-menu");
    if (menu) menu.querySelector(".tab-menu-btn").classList.add("active");
  } else if (tabId.indexOf("hub-") === 0) {
    var hubBtn = document.querySelector('.tab-menu-btn[data-hub="' + tabId.slice(4) + '"]');
    if (hubBtn) hubBtn.classList.add("active");
  } else {
    var directBtn = document.querySelector('.tab-menu-btn[data-tab="' + tabId + '"]');
    if (directBtn) directBtn.classList.add("active");
  }
  var pw = document.getElementById("panels-wrap");
  if (pw) pw.classList.remove("blurred");
}

function _toggleBackdrop(show) {
  var pw = document.getElementById("panels-wrap");
  if (pw) pw.classList.toggle("blurred", show);
}

(function () {
  document.addEventListener("click", function (e) {
    var btn = e.target.closest(".tab-menu-btn");
    if (btn) {
      e.stopPropagation();
      _toggleBackdrop(false);
      // Section labels open their hub page; dropdowns open on hover (CSS).
      if (btn.dataset.hub) switchTab("hub-" + btn.dataset.hub);
      else if (btn.dataset.tab) switchTab(btn.dataset.tab);
      return;
    }
    var item = e.target.closest(".tab-item");
    if (item) {
      e.stopPropagation();
      switchTab(item.getAttribute("data-tab"));
      return;
    }
    _toggleBackdrop(false);
  });
})();

function tipWrap(label) {
  const def = TIPS[label];
  if (!def) return label;
  return '<span class="tooltip">' + label + ' <span class="text-meta">?</span><span class="tooltip-box">' + def + "</span></span>";
}

// severity -> style.css colour utilities (shared with story-engine vocabulary)
var INS_WORDS = { g: "Good", r: "Leak", a: "Warning", n: "Note", o: "Info" };
var INS_C = { g: "c-pos", r: "c-neg", a: "c-warn", n: "c-dim", o: "c-gold" };
var INS_BG = { g: "bg-pos", r: "bg-neg", a: "bg-warn", n: "bg-dim", o: "bg-gold" };
function ins(sev, label, text, chips, coaching) {
  var wordCls = INS_C[sev] || "c-dim";
  var dotCls = INS_BG[sev] || "bg-dim";
  const chipHtml =
    chips && chips.length
      ? '<div class="insight-chips">' +
        chips
          .map((c) => {
            var cls = "chip";
            if (c.hi) cls += " " + (INS_C[sev] || "c-dim");
            return '<span class="' + cls + '">' + c.v + "</span>";
          })
          .join("") +
        "</div>"
      : "";
  const coachingHtml = coaching ? '<div class="insight-coaching"><div class="eyebrow c-warn">Coaching</div><div class="text-body">' + coaching + "</div></div>" : "";
  return (
    '<div class="box insight"><div class="eyebrow insight-badge"><span class="dot ' +
    dotCls +
    '"></span><span class="' +
    wordCls +
    '">' +
    INS_WORDS[sev] +
    '</span></div><div class="card-title">' +
    label +
    '</div><div class="text-body">' +
    text +
    "</div>" +
    chipHtml +
    coachingHtml +
    "</div>"
  );
}

function insWithExample(sev, label, text, chips, exampleHands, coachingNote, coaching) {
  const base = ins(sev, label, text, chips, coaching);
  var handsList = !exampleHands ? [] : Array.isArray(exampleHands) ? exampleHands : [exampleHands];
  if (!handsList.length) return base;
  const btnId = "ex-" + Math.random().toString(36).slice(2, 8);
  const btn = '<button class="btn btn-ghost" id="' + btnId + '">See example hands</button>';
  const insertPoint = base.lastIndexOf("</div>");
  const result = base.slice(0, insertPoint) + btn + base.slice(insertPoint);
  setTimeout(function () {
    const el = document.getElementById(btnId);
    if (!el) return;
    el.onclick = function () {
      showExampleHandListModal(label, handsList, coachingNote);
    };
  }, 50);
  return result;
}

// Classify a value against a [lo, hi] band. Returns { cls, label } using the
// shared v-* color classes. null value -> no-data.
function bandVerdict(value, lo, hi) {
  if (value == null) return { cls: "v-na", label: "no data" };
  if (value < lo) return { cls: "v-low", label: "too low" };
  if (value > hi) return { cls: "v-high", label: "too high" };
  return { cls: "v-ok", label: "on target" };
}

// Format a {tight, loose} band as "X-Y%". '-' when absent.
function fmtBandRange(band) {
  if (!band) return "-";
  return Math.round(band.tight) + "-" + Math.round(band.loose) + "%";
}

/* ===== merged from ui-bindings.js ===== */
(function () {
  function bind() {
    var pageMeta = document.getElementById("page-meta");
    if (pageMeta) {
      pageMeta.addEventListener("click", function () {
        if (typeof switchTab === "function") switchTab("mygame");
      });
    }

    var tourBtn = document.getElementById("tour-btn");
    if (tourBtn) {
      tourBtn.addEventListener("click", function () {
        if (typeof startGuidedTour === "function") startGuidedTour();
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bind);
  } else {
    bind();
  }
})();
