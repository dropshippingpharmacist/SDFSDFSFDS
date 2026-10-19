// node --test route/test — Route's rules, end to end over HTTP: accounts, mutual friends, privacy rounding,
// expiry, ghost mode, blocks, crossing paths, pull-ups and the link-up game.
import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "../server.mjs";

let clock = Date.parse("2026-10-20T12:00:00Z");
const { server } = createServer({ dbFile: ":memory:", now: () => clock });
await new Promise(r => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}`;
test.after(() => server.close());

function client() {
  let cookie = "";
  const call = async (method, p, body) => {
    const r = await fetch(base + p, { method, headers: { "content-type": "application/json", "x-route": "1", cookie },
                                      body: body ? JSON.stringify(body) : undefined });
    const sc = r.headers.get("set-cookie");
    if (sc) cookie = sc.split(";")[0];
    const j = await r.json();
    return { status: r.status, ...j };
  };
  return { post: (p, b) => call("POST", p, b || {}), get: p => call("GET", p) };
}
const A = client(), B = client(), C = client();
let aId, bId, cId;

test("accounts: sign up, wrong password, taken name", async () => {
  assert.equal((await A.post("/api/signup", { username: "ana", password: "password1", display: "Ana" })).ok, true);
  assert.equal((await B.post("/api/signup", { username: "ben", password: "password2" })).ok, true);
  assert.equal((await C.post("/api/signup", { username: "cal", password: "password3" })).ok, true);
  assert.equal((await client().post("/api/signup", { username: "ANA", password: "whatever12" })).status, 409);
  assert.equal((await client().post("/api/login", { username: "ana", password: "nope" })).status, 401);
  aId = (await A.get("/api/me")).id; bId = (await B.get("/api/me")).id; cId = (await C.get("/api/me")).id;
  assert.ok(aId && bId && cId);
});

test("no app header, no change; a GET never changes anything", async () => {
  const r = await fetch(base + "/api/ghost", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
  assert.equal(r.status, 403);
  assert.equal((await A.get("/api/ghost")).status, 405);
});

test("nobody sees anything until BOTH accept", async () => {
  await B.post("/api/routes", { label: "Blue Bottle", lat: 37.776123, lon: -122.423456, hours: 3 });
  assert.equal((await A.get("/api/feed")).friendsRoutes.length, 0);
  assert.equal((await A.post("/api/friends/request", { username: "ben" })).result, "requested");
  assert.equal((await A.get("/api/feed")).friendsRoutes.length, 0, "a pending request shows nothing");
  assert.equal((await B.get("/api/friends")).incoming[0].username, "ana");
  await B.post("/api/friends/respond", { userId: aId, accept: true });
  const f = await A.get("/api/feed");
  assert.equal(f.friendsRoutes.length, 1);
  assert.equal(f.friendsRoutes[0].lat, 37.78, "an area, never a doorstep (rounded to ~1 km)");
  assert.equal(f.friendsRoutes[0].lon, -122.42);
  assert.equal((await C.get("/api/feed")).friendsRoutes.length, 0, "a stranger sees nothing");
});

test("crossing paths: heading near the same place at the same time", async () => {
  await A.post("/api/routes", { label: "Dolores Park", lat: 37.7596, lon: -122.4269, hours: 2 });
  const r = (await A.get("/api/feed")).friendsRoutes[0];
  assert.equal(r.crossing, "Dolores Park", "Ben's spot is ~2 km from Ana's: crossing paths");
  assert.ok(r.km < 3);
});

test("ghost mode hides everything at once, and shares expire on their own", async () => {
  await B.post("/api/ghost", { on: true });
  assert.equal((await A.get("/api/feed")).friendsRoutes.length, 0);
  await B.post("/api/ghost", { on: false });
  assert.equal((await A.get("/api/feed")).friendsRoutes.length, 1);
  clock += 4 * 36e5;                                    // Ben's 3-hour share is over
  assert.equal((await A.get("/api/feed")).friendsRoutes.length, 0);
  const capped = await B.post("/api/routes", { label: "All day", lat: 37.7, lon: -122.4, hours: 99 });
  assert.ok(capped.id);
  clock += 12.5 * 36e5;
  assert.equal((await A.get("/api/feed")).friendsRoutes.length, 0, "no share lives past 12 hours");
});

test("pull up -> I'm down -> both confirm -> points, reconnect bonus, once a day", async () => {
  const p1 = (await A.post("/api/pullup", { toId: bId, message: "omw" })).id;
  assert.equal((await A.post("/api/linkup", { pullupId: p1 })).status, 400, "not before they say down");
  await B.post("/api/pullup/respond", { id: p1, answer: "down" });
  assert.equal((await A.post("/api/linkup", { pullupId: p1 })).result, "waiting for them to confirm");
  assert.equal((await A.get("/api/score")).me.points, 0, "one side alone earns nothing");
  assert.equal((await B.post("/api/linkup", { pullupId: p1 })).result, "linked: reconnected bonus");
  const s = await A.get("/api/score");
  assert.equal(s.me.points, 35);
  assert.ok(s.me.badges.find(b => b.id === "linked").earned && s.me.badges.find(b => b.id === "pulled-up").earned);
  assert.deepEqual(s.board.map(x => x.username).sort(), ["ana", "ben"], "the board is you and your friends only");
  const p2 = (await A.post("/api/pullup", { toId: bId })).id;
  await B.post("/api/pullup/respond", { id: p2, answer: "down" });
  await A.post("/api/linkup", { pullupId: p2 });
  assert.equal((await B.post("/api/linkup", { pullupId: p2 })).result, "linked (already counted today)");
  assert.equal((await A.get("/api/score")).me.points, 35, "no farming the same friend twice a day");
  clock += 864e5 + 1;
  const p3 = (await A.post("/api/pullup", { toId: bId })).id;
  await B.post("/api/pullup/respond", { id: p3, answer: "down" });
  await A.post("/api/linkup", { pullupId: p3 });
  await B.post("/api/linkup", { pullupId: p3 });
  assert.equal((await A.get("/api/score")).me.points, 45, "next day: 10 more, no second reconnect bonus");
  assert.equal((await C.post("/api/pullup", { toId: aId })).status, 403, "strangers cannot pull up");
});

test("a block removes the friendship, hides both ways, and looks like 'no such user'", async () => {
  await B.post("/api/routes", { label: "Gym", lat: 37.7, lon: -122.4, hours: 2 });
  await A.post("/api/block", { userId: bId });
  assert.equal((await A.get("/api/feed")).friendsRoutes.length, 0);
  assert.equal((await B.get("/api/feed")).friendsRoutes.length, 0);
  assert.equal((await B.post("/api/friends/request", { username: "ana" })).status, 404);
  assert.equal((await B.post("/api/pullup", { toId: aId })).status, 403);
});

test("the site, the app and the launchpad are served", async () => {
  for (const p of ["/", "/app", "/launch/", "/launch/config.js"]) {
    const r = await fetch(base + p);
    assert.equal(r.status, 200, p);
  }
  assert.equal((await fetch(base + "/launch/api/create", { method: "POST", body: "{}" })).status, 400);
  assert.equal((await fetch(base + "/launch/dev.mjs")).status, 404);
});
