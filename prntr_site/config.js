/* PRNTR.AI — the only file to edit when a link changes. */
window.PRNTR = {
  calendly: "https://calendly.com/[YOUR_CALENDLY]/mentorship-call",     // the 45-min call event (see the blueprint for its settings)
  // owner 2026-11-15 (HanckFX: "low ticket is not a business"): the signal plans are NOT sold on the site any more;
  // the signals come with the mentorship. These links stay only for members who already bought one.
  signals: {                                                             // Whop checkout links for PRNTR Signals (one per plan)
    day: "https://whop.com/checkout/plan_M1i7PpdNlNRhe",          // $9.99 / 1 day
    week: "https://whop.com/checkout/plan_LLii730Boa2we",        // $35 / week
    month: "https://whop.com/checkout/plan_5P6kMVbpLNckw",      // $125 / month
    quarter: "https://whop.com/checkout/plan_8LlB6MUwp5JD1",  // $300 / 3 months
    lifetime: "https://whop.com/checkout/plan_soJuhgMrHfa3e" // $500 lifetime
  },
  leadEndpoint: "https://excellentnqtct-va.onrender.com/api/lead",      // the free-guide email signups (the bot keeps the list)
  applyEndpoint: "https://excellentnqtct-va.onrender.com/api/apply",    // every application is kept by the bot (see /pipeline)
  eventEndpoint: "https://excellentnqtct-va.onrender.com/api/event",    // "call booked" (stops the book-your-call reminders)
  formEndpoint: "",                                                      // optional extra copy: Formspree / Make / Zapier webhook
  signalsDownsell: "",                                                   // the $199/month signals checkout (Whop plan link), shown ONLY on next.html
  instagram: "dropshippingpharmacist",                                  // without the @
  discord: "https://discord.gg/MX8hdHWgcE",
  vslLanding: "https://www.youtube.com/embed/dkllBVYwXZA",              // replace with the 5-8 min "apply" video when recorded
  vslBooked: "",                                                         // the 10-15 min "before our call" video
  minBudget: 1000,                                                       // '$1,000–$2,000' and up get a call (course $997 · group $1,997 · 1-on-1 $2,997); under -> next.html
  spotsPerMonth: 5,
  showTracker: false                                                     // the public signal track record (index.html#tracker): true shows it again
};
