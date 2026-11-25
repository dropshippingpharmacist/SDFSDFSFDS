/* PRNTR CEO HUB (owner 2026-11-25: "I just want everything in one spot so I don't have to keep worrying about anything
   missing"). Shared by the CEO page (ceo.html) and the phone app (app/index.html): it draws what used to live only on
   /pipeline and the closer portal, from GET /api/ceo/hub (owner password), and sends every change through the same
   endpoints /pipeline uses (stage, payment link, call scoring) and the closer's report endpoint. Every change asks
   to confirm first. /pipeline keeps working as the fallback. */
(function () {
  var H = window.PRNTRHub = {};
  var cfg = { api: "", auth: function () { return {}; }, reload: function () {} };
  var data = null, calls = null, peopleQ = "", peopleF = "all", peopleN = 40;

  function esc(v) { return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function money(v) { return v == null ? "-" : "$" + Math.round(Number(v || 0)).toLocaleString(); }
  function money2(v) { return "$" + Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function pc(v) { return v == null ? "-" : Math.round(v) + "%"; }
  function day(ts) { return ts ? new Date(ts * 1000).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "-"; }
  function when(ts) { if (!ts) return "time not known"; var d = new Date(ts * 1000); return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }) + " · " + d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }); }
  function rel(ts) {
    if (!ts) return ""; var s = ts - Date.now() / 1000, a = Math.abs(s), u = a < 3600 ? Math.round(a / 60) + " min" : a < 86400 ? Math.round(a / 3600) + " h" : Math.round(a / 86400) + " d";
    return s >= 0 ? "in " + u : u + " ago";
  }
  function el(id) { return document.getElementById(id); }
  function put(id, html) { var e = el(id); if (e) e.innerHTML = html; }
  function tile(label, val, sub, cls) { return '<div class="hb-t' + (cls ? " " + cls : "") + '"><span>' + esc(label) + "</span><b>" + esc(val == null ? "-" : val) + "</b>" + (sub ? "<small>" + esc(sub) + "</small>" : "") + "</div>"; }
  function badge(txt, kind) { return '<span class="hb-badge ' + (kind || "") + '">' + esc(txt) + "</span>"; }
  function empty(t) { return '<p class="hb-empty">' + esc(t) + "</p>"; }
  function stageLabel(s) { return String(s || "").replace(/_/g, " "); }
  function opt(v, label, sel) { return '<option value="' + esc(v) + '"' + (sel ? " selected" : "") + ">" + esc(label) + "</option>"; }
  function O() { return (data && data.options) || { stages: [], outcomes: [], objections: {}, tiers: [], labels: {}, prices: {}, report_outcomes: {} }; }
  function stageKind(s) { return /^(won|downsold)$/.test(s) ? "ok" : /no_show|lost|went_south|not_a_fit|canceled/.test(s) ? "bad" : /booked|showed|pitched/.test(s) ? "warn" : ""; }

  // ------------------------------------------------------------------ writes (owner password, confirm first)
  function post(path, body) {
    return fetch(cfg.api + path, { method: "POST", headers: Object.assign({ "Content-Type": "application/json" }, cfg.auth()), body: JSON.stringify(body) })
      .then(function (r) { return r.json().catch(function () { return { ok: false, why: "HTTP " + r.status }; }).then(function (j) { if (r.status === 401) j.why = "Wrong or missing owner password."; return j; }); })
      .catch(function () { return { ok: false, why: "The server didn't answer (it may be restarting). Nothing was changed. Try again in a minute." }; });
  }
  function toast(msg, bad) {
    var t = el("hb-toast"); if (!t) { t = document.createElement("div"); t.id = "hb-toast"; t.setAttribute("role", "status"); document.body.appendChild(t); }
    t.className = bad ? "bad" : ""; t.textContent = msg; t.hidden = false; clearTimeout(t._h); t._h = setTimeout(function () { t.hidden = true; }, 4000);
  }
  function person(email) { return ((data && data.applicants) || []).filter(function (a) { return a.email === email; })[0]; }
  function saveStage(email, stage, ed, label) {
    var a = person(email) || {}, who = a.name || email;
    var body = { email: email, stage: stage, sold: ed ? ed.sold : (a.sold || ""), amount: ed ? ed.amount : (a.amount == null ? "" : a.amount),
                 objection: ed ? ed.objection : (a.objection || ""), note: ed ? ed.note : (a.note || "") };
    if (/^(won|downsold)$/.test(stage) && !body.sold) { toast("Pick what they bought first (open the person and choose the program).", true); return; }
    var track = (O().follow || {})[stage];
    var msg = (label ? 'Mark ' + who + ' as "' + label + '"' : "Save " + who + ' as "' + stageLabel(stage) + '"') + "?" +
      (track ? "\n\nThis starts the " + track.replace(/_/g, " ") + " follow-up." : stage === "booked" ? "\n\nThis starts the call reminders." : "");
    if (!window.confirm(msg)) return;
    post("/api/pipeline/stage", body).then(function (j) { if (j.ok) { toast("Saved: " + who + " → " + stageLabel(stage)); dirty = 0; cfg.reload(); } else toast("Not saved: " + (j.why || "error"), true); });
  }

  // ------------------------------------------------------------------ needs attention
  var ATT = { outcome: "Mark the outcome", failed_payment: "Payment", late_installment: "Payment", blocked: "Follow-ups", call: "Call", new_app: "New lead", setup: "Setup" };
  function quickOutcomes(email) {
    var o = O().outcomes.slice(); o.unshift(["showed", "Showed"]); o.push(["won", "Won"]);
    return '<div class="hb-ocs">' + o.map(function (x) { return '<button type="button" data-act="oc" data-e="' + esc(email) + '" data-s="' + esc(x[0]) + '">' + esc(x[1]) + "</button>"; }).join("") + "</div>";
  }
  function attItem(x) {
    var lvl = x.level === "bad" ? "bad" : x.level === "warn" ? "warn" : "info";
    return '<li class="' + lvl + '"><div class="hb-row"><b>' + esc(x.title) + "</b>" + badge(ATT[x.kind] || x.kind, lvl === "info" ? "" : lvl) + "</div>" +
      '<div class="hb-m">' + esc(x.detail) + (x.kind === "call" && x.ts ? " · " + esc(when(x.ts)) : "") + "</div>" +
      (x.kind === "outcome" ? quickOutcomes(x.email) : "") +
      (x.email ? '<button type="button" class="hb-link" data-act="open" data-e="' + esc(x.email) + '">Open ' + esc(x.email) + " →</button>" : "") + "</li>";
  }
  H.attention = function (id) {
    var all = (data && data.attention) || [];
    var setupMiss = all.filter(function (x) { return x.kind === "setup"; }), a = all.filter(function (x) { return x.kind !== "setup"; });
    if (setupMiss.length) a.push({ kind: "setup", level: "warn", title: setupMiss.length + " setting" + (setupMiss.length === 1 ? "" : "s") + " missing on Render",
      detail: setupMiss.map(function (x) { return x.title.replace(/^Not set up: /, ""); }).join(" · ") + " (see Setup for what each one breaks)" });
    if (!a.length) { put(id, '<div class="hb-clear">All clear: nothing needs you right now.</div>'); return; }
    var SHOW = 5, head = '<p class="hb-sub">' + all.length + " thing" + (all.length === 1 ? "" : "s") + " to look at</p>";
    put(id, head + '<ul class="hb-att">' + a.slice(0, SHOW).map(attItem).join("") + "</ul>" +
      (a.length > SHOW ? '<details class="hb-attmore"><summary class="hb-more">Show ' + (a.length - SHOW) + ' more</summary><ul class="hb-att">' + a.slice(SHOW).map(attItem).join("") + "</ul></details>" : ""));
  };

  // ------------------------------------------------------------------ targets
  H.targets = function (id) {
    var t = (data && data.targets) || [];
    var per = data ? (data.days ? "last " + data.days + " days" : "all time") : "";
    put(id, t.length ? '<div class="hb-tiles hb-3">' + t.map(function (x) {
      var v = x.value == null ? "-" : /^Cash/.test(x.label) ? money(x.value) : Math.round(x.value) + "%";
      var cls = x.ok === true ? "ok" : x.ok === false ? "low" : "none";
      var st = x.ok === true ? "on target" : x.ok === false ? "below target" : "no data yet";
      return '<div class="hb-t hb-target ' + cls + '"><span>' + esc(x.label) + "</span><b>" + esc(v) + "</b><small>target " + esc(x.goal.replace(">=", "≥")) + " · " + st + "</small></div>";
    }).join("") + '</div><p class="hb-note">Over the ' + esc(per) + ". Below 80% show = a post-booking problem · below 45% close = a qualifying problem · low cash per show = the offer presentation.</p>" : empty("No numbers yet."));
  };

  // ------------------------------------------------------------------ follow-ups
  H.followups = function (id) {
    var f = data && data.followups;
    if (!f) { put(id, empty("No follow-up data.")); return; }
    var badges = '<div class="hb-badges">' + badge("Sending: " + (f.on ? "LIVE" : "OFF (dry run)"), f.on ? "ok" : "bad") +
      badge("Email: " + (f.email_ready ? "ready" : "not set up"), f.email_ready ? "ok" : "bad") +
      badge("Texts: " + (f.sms_ready ? "ready" : "not set up"), f.sms_ready ? "ok" : "warn") +
      badge(f.people + " people in follow-ups") + badge(f.unsubscribed + " unsubscribed") + "</div>";
    var per = data.days ? "last " + data.days + " days" : "all time";
    var rows = f.tracks.filter(function (t) { return t.recovery || t.in_now || t.emails_sent || t.texts_sent || t.rebooked || t.converted; }).map(function (t) {
      var ppl = t.people.length ? '<ul class="hb-list">' + t.people.slice(0, 60).map(function (p) {
        return '<li><div class="hb-row"><b>' + esc(p.name || p.email) + "</b><span class=\"hb-m\">" + p.sent + " of " + p.of + " sent</span></div>" +
          '<div class="hb-m">' + esc(p.email) + (p.unsubscribed ? " · unsubscribed" : "") + (p.next ? " · next (" + (p.next_ch === "sms" ? "text" : "email") + "): " + esc(p.next) + " · " + esc(rel(p.next_at)) : " · finished") + "</div></li>";
      }).join("") + (t.people.length > 60 ? '<li class="hb-m">and ' + (t.people.length - 60) + " more</li>" : "") + "</ul>" : empty("Nobody in this track right now.");
      return '<details class="hb-card hb-track"><summary><div class="hb-row"><b>' + esc(t.label) + "</b><span class=\"hb-tog\">▸</span></div>" +
        '<div class="hb-nums"><span><b>' + t.in_now + "</b> in it now</span><span><b>" + t.emails_sent + "</b> email" + (t.emails_sent === 1 ? "" : "s") + (t.texts_sent ? " · " + t.texts_sent + " text" + (t.texts_sent === 1 ? "" : "s") : "") + " sent</span><span><b>" + t.rebooked + "</b> rebooked</span><span><b>" + t.converted + "</b> bought</span></div></summary>" +
        '<div class="hb-m">' + t.steps + " messages in the track</div>" + ppl + "</details>";
    }).join("");
    var due = f.due_soon.length ? '<ul class="hb-list">' + f.due_soon.slice(0, 40).map(function (x) {
      var k = /^blocked|^dry/.test(x.why) ? "bad" : /skipped/.test(x.why) ? "warn" : "ok";
      return '<li><div class="hb-row"><b>' + esc(x.name || x.email) + "</b>" + badge(x.due_now ? "due now" : rel(x.at), x.due_now ? "warn" : "") + "</div>" +
        '<div class="hb-m">' + esc(x.track_label) + " · " + (x.ch === "sms" ? "text" : "email") + ": " + esc(x.what) + "</div>" +
        (x.why ? '<div class="hb-m">' + badge(x.why, k) + "</div>" : "") + "</li>";
    }).join("") + "</ul>" : empty("Nothing due in the next 48 hours.");
    put(id, badges + '<p class="hb-note">Sent, rebooked and bought: ' + esc(per) + ". Tap a track to see who is in it. Rebooked / bought = the track they were in just before.</p>" +
      '<div class="hb-tracks">' + rows + "</div><h3>Due in the next 48 hours</h3>" + due);
  };

  // ------------------------------------------------------------------ people (applicants, search, stage changes, outcomes)
  function matches(a) {
    var q = peopleQ.trim().toLowerCase();
    if (q && [a.name, a.email, a.phone, a.instagram, a.source, a.stage, a.fit, a.note].join(" ").toLowerCase().indexOf(q) < 0) return false;
    var s = a.stage;
    if (peopleF === "open") return /^(applied|started|booked|showed|pitched)$/.test(s);
    if (peopleF === "booked") return /^(booked|showed|pitched)$/.test(s);
    if (peopleF === "won") return /^(won|downsold)$/.test(s);
    if (peopleF === "lost") return /no_show|lost|went_south|not_a_fit|canceled/.test(s);
    return true;
  }
  function editor(a) {
    var o = O();
    var st = o.stages.map(function (s) { return opt(s, stageLabel(s), s === a.stage); }).join("");
    var so = opt("", "sold…", !a.sold) + o.tiers.map(function (t) { return opt(t, (o.labels[t] || t) + " $" + Number(o.prices[t] || 0).toLocaleString(), t === a.sold); }).join("");
    var ob = opt("", "objection…", !a.objection) + Object.keys(o.objections).map(function (k) { return opt(k, o.objections[k], k === a.objection); }).join("");
    var buttons = [["booked", "Booked"], ["showed", "Showed"], ["pitched", "Pitched"], ["won", "Won"]].concat(o.outcomes);
    return '<div class="hb-ed" data-e="' + esc(a.email) + '">' +
      '<label>Stage<select data-f="stage">' + st + "</select></label>" +
      '<label>Sold<select data-f="sold">' + so + "</select></label>" +
      '<label>$ amount<input data-f="amount" type="number" min="0" step="1" inputmode="numeric" placeholder="list price if blank" value="' + esc(a.amount == null ? "" : a.amount) + '"></label>' +
      '<label>Objection<select data-f="objection">' + ob + "</select></label>" +
      '<label class="hb-wide">Note<input data-f="note" value="' + esc(a.note) + '" maxlength="500"></label>' +
      '<button type="button" class="hb-primary" data-act="save" data-e="' + esc(a.email) + '">Save</button></div>' +
      '<div class="hb-m" style="margin-top:8px">End of call (starts the matching follow-up):</div><div class="hb-ocs">' +
      buttons.map(function (b) { return '<button type="button" data-act="oc-ed" data-e="' + esc(a.email) + '" data-s="' + esc(b[0]) + '"' + (b[0] === a.stage ? " disabled" : "") + ">" + esc(b[1]) + "</button>"; }).join("") + "</div>";
  }
  function personCard(a) {
    var ig = a.instagram ? String(a.instagram).replace(/^@/, "") : "";
    var reach = [a.phone ? '<a href="tel:' + esc(a.phone) + '">Call</a>' : "", a.phone ? '<a href="sms:' + esc(a.phone) + '">Text</a>' : "",
      '<a href="mailto:' + esc(a.email) + '">Email</a>', ig ? '<a href="https://instagram.com/' + esc(ig) + '" target="_blank" rel="noopener">IG @' + esc(ig) + "</a>" : ""].filter(Boolean).join(" · ");
    var hist = (a.history || []).map(function (h) { return esc(stageLabel(h[0])) + " " + day(h[1]); }).join(" → ");
    return '<details class="hb-card hb-person" id="p-' + esc(a.email) + '" data-e="' + esc(a.email) + '"><summary><div class="hb-row"><b>' + esc(a.name || a.email) + "</b>" + badge(stageLabel(a.stage), stageKind(a.stage)) + "</div>" +
      '<div class="hb-m">' + day(a.ts) + (a.fit ? " · fit " + esc(a.fit) : "") + (a.invest ? " · " + esc(a.invest) : "") + (a.source ? " · from " + esc(a.source) : "") + (a.partial ? " · unfinished" : "") +
      (a.amount ? " · " + money(a.amount) : "") + (a.call_ts ? " · call " + esc(when(a.call_ts)) : "") + "</div></summary>" +
      '<div class="hb-body"><div class="hb-m">' + esc(a.email) + (a.phone ? " · " + esc(a.phone) + (a.sms_ok ? " (texts ok)" : "") : "") + "</div><div class=\"hb-reach\">" + reach + "</div>" +
      '<div class="hb-qa"><div><b>Trading:</b> ' + esc(a.stage_answer || "-") + " · <b>Ready:</b> " + esc(a.ready || "-") + "</div>" +
      "<div><b>Struggle:</b> " + esc(a.struggle || "-") + "</div><div><b>Goal:</b> " + esc(a.goal || "-") + "</div>" +
      (a.heard ? "<div><b>Heard from:</b> " + esc(a.heard) + "</div>" : "") +
      "<div><b>Follow-up now:</b> " + esc(a.track ? a.track.replace(/_/g, " ") : "none") + (a.report ? " · <b>Call report:</b> " + esc(stageLabel(a.report)) : "") + "</div>" +
      (a.contract ? "<div><b>Contract:</b> " + money(a.contract) + " · " + (a.pif ? "paid in full" : "payment plan") + " · " + a.paid_n + " payment" + (a.paid_n === 1 ? "" : "s") + "</div>" : "") +
      (hist ? '<div class="hb-m">' + hist + "</div>" : "") + "</div>" + editor(a) + "</div></details>";
  }
  H.people = function (id) {
    var box = el(id); if (!box) return;
    if (!box.querySelector(".hb-search")) {
      box.innerHTML = '<div class="hb-search"><input type="search" placeholder="Search name, email, phone, IG, source…" aria-label="Search people"><div class="hb-chips" role="group" aria-label="Filter">' +
        [["all", "All"], ["open", "Open"], ["booked", "Booked"], ["won", "Won"], ["lost", "Lost / no-show"]].map(function (f) { return '<button type="button" data-f="' + f[0] + '"' + (f[0] === peopleF ? ' class="on"' : "") + ">" + f[1] + "</button>"; }).join("") +
        '</div></div><div class="hb-plist"></div>';
      var inp = box.querySelector("input");
      inp.value = peopleQ;
      inp.oninput = function () { peopleQ = inp.value; peopleN = 40; drawPeople(box); };
      box.querySelectorAll(".hb-chips button").forEach(function (b) { b.onclick = function () { peopleF = b.dataset.f; peopleN = 40; box.querySelectorAll(".hb-chips button").forEach(function (x) { x.classList.toggle("on", x === b); }); drawPeople(box); }; });
    }
    drawPeople(box);
  };
  function drawPeople(box) {
    var all = (data && data.applicants) || [], list = all.filter(matches);
    var open = {}; box.querySelectorAll("details.hb-person[open]").forEach(function (d) { open[d.dataset.e] = 1; });
    box.querySelector(".hb-plist").innerHTML = '<p class="hb-sub">' + list.length + " of " + all.length + " people</p>" +
      (list.length ? list.slice(0, peopleN).map(personCard).join("") : empty(all.length ? "Nobody matches." : "No applications yet.")) +
      (list.length > peopleN ? '<button type="button" class="hb-more" data-act="more">Show ' + Math.min(40, list.length - peopleN) + " more</button>" : "");
    Object.keys(open).forEach(function (e) { var d = document.getElementById("p-" + e); if (d) d.open = true; });
  }
  H.open = function (email) {
    var a = person(email);
    if (!a) { toast("That person isn't in the applications (they may have paid without applying)."); return; }
    if (cfg.showPeople) cfg.showPeople();
    var box = document.querySelector(".hb-plist");
    if (box && !document.getElementById("p-" + email)) { peopleQ = email; peopleF = "all"; var i = box.parentNode.querySelector("input"); if (i) i.value = email; drawPeople(box.parentNode); }
    var d = document.getElementById("p-" + email);
    if (d) { d.open = true; d.scrollIntoView({ block: "start", behavior: "smooth" }); }
  };

  // ------------------------------------------------------------------ calls (the closer portal: every booked call + the report form)
  H.calls = function (upId, pastId, cd) {
    if (cd) calls = cd;
    var all = ((calls || {}).calls || []).slice(), now = Date.now() / 1000, o = (calls && calls.options) || {};
    var up = all.filter(function (c) { return c.call_ts && c.call_ts >= now - 3600; }).sort(function (a, b) { return a.call_ts - b.call_ts; });
    var past = all.filter(function (c) { return !c.call_ts || c.call_ts < now - 3600; }).sort(function (a, b) { return (b.call_ts || b.booked_ts || 0) - (a.call_ts || a.booked_ts || 0); });
    function opts(m) { return Object.keys(m || {}).map(function (k) { return opt(k, m[k]); }).join(""); }
    function card(x, form) {
      var a = x.app || {}, ig = a.instagram ? String(a.instagram).replace(/^@/, "") : "";
      var pst = (person(x.email) || {}).stage;
      var tag = x.reported ? badge("reported: " + x.reported) : (pst && pst !== "booked" && pst !== "showed") ? badge("marked: " + stageLabel(pst), stageKind(pst)) : x.overdue ? badge("report overdue", "bad") : x.confirmed ? badge("confirmed", "ok") : badge("not confirmed", "warn");
      var reach = [a.phone ? '<a href="tel:' + esc(a.phone) + '">Call</a>' : "", a.phone ? '<a href="sms:' + esc(a.phone) + '">Text</a>' : "", ig ? '<a href="https://instagram.com/' + esc(ig) + '" target="_blank" rel="noopener">Instagram</a>' : ""].filter(Boolean).join(" · ");
      var f = (!form || x.reported) ? "" : '<form class="hb-report" data-e="' + esc(x.email) + '"><div class="hb-ed">' +
        '<label>Outcome<select name="outcome" required><option value="">Pick one</option>' + opts(o.outcomes) + "</select></label>" +
        '<label>Bought (if closed)<select name="sold"><option value="">-</option>' + (o.tiers || []).map(function (t) { return opt(t, t); }).join("") + "</select></label>" +
        '<label>Objection<select name="objection"><option value="">-</option>' + opts(o.objections) + "</select></label>" +
        '<label>Recording link<input name="recording" placeholder="https://..." inputmode="url"></label>' +
        '<label class="hb-wide">Note<input name="note" maxlength="500"></label><button class="hb-primary">Send report</button></div></form>';
      return '<details class="hb-card' + (x.overdue ? " hb-late" : "") + '"><summary><div class="hb-row"><b>' + esc(x.name || x.email) + "</b>" + tag + '</div><div class="hb-m">' + esc(when(x.call_ts)) + "</div></summary>" +
        '<div class="hb-body hb-qa"><div><b>Budget:</b> ' + esc(a.invest || "-") + " · <b>Fit:</b> " + esc(a.fit || "-") + " · <b>Trading:</b> " + esc(a.stage_answer || "-") + "</div>" +
        "<div><b>Struggle:</b> " + esc(a.struggle || "-") + "</div><div><b>Goal:</b> " + esc(a.goal || "-") + "</div>" +
        (reach ? '<div class="hb-reach">' + reach + "</div>" : "") + '<div class="hb-m">' + esc(x.email) + "</div>" + f + "</div></details>";
    }
    put(upId, up.length ? up.map(function (x) { return card(x, false); }).join("") : empty("No calls booked."));
    put(pastId, past.length ? past.slice(0, 40).map(function (x) { return card(x, true); }).join("") : empty("No past calls."));
  };

  // ------------------------------------------------------------------ money and payments
  H.money = function (id) {
    if (!data) return;
    var k = data.kpis, m = data.money, o = O();
    var tiles = '<div class="hb-tiles">' + tile("Cash collected", money(k.cash), k.customers + " customers", "money") + tile("Contract revenue", money(k.contract), pc(k.cash_to_rev) + " collected") +
      tile("Paid in full", pc(k.pif_rate), "of plans with a known type") + tile("Average sale", k.aov ? money(k.aov) : "-") + tile("Cash per show", k.cash_per_call ? money(k.cash_per_call) : "-") + tile("Still owed", money(m.owed_total), m.owed.length + " on payment plans") + "</div>";
    var link = '<form class="hb-card hb-linkform"><b>Make a payment link (any amount)</b><div class="hb-ed">' +
      '<label>Program<select name="tier">' + ["1on1", "group", "course"].map(function (t) { return opt(t, o.labels[t] || t); }).join("") + "</select></label>" +
      '<label>$ per payment<input name="amount" type="number" min="50" max="100000" step="1" inputmode="numeric" value="4997"></label>' +
      '<label>Payments<input name="payments" type="number" min="1" max="12" step="1" inputmode="numeric" value="1"></label>' +
      '<label class="hb-wide">Note (who it\'s for)<input name="note" maxlength="200"></label><button class="hb-primary">Create link</button></div>' +
      '<p class="hb-m hb-linkout">A hidden Whop checkout with the agreement signature. Paste it to them on the call.</p></form>';
    var links = m.links.length ? '<ul class="hb-list">' + m.links.slice(0, 10).map(function (l) {
      return '<li><div class="hb-row"><b>' + esc(o.labels[l.tier] || l.tier) + " · " + (l.n > 1 ? l.n + " × " + money(l.total / l.n) : money(l.total)) + '</b><button type="button" class="hb-mini" data-act="copy" data-v="' + esc(l.url) + '">Copy</button></div><div class="hb-m">' + day(l.ts) + (l.note ? " · " + esc(l.note) : "") + ' · <a href="' + esc(l.url) + '" target="_blank" rel="noopener">open</a></div></li>';
    }).join("") + "</ul>" : empty("No custom links made yet.");
    var cust = m.customers.length ? '<ul class="hb-list">' + m.customers.slice(0, 60).map(function (c) {
      var kind = c.pif === true ? badge("paid in full", "ok") : c.pif === false ? badge("payment plan", "warn") : badge("type unknown");
      return '<li><div class="hb-row"><b>' + esc(c.name || c.email) + "</b>" + (c.refunded ? badge("refunded", "bad") : kind) + "</div>" +
        '<div class="hb-m">' + esc(o.labels[c.sold] || c.sold || "?") + (c.stage === "downsold" ? " (downsell)" : "") + " · cash " + money(c.paid) + (c.contract ? " of " + money(c.contract) + " contract" : "") +
        (c.installments > 1 ? " · " + c.payments.length + " of " + c.installments + " payments" : "") + (c.applied ? "" : " · paid without applying") + " · " + day(c.ts) + "</div></li>";
    }).join("") + "</ul>" : empty("No customers yet.");
    var owed = m.owed.length ? '<ul class="hb-list">' + m.owed.map(function (x) {
      return '<li><div class="hb-row"><b>' + esc(x.name || x.email) + "</b>" + (x.late ? badge("late", "bad") : badge("next " + day(x.next_due))) + '</div><div class="hb-m">' + esc(o.labels[x.sold] || x.sold) + " · paid " + money(x.paid) + " · <b>" + money(x.left) + " still owed</b> · " + x.made + " of " + esc(x.of) + " payments · next due " + day(x.next_due) + "</div></li>";
    }).join("") + '<li><b>Total to collect: ' + money(m.owed_total) + "</b></li></ul>" : empty("Nobody owes anything right now.");
    var failed = m.failed.length ? '<ul class="hb-list">' + m.failed.map(function (x) {
      return '<li><div class="hb-row"><b>' + esc(x.name || x.email) + "</b>" + badge("failed " + day(x.ts), "bad") + '</div><div class="hb-m">' + esc(x.label) + " · " + esc(x.email) + " · reminders sent: " + (x.sent.length ? esc(x.sent.join(", ")) : "the first email") + "</div></li>";
    }).join("") + "</ul>" : empty("No failed payments.");
    put(id, tiles + link + "<h3>Links made</h3>" + links + "<h3>Failed payments</h3>" + failed + "<h3>Money still owed (payment plans)</h3>" + owed + "<h3>Customers (cash vs contract)</h3>" + cust);
  };

  // ------------------------------------------------------------------ every number, sources, objections, advice, calculator
  function kTiles(k) {
    return '<div class="hb-tiles">' + [["Playbook signups", k.signups, ""], ["Applications", k.applications, pc(k.apply_rate) + " of signups"], ["Calls booked", k.booked, pc(k.book_rate) + " of qualified"],
      ["Showed", k.showed, pc(k.show_rate) + " show rate"], ["Pitched", k.pitched, pc(k.offer_rate) + " offer rate"], ["Closed", k.won, pc(k.close_rate) + " close · " + pc(k.pitch_close_rate) + " of pitched"],
      ["Cash collected", money(k.cash), "AOV " + (k.aov ? money(k.aov) : "-")], ["Contract revenue", money(k.contract), pc(k.cash_to_rev) + " cash-to-revenue"],
      ["Paid in full", pc(k.pif_rate), k.customers + " customers"], ["Cash per call", k.cash_per_call ? money(k.cash_per_call) : "-", "cash ÷ calls showed"],
      ["Unfinished applications", k.started, pc(k.finish_rate) + " finish rate"], ["No-shows", k.no_shows, pc(k.no_show_rate) + " of booked"]]
      .map(function (t) { return tile(t[0], t[1], t[2]); }).join("") + "</div>";
  }
  H.numbers = function (id) {
    if (!data) return;
    var k = data.kpis, per = data.days ? "Last " + data.days + " days" : "All time";
    var six = '<div class="hb-tiles">' + tile("Signups", k.signups) + tile("Applications", k.applications) + tile("Book rate", pc(k.book_rate)) + tile("Show rate", pc(k.show_rate)) + tile("Close rate", pc(k.close_rate)) + tile("Average order", k.aov ? money(k.aov) : "-") + tile("Offer rate", pc(k.offer_rate), "of calls that showed") + "</div>";
    var src = Object.keys(k.by_source || {});
    var srcs = src.length ? '<ul class="hb-list">' + src.map(function (s) { var v = k.by_source[s]; return '<li class="hb-row"><span><b>' + esc(s) + '</b><br><span class="hb-m">' + v.applications + " applied · " + v.booked + " booked · " + v.won + " closed</span></span><b class=\"hb-g\">" + money(v.cash) + "</b></li>"; }).join("") + "</ul>" : empty("No applications in this period.");
    var obj = (k.objections || []).length ? '<ul class="hb-list">' + k.objections.map(function (x) { return '<li><div class="hb-row"><b>' + esc(x.label) + "</b><b>" + x.count + '</b></div><div class="hb-m">Post next: ' + esc(x.post) + "</div></li>"; }).join("") + "</ul>" : empty("No objections logged yet. Pick the main objection on each person after the call.");
    var adv = (k.advice || []).length ? '<ul class="hb-list">' + k.advice.map(function (a) { return "<li>" + esc(a) + "</li>"; }).join("") + "</ul>" : empty("Price and funnel advice starts at 10 calls.");
    put(id, "<h3>The six numbers · " + esc(per) + "</h3>" + six + "<h3>" + esc(per) + "</h3>" + kTiles(k) + "<h3>All time</h3>" + kTiles(data.kpis_all) +
      "<h3>Revenue by source · " + esc(per.toLowerCase()) + "</h3>" + srcs + "<h3>Objections → what to post next</h3>" + obj + "<h3>Price and funnel advice</h3>" + adv +
      "<h3>Reverse-engineer a revenue goal</h3>" + calculator());
    calcRun();
  };
  var CALC = [["g", "Monthly goal $", 50000], ["a", "Upfront per sale $", 2400], ["l", "Lifetime ÷ upfront", 1.3], ["c", "Close %", 40], ["s", "Show %", 75], ["b", "Book % of page visits", 8], ["r", "Link click % of views", 4], ["v", "Videos a month", 6]];
  function calculator() {
    return '<div class="hb-card"><div class="hb-ed hb-calc">' + CALC.map(function (c) { return '<label>' + esc(c[1]) + '<input type="number" step="any" inputmode="decimal" data-calc="' + c[0] + '" value="' + c[2] + '"></label>'; }).join("") + '</div><p class="hb-calcout"></p></div>';
  }
  function calcRun() {
    var box = document.querySelectorAll(".hb-calc"); box.forEach(function (b) {
      var card = b.parentNode, n = function (k) { return parseFloat(card.querySelector('[data-calc="' + k + '"]').value) || 0; }, f = function (x) { return isFinite(x) ? Math.ceil(x).toLocaleString() : "-"; };
      var sales = n("g") / (n("a") * n("l")), shows = sales / (n("c") / 100), callsN = shows / (n("s") / 100), visits = callsN / (n("b") / 100), views = visits / (n("r") / 100), per = views / n("v");
      card.querySelector(".hb-calcout").innerHTML = "To make $" + f(n("g")) + " a month you need <b>" + f(sales) + " sales</b> ← " + f(shows) + " calls that show ← <b>" + f(callsN) + " booked calls</b> ← " + f(visits) + " page visits ← " + f(views) + " views a month = <b>" + f(per) + " views per video</b> at " + n("v") + " videos a month.";
    });
  }

  // ------------------------------------------------------------------ closer (owner's view)
  H.closer = function (id) {
    var c = data && data.closer; if (!c) { put(id, empty("No closer data.")); return; }
    var s = c.score30, a = c.score_all, cm = c.commission, oc = O().report_outcomes || {};
    var tiles = '<div class="hb-tiles">' + tile("Calls booked (30d / all)", s.booked + " / " + a.booked) + tile("Reports done (30d)", s.reported, s.overdue + " overdue", s.overdue ? "low" : "") +
      tile("Show rate (30d)", pc(s.show_rate)) + tile("Close rate (30d)", pc(s.close_rate), s.won + " closed") + tile("Calls recorded (30d)", pc(s.recorded_rate)) +
      tile("Cash on his calls", money(cm.cash), "from Whop, not typed in") + tile("Commission payable", money2(cm.payable), cm.pct + "% · past the refund window") + tile("Commission pending", money2(cm.pending), "still refundable") + "</div>";
    var late = c.late.length ? '<ul class="hb-list">' + c.late.map(function (x) { return "<li><b>" + esc(x.name || x.email) + '</b> <span class="hb-m">call ' + esc(when(x.call_ts)) + "</span></li>"; }).join("") + "</ul>" : empty("No overdue reports.");
    var com = cm.rows.length ? '<ul class="hb-list">' + cm.rows.map(function (r) { return '<li><div class="hb-row"><b>' + esc(r.name || r.email) + "</b>" + badge(r.status, r.status === "payable" ? "ok" : r.status === "refunded" ? "bad" : "warn") + '</div><div class="hb-m">' + esc(r.tier) + " · paid " + money2(r.amount) + " " + day(r.paid_ts) + " · clears " + day(r.clears_ts) + " · commission " + money2(r.commission) + "</div></li>"; }).join("") + "</ul>" : empty("No payments on his calls yet.");
    var act = c.activity.length ? '<ul class="hb-list">' + c.activity.map(function (x) { return '<li><div class="hb-row"><span>' + esc(x.by) + " · " + esc(x.kind) + '</span><span class="hb-m">' + esc(when(x.ts)) + '</span></div><div class="hb-m">' + esc(x.email) + (x.outcome ? " · " + esc(oc[x.outcome] || x.outcome) : "") + (x.sold ? " · " + esc(x.sold) : "") + (x.recording ? " · recorded" : "") + "</div></li>"; }).join("") + "</ul>" : empty("Nothing yet.");
    put(id, "<p class=\"hb-sub\">" + esc(c.name) + "</p>" + tiles + "<h3>Overdue reports</h3>" + late + "<h3>Commission by payment</h3>" + com + "<h3>Activity</h3>" + act);
  };

  // ------------------------------------------------------------------ call reviews
  H.reviews = function (id) {
    var r = data && data.reviews; if (!r) return;
    var sm = r.summary || {}, sec = r.sections || {};
    var head = r.ready ? "" : '<p class="hb-note">' + badge("off", "warn") + " Call reviews need ANTHROPIC_API_KEY on Render.</p>";
    var tiles = sm.calls ? '<div class="hb-tiles">' + tile("Calls reviewed", sm.calls, sm.won + " closed") + tile("Average call", sm.overall + "/5") + tile("Closer talk share", pc(sm.closer_talk), "aim for under 40%") + tile("Compliance flags", sm.flagged, "calls with a problem", sm.flagged ? "low" : "") + "</div>" +
      '<ul class="hb-list">' + Object.keys(sm.sections || {}).map(function (k) { var lab = String(sec[k] || k).split(":"); return '<li class="hb-row"><span>' + esc(lab[0]) + '</span><b>' + (sm.sections[k] == null ? "-" : sm.sections[k] + "/5") + "</b></li>"; }).join("") + "</ul>" : "";
    var list = r.calls.length ? r.calls.map(function (c) {
      var head = esc(when(c.ts)) + " · " + esc(c.email || c.title || "call") + (c.url ? ' · <a href="' + esc(c.url) + '" target="_blank" rel="noopener">recording</a>' : "");
      if (!c.result) return '<div class="hb-card"><div class="hb-m">' + head + "</div><div>" + esc(c.status === "scoring" ? "Scoring…" : (c.why || c.status)) + "</div>" + (c.status === "scoring" ? "" : '<button type="button" class="hb-mini" data-act="rescore" data-id="' + esc(c.id) + '">Score again</button>') + "</div>";
      var x = c.result, flags = (x.compliance || []).map(function (f) { return '<li class="hb-r">' + esc((r.flags || {})[f.issue] || f.issue) + ": “" + esc(f.quote) + "”</li>"; }).join("");
      return '<details class="hb-card"><summary><div class="hb-m">' + head + '</div><div class="hb-row"><b>' + esc(x.prospect_name || "") + " · " + esc(String(x.outcome || "").replace(/_/g, " ")) + '</b><span class="hb-stars">' + "★★★★★".slice(0, Math.round(x.overall || 0)) + "☆☆☆☆☆".slice(0, 5 - Math.round(x.overall || 0)) + "</span></div></summary>" +
        '<div class="hb-body hb-qa"><p>' + esc(x.summary) + "</p>" + (flags ? "<ul>" + flags + "</ul>" : "") + "<b>Fix next time:</b><ol>" + (x.tips || []).map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") + "</ol>" +
        (x.content_idea ? "<div><b>Video idea:</b> " + esc(x.content_idea) + "</div>" : "") + "</div></details>";
    }).join("") : empty("No calls yet. Connect Fathom (its webhook → /api/calls) or paste a transcript below.");
    var form = '<details class="hb-card"><summary><b>Score a call by pasting its transcript</b></summary><form class="hb-score"><div class="hb-ed"><label>Their email<input name="email" type="email"></label><label>Recording link (optional)<input name="url" inputmode="url"></label></div>' +
      '<textarea name="transcript" rows="6" placeholder="Paste the full transcript (Fathom, Zoom or Google Meet)"></textarea><button class="hb-primary">Score this call</button> <span class="hb-m hb-scoreout"></span></form></details>';
    put(id, head + tiles + list + form);
  };

  // ------------------------------------------------------------------ stories, research, downloads, setup
  H.stories = function (id) {
    var s = (data && data.stories) || [];
    put(id, s.length ? s.map(function (x) { return '<div class="hb-card hb-qa"><div class="hb-m">' + esc(x.name) + " · sharing: " + esc(x.share) + " · " + day(x.ts) + "</div><div><b>Before:</b> " + esc(x.before) + "</div><div><b>What changed:</b> " + esc(x.change) + "</div><div><b>Now:</b> " + esc(x.now) + "</div>" + (x.proof ? "<div><b>Proof:</b> " + esc(x.proof) + "</div>" : "") + "</div>"; }).join("")
      : empty("No student stories yet. They're asked automatically (group day 21, 1-on-1 day 30 and 60, course day 14)."));
  };
  H.research = function (id) {
    var s = (data && data.research) || [];
    put(id, s.length ? s.map(function (x) { return '<div class="hb-card hb-qa"><div class="hb-m">' + esc(x.email) + " · " + day(x.ts) + "</div><div><b>Found us:</b> " + esc(x.where) + " · " + esc(x.video) + "</div><div><b>Followed for:</b> " + esc(x.how_long) + "</div><div><b>Tipping point:</b> " + esc(x.tipping) + "</div><div><b>Almost stopped them:</b> " + esc(x.almost) + "</div><div><b>Wants most:</b> " + esc(x.want) + "</div></div>"; }).join("")
      : empty("No answers yet. Every buyer gets the form in their welcome email."));
  };
  H.downloads = function (id) {
    put(id, '<div class="hb-chips"><button type="button" data-act="csv" data-p="/api/apps.csv" data-n="prntr_applications.csv">Download applications.csv</button><button type="button" data-act="csv" data-p="/api/leads.csv" data-n="prntr_signups.csv">Download signups.csv</button></div>');
  };
  H.setup = function (id) {
    var s = (data && data.setup) || [];
    put(id, s.length ? '<ul class="hb-list">' + s.map(function (x) {
      return '<li><div class="hb-row"><b>' + esc(x.label) + "</b>" + badge(x.set ? "set" : x.required ? "missing" : "not set (optional)", x.set ? "ok" : x.required ? "bad" : "") + '</div><div class="hb-m">' + esc(x.key) + (x.set ? "" : " · without it, " + esc(x.why)) + "</div></li>";
    }).join("") + '</ul><p class="hb-note">Only whether each setting exists is shown, never its value. Change them on Render → excellentnqtct-va → Environment.</p>' : empty("No setup data."));
  };

  // ------------------------------------------------------------------ one delegated handler for every button and form
  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-act]"); if (!b) return;
    var act = b.dataset.act;
    if (act === "oc") { var lb = b.textContent; saveStage(b.dataset.e, b.dataset.s, null, lb); }
    else if (act === "oc-ed" || act === "save") {
      var card = b.closest(".hb-person"), ed = {};
      card.querySelectorAll("[data-f]").forEach(function (f) { ed[f.dataset.f] = f.value; });
      if (act === "oc-ed") { ed.stage = b.dataset.s; saveStage(b.dataset.e, b.dataset.s, ed, b.textContent); } else saveStage(b.dataset.e, ed.stage, ed, "");
    }
    else if (act === "open") H.open(b.dataset.e);
    else if (act === "more") { peopleN += 40; drawPeople(b.closest(".hb-plist").parentNode); }
    else if (act === "copy") { (navigator.clipboard ? navigator.clipboard.writeText(b.dataset.v) : Promise.reject()).then(function () { toast("Link copied."); }, function () { window.prompt("Copy the link:", b.dataset.v); }); }
    else if (act === "rescore") {
      if (!window.confirm("Score this call again?")) return;
      b.disabled = true; b.textContent = "Scoring…";
      post("/api/pipeline/call", { id: b.dataset.id }).then(function (j) { b.textContent = j.ok === false ? "Failed: " + (j.why || "") : "Scoring. Refresh in a minute."; });
    }
    else if (act === "csv") {
      b.disabled = true;
      fetch(cfg.api + b.dataset.p, { headers: cfg.auth(), cache: "no-store" }).then(function (r) { if (!r.ok) throw r.status; return r.blob(); }).then(function (bl) {
        var a = document.createElement("a"); a.href = URL.createObjectURL(bl); a.download = b.dataset.n; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000); b.disabled = false;
      }).catch(function () { b.disabled = false; toast("Download failed. The server may be restarting.", true); });
    }
  });
  var dirty = 0;
  function inHub(t) { return t && t.closest && t.closest(".hb-ed, .hb-report, .hb-linkform, .hb-score, .hb-search"); }
  document.addEventListener("input", function (e) { if (e.target.matches("[data-calc]")) calcRun(); else if (inHub(e.target)) dirty = Date.now(); });
  document.addEventListener("change", function (e) { if (inHub(e.target) && !e.target.matches("[data-calc]")) dirty = Date.now(); });
  // true while the owner is typing or has unsaved changes (the app's auto-refresh waits, so nothing typed is lost)
  H.busy = function () { var a = document.activeElement; return !!(inHub(a) && a.matches("input, select, textarea")) || (dirty && Date.now() - dirty < 5 * 60000); };
  H.clean = function () { dirty = 0; };
  document.addEventListener("submit", function (e) {
    var f = e.target, o = {};
    if (!f.matches(".hb-report, .hb-linkform, .hb-score")) return;
    e.preventDefault();
    new FormData(f).forEach(function (v, k) { o[k] = v; });
    var btn = f.querySelector("button.hb-primary");
    if (f.matches(".hb-report")) {
      o.email = f.dataset.e; o.rid = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      var oc = (calls && calls.options && calls.options.outcomes) || {};
      if (!o.outcome) { toast("Pick an outcome.", true); return; }
      if (!window.confirm("Send this call report for " + o.email + ": " + (oc[o.outcome] || o.outcome) + "?\n\nIt moves them on the pipeline and starts the matching follow-up.")) return;
      btn.disabled = true;
      post("/api/closer/report", o).then(function (j) { btn.disabled = false; if (j.ok) { toast("Report saved."); dirty = 0; cfg.reload(); } else toast("Not saved: " + (j.why || "error"), true); });
    } else if (f.matches(".hb-linkform")) {
      var lab = (O().labels || {})[o.tier] || o.tier, n = parseInt(o.payments, 10) || 1;
      if (!window.confirm("Create a Whop payment link: " + lab + ", " + (n > 1 ? n + " payments of $" : "$") + Number(o.amount || 0).toLocaleString() + (o.note ? " (for " + o.note + ")" : "") + "?")) return;
      var out = f.querySelector(".hb-linkout"); btn.disabled = true; out.textContent = "Creating…";
      post("/api/pipeline/link", o).then(function (j) {
        btn.disabled = false;
        if (j.ok) { out.innerHTML = 'Link: <a href="' + esc(j.url) + '" target="_blank" rel="noopener">' + esc(j.url) + '</a> <button type="button" class="hb-mini" data-act="copy" data-v="' + esc(j.url) + '">Copy</button>'; }
        else out.textContent = j.why || "Failed";
      });
    } else {
      if (!String(o.transcript || "").trim()) { toast("Paste the transcript first.", true); return; }
      if (!window.confirm("Send this transcript to be scored?")) return;
      var so = f.querySelector(".hb-scoreout"); btn.disabled = true; so.textContent = "Sending…";
      post("/api/pipeline/call", o).then(function (j) { btn.disabled = false; so.textContent = j.ok ? (j.skipped || (j.dup ? "Already scored." : "Scoring now. Refresh in a minute.")) : (j.why || "Failed"); });
    }
  });

  H.init = function (o) { Object.keys(o).forEach(function (k) { cfg[k] = o[k]; }); };
  H.set = function (d) { data = d; };
  H.setCalls = function (d) { calls = d; };
  H.data = function () { return data; };
  H.url = function (days) { var tz = -new Date().getTimezoneOffset(); return cfg.api + "/api/ceo/hub?tz=" + tz + (days ? "&days=" + days : ""); };
})();
