// PRNTR CEO app: the app shell works offline; the numbers always come from the network (the page keeps the last
// good copy itself, so a restarting server still shows something).
var CACHE = "prntr-ceo-v2";        // v2 (2026-11-25): the CEO hub (hub.js / hub.css)
var SHELL = ["/app/", "/app/index.html", "/app/manifest.webmanifest", "/app/icon-192.png", "/app/icon-512.png",
             "/app/apple-touch-icon.png", "/config.js", "/hub.js", "/hub.css"];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener("fetch", function (e) {
  var u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== self.location.origin) return;     // APIs on other hosts: untouched
  // the shell: network first (so an update shows at once), the cache when offline
  e.respondWith(fetch(e.request).then(function (r) {
    var copy = r.clone();
    caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
    return r;
  }).catch(function () { return caches.match(e.request).then(function (r) { return r || caches.match("/app/"); }); }));
});
