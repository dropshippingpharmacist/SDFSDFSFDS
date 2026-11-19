/* PRNTR.AI — the only file to edit when a link changes. */
window.PRNTR = {
  calendly: "https://calendly.com/milesjpetersen/mentorship-call",     // the closer's 45-min call event (Miles, owner 2026-11-19)
  // Whop checkout (owner 2026-11-15; owner 2026-11-17: every tier is listed with its checkout link on index.html#pricing):
  //   1-on-1 $2,997 plan_vjcaQPnt6QhXy (2x$1,597 plan_mnFXkM79at3WF, 3x$1,097 plan_yboVpKOkPQl5H)
  //   group  $1,997 plan_ZiFZ4U6VMKX14 (2x$1,097 plan_5b8Y55jHB9eHX, 3x$747 plan_Sz8KBk8JbvF5d)
  //   course   $997 plan_aavYuuldKpAHf (2x$547 plan_kuML1BzRcltD7)
  // The old signal plans ($9.99 / $35 / $125 / $300 / $500) are archived in Whop.
  leadEndpoint: "https://excellentnqtct-va.onrender.com/api/lead",      // the free-guide email signups (the bot keeps the list)
  applyEndpoint: "https://excellentnqtct-va.onrender.com/api/apply",    // every application is kept by the bot (see /pipeline)
  eventEndpoint: "https://excellentnqtct-va.onrender.com/api/event",    // "call booked" (stops the book-your-call reminders)
  formEndpoint: "",                                                      // optional extra copy: Formspree / Make / Zapier webhook
  signalsDownsell: "https://whop.com/checkout/plan_qZhOsWsXKotvW",      // $199/month signals (Whop), shown ONLY on next.html
  instagram: "dropshippingpharmacist",                                  // without the @
  discord: "https://whop.com/checkout/plan_43Uz8O8LAJsKY",                // the free Discord, joined through Whop (we get the email)
  vslLanding: "https://www.youtube.com/embed/dkllBVYwXZA",              // replace with the 5-8 min "apply" video when recorded
  vslBooked: "",                                                         // the 10-15 min "before our call" video
  minBudget: 1000,                                                       // '$1,000–$2,000' and up get a call (course $997 · group $1,997 · 1-on-1 $2,997); under -> next.html
  spotsPerMonth: 5,
  showTracker: false                                                    // the public signal track record (index.html#tracker): off (owner 2026-11-19); true shows it again
};

/* WHERE THEY CAME FROM (owner 2026-11-19): the first link that brought someone here is remembered for 60 days, on any
   page, and sent with their application. Tag links with ?src=  (yt-02-ethfi, ig-bio, ig-dm, tt, x ...). With no tag,
   the site the click came from is used (youtube, instagram, tiktok, x, google ...). */
(function () {
  function clean(v) { return String(v || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40); }
  function guess(ref) {
    var h = ""; try { h = new URL(ref).hostname.replace(/^www\./, ""); } catch (e) { return ""; }
    if (!h || h === location.hostname.replace(/^www\./, "")) return "";
    var map = [["youtube", /youtube\.com|youtu\.be/], ["instagram", /instagram\.com|ig\.me/], ["tiktok", /tiktok\.com/],
               ["x", /(^|\.)x\.com|t\.co|twitter\.com/], ["facebook", /facebook\.com|fb\.com|m\.me/], ["google", /google\./],
               ["discord", /discord/], ["whop", /whop\.com/], ["linktree", /linktr\.ee/], ["pinterest", /pinterest\.|pin\.it/],
               ["threads", /threads\.(net|com)/], ["linkedin", /linkedin\.com|lnkd\.in/], ["snapchat", /snapchat\.com/],
               ["reddit", /reddit\.com/], ["telegram", /t\.me|telegram/], ["bing", /bing\.com/]];
    for (var i = 0; i < map.length; i++) if (map[i][1].test(h)) return map[i][0];
    return clean("ref-" + h.split(".").slice(-2, -1)[0]);
  }
  try {
    var q = new URLSearchParams(location.search), now = Date.now(), K = "prntr_src";
    var tag = clean(q.get("src") || q.get("utm_source") || "");
    var mc = (q.get("mc") || "").replace(/\D/g, "").slice(0, 25);
    var old = null; try { old = JSON.parse(localStorage.getItem(K) || "null"); } catch (e) {}
    if (old && now - old.t > 60 * 864e5) old = null;
    var src = tag || (old && old.src) || guess(document.referrer);
    if (src || mc) localStorage.setItem(K, JSON.stringify({ src: src || (old && old.src) || "", mc: mc || (old && old.mc) || "",
                                                          t: old && !tag ? old.t : now }));
    var got = JSON.parse(localStorage.getItem(K) || "null") || {};
    window.PRNTR_SOURCE = got.src || ""; window.PRNTR_MC = got.mc || "";
  } catch (e) { window.PRNTR_SOURCE = window.PRNTR_SOURCE || ""; window.PRNTR_MC = window.PRNTR_MC || ""; }
})();
