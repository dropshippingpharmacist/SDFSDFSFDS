/* PRNTR.AI — the only file to edit when a link changes. */
window.PRNTR = {
  calendly: "https://calendly.com/[YOUR_CALENDLY]/mentorship-call",     // the 45-min call event (see the blueprint for its settings)
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
  showTracker: true                                                     // the public signal track record (index.html#tracker): true shows it again
};
