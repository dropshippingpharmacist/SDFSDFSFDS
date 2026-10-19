// db.mjs — Route's data: users, sessions, mutual friendships, blocks, shared routes ("I'm heading to…"),
// "I'm around here" pins, and pull-ups. Node's built-in SQLite (Node 22.13+), one file on the data volume.
//
// PRIVACY RULES THE DATA ITSELF ENFORCES
//   * places are stored ROUNDED to 2 decimals (about 1 km): an area, never a doorstep
//   * every share expires: a route after at most MAX_ROUTE_HOURS, a "here" pin after at most MAX_HERE_HOURS
//   * only ACCEPTED friends see anything; a block removes the friendship and hides both ways
//   * ghost mode hides all of your shares at once (they come back when ghost mode is off, if not expired)
import { DatabaseSync } from "node:sqlite";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const MAX_ROUTE_HOURS = 12;
export const MAX_HERE_HOURS = 6;
export const CROSS_KM = 3;                 // two places this close at overlapping times = crossing paths
export const NEAR_KM = 80;                 // "in your area" (about a county)

export const round = v => Math.round(Number(v) * 100) / 100;

export function km(a, b) {
  const R = 6371, rad = x => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function openDb(file) {
  if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY, username TEXT NOT NULL UNIQUE COLLATE NOCASE, display TEXT NOT NULL,
      pass TEXT NOT NULL, ghost INTEGER NOT NULL DEFAULT 0, created INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS friends (
      a INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, b INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status TEXT NOT NULL CHECK (status IN ('pending','accepted')), requester INTEGER NOT NULL, created INTEGER NOT NULL,
      PRIMARY KEY (a, b), CHECK (a < b));
    CREATE TABLE IF NOT EXISTS blocks (
      blocker INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, blocked INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      PRIMARY KEY (blocker, blocked));
    CREATE TABLE IF NOT EXISTS routes (
      id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, label TEXT NOT NULL,
      lat REAL NOT NULL, lon REAL NOT NULL, leave_at INTEGER NOT NULL, expires INTEGER NOT NULL, created INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS here (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, lat REAL NOT NULL, lon REAL NOT NULL,
      updated INTEGER NOT NULL, expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS pullups (
      id INTEGER PRIMARY KEY, from_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      to_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, route_id INTEGER, message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent','down','notnow')), created INTEGER NOT NULL,
      expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS linkups (
      pullup_id INTEGER PRIMARY KEY, a INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      b INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, a_ok INTEGER NOT NULL DEFAULT 0,
      b_ok INTEGER NOT NULL DEFAULT 0, done_at INTEGER, counted INTEGER NOT NULL DEFAULT 0, reconnect INTEGER NOT NULL DEFAULT 0);
    CREATE INDEX IF NOT EXISTS routes_user ON routes(user_id, expires);
    CREATE INDEX IF NOT EXISTS pull_to ON pullups(to_id, expires);
  `);
  return db;
}

// ---- the game: link-ups, points, streaks, badges (in-app only; never tied to a token or money)
export const POINTS = { linkup: 10, reconnect: 25 };
const WEEK = 7 * 864e5;
const BADGES = [
  ["first-route", "First Route", "Shared where you were heading"],
  ["pulled-up", "Pulled Up", "Sent your first pull-up"],
  ["linked", "Linked", "Your first confirmed link-up"],
  ["butterfly", "Social Butterfly", "Linked up with 5 different friends"],
  ["regular", "Regular", "Linked up 4 weeks in a row"],
];

// ---- passwords + sessions ---------------------------------------------------------------------------------------
export function hashPass(pw) {
  const salt = crypto.randomBytes(16);
  const h = crypto.scryptSync(pw, salt, 32, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString("hex")}$${h.toString("hex")}`;
}
export function checkPass(pw, stored) {
  const [, s, h] = String(stored).split("$");
  if (!s || !h) return false;
  const got = crypto.scryptSync(pw, Buffer.from(s, "hex"), 32, { N: 16384, r: 8, p: 1 });
  return crypto.timingSafeEqual(got, Buffer.from(h, "hex"));
}
const sha = t => crypto.createHash("sha256").update(t).digest("hex");

export function makeApi(db, now = () => Date.now()) {
  const q = sql => db.prepare(sql);
  const pair = (x, y) => (x < y ? [x, y] : [y, x]);

  const api = {
    // accounts
    signup(username, password, display) {
      if (!/^[a-z0-9_]{3,20}$/i.test(username || "")) throw err(400, "Usernames are 3–20 letters, numbers or _.");
      if (String(password || "").length < 8) throw err(400, "Use a password of at least 8 characters.");
      const d = String(display || username).trim().slice(0, 30) || username;
      try {
        const r = q("INSERT INTO users (username, display, pass, created) VALUES (?, ?, ?, ?)")
          .run(username, d, hashPass(password), now());
        return Number(r.lastInsertRowid);
      } catch (e) {
        if (/UNIQUE/.test(e.message)) throw err(409, "That username is taken.");
        throw e;
      }
    },
    login(username, password) {
      const u = q("SELECT id, pass FROM users WHERE username = ?").get(username || "");
      if (!u || !checkPass(String(password || ""), u.pass)) throw err(401, "Wrong username or password.");
      return u.id;
    },
    newSession(userId, days = 30) {
      const token = crypto.randomBytes(32).toString("base64url");
      q("INSERT INTO sessions (token, user_id, expires) VALUES (?, ?, ?)").run(sha(token), userId, now() + days * 864e5);
      return token;
    },
    userBySession(token) {
      if (!token) return null;
      const r = q(`SELECT u.id, u.username, u.display, u.ghost FROM sessions s JOIN users u ON u.id = s.user_id
                   WHERE s.token = ? AND s.expires > ?`).get(sha(token), now());
      return r || null;
    },
    endSession(token) { if (token) q("DELETE FROM sessions WHERE token = ?").run(sha(token)); },
    setGhost(me, on) { q("UPDATE users SET ghost = ? WHERE id = ?").run(on ? 1 : 0, me); },

    // friends (mutual opt-in) and blocks
    blocked(x, y) {
      return !!q("SELECT 1 FROM blocks WHERE (blocker = ? AND blocked = ?) OR (blocker = ? AND blocked = ?)").get(x, y, y, x);
    },
    request(me, username) {
      const u = q("SELECT id FROM users WHERE username = ?").get(username || "");
      if (!u) throw err(404, "No one with that username.");
      if (u.id === me) throw err(400, "That's you.");
      if (api.blocked(me, u.id)) throw err(404, "No one with that username.");   // a block is invisible
      const [a, b] = pair(me, u.id);
      const f = q("SELECT status, requester FROM friends WHERE a = ? AND b = ?").get(a, b);
      if (f && f.status === "accepted") return "already friends";
      if (f && f.requester !== me) {                       // they asked me first: asking back accepts
        q("UPDATE friends SET status = 'accepted' WHERE a = ? AND b = ?").run(a, b);
        return "accepted";
      }
      if (!f) q("INSERT INTO friends (a, b, status, requester, created) VALUES (?, ?, 'pending', ?, ?)").run(a, b, me, now());
      return "requested";
    },
    respond(me, otherId, accept) {
      const [a, b] = pair(me, otherId);
      const f = q("SELECT requester, status FROM friends WHERE a = ? AND b = ?").get(a, b);
      if (!f || f.status !== "pending" || f.requester === me) throw err(404, "No request from them.");
      if (accept) q("UPDATE friends SET status = 'accepted' WHERE a = ? AND b = ?").run(a, b);
      else q("DELETE FROM friends WHERE a = ? AND b = ?").run(a, b);
    },
    unfriend(me, otherId) {
      const [a, b] = pair(me, otherId);
      q("DELETE FROM friends WHERE a = ? AND b = ?").run(a, b);
    },
    block(me, otherId) {
      if (otherId === me) throw err(400, "That's you.");
      api.unfriend(me, otherId);
      q("INSERT OR IGNORE INTO blocks (blocker, blocked) VALUES (?, ?)").run(me, otherId);
      q("DELETE FROM pullups WHERE (from_id = ? AND to_id = ?) OR (from_id = ? AND to_id = ?)").run(me, otherId, otherId, me);
    },
    friendIds(me) {
      return q(`SELECT CASE WHEN a = ? THEN b ELSE a END AS id FROM friends
                WHERE (a = ? OR b = ?) AND status = 'accepted'`).all(me, me, me).map(r => r.id);
    },
    isFriend(me, other) {
      const [a, b] = pair(me, other);
      return !!q("SELECT 1 FROM friends WHERE a = ? AND b = ? AND status = 'accepted'").get(a, b);
    },
    friends(me) {
      const rows = q(`SELECT u.id, u.username, u.display, f.status, f.requester FROM friends f
                      JOIN users u ON u.id = CASE WHEN f.a = ? THEN f.b ELSE f.a END
                      WHERE f.a = ? OR f.b = ? ORDER BY u.display`).all(me, me, me);
      return {
        friends: rows.filter(r => r.status === "accepted").map(pub),
        incoming: rows.filter(r => r.status === "pending" && r.requester !== me).map(pub),
        outgoing: rows.filter(r => r.status === "pending" && r.requester === me).map(pub),
      };
    },

    // sharing
    shareRoute(me, { label, lat, lon, leaveInMin = 0, hours = 3 }) {
      const L = String(label || "").trim().slice(0, 60);
      if (!L) throw err(400, "Say where you're heading.");
      checkLatLon(lat, lon);
      const h = Math.min(MAX_ROUTE_HOURS, Math.max(0.5, Number(hours) || 3));
      const leave = now() + Math.min(24 * 60, Math.max(0, Number(leaveInMin) || 0)) * 6e4;
      const r = q("INSERT INTO routes (user_id, label, lat, lon, leave_at, expires, created) VALUES (?, ?, ?, ?, ?, ?, ?)")
        .run(me, L, round(lat), round(lon), leave, leave + h * 36e5, now());
      return Number(r.lastInsertRowid);
    },
    endRoute(me, id) { q("DELETE FROM routes WHERE id = ? AND user_id = ?").run(id, me); },
    shareHere(me, { lat, lon, hours = 2 }) {
      checkLatLon(lat, lon);
      const h = Math.min(MAX_HERE_HOURS, Math.max(0.25, Number(hours) || 2));
      q(`INSERT INTO here (user_id, lat, lon, updated, expires) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET lat = excluded.lat, lon = excluded.lon, updated = excluded.updated,
         expires = excluded.expires`).run(me, round(lat), round(lon), now(), now() + h * 36e5);
    },
    clearHere(me) { q("DELETE FROM here WHERE user_id = ?").run(me); },

    // pull-ups
    pullUp(me, toId, routeId, message) {
      if (!api.isFriend(me, toId)) throw err(403, "You can only pull up on friends.");
      const recent = q("SELECT COUNT(*) AS n FROM pullups WHERE from_id = ? AND to_id = ? AND created > ?")
        .get(me, toId, now() - 36e5).n;
      if (recent >= 3) throw err(429, "You've pulled up on them 3 times this hour. Give them a minute.");
      const m = String(message || "I'm pulling up").trim().slice(0, 140) || "I'm pulling up";
      const r = q("INSERT INTO pullups (from_id, to_id, route_id, message, created, expires) VALUES (?, ?, ?, ?, ?, ?)")
        .run(me, toId, routeId || null, m, now(), now() + 6 * 36e5);
      return Number(r.lastInsertRowid);
    },
    answerPullUp(me, id, answer) {
      if (!["down", "notnow"].includes(answer)) throw err(400, "Answer down or notnow.");
      const r = q("UPDATE pullups SET status = ? WHERE id = ? AND to_id = ?").run(answer, id, me);
      if (!r.changes) throw err(404, "No such pull-up.");
    },

    // the game. A link-up = a pull-up the friend said "down" to, confirmed by BOTH people. It counts for points once
    // per pair per day (no farming); the pair's first counted link-up ever is a Reconnected bonus.
    linkUp(me, pullupId) {
      const p = q("SELECT id, from_id, to_id, status, created FROM pullups WHERE id = ?").get(pullupId);
      if (!p || (p.from_id !== me && p.to_id !== me)) throw err(404, "No such pull-up.");
      if (p.status !== "down") throw err(400, "They have to say they're down first.");
      if (now() - p.created > 24 * 36e5) throw err(400, "That pull-up is over a day old.");
      const [a, b] = pair(p.from_id, p.to_id);
      q("INSERT OR IGNORE INTO linkups (pullup_id, a, b) VALUES (?, ?, ?)").run(p.id, a, b);
      q(`UPDATE linkups SET ${me === a ? "a_ok" : "b_ok"} = 1 WHERE pullup_id = ?`).run(p.id);
      const l = q("SELECT * FROM linkups WHERE pullup_id = ?").get(p.id);
      if (l.a_ok && l.b_ok && !l.done_at) {
        const t = now();
        const today = q(`SELECT 1 FROM linkups WHERE a = ? AND b = ? AND counted = 1 AND done_at > ?`).get(a, b, t - 864e5);
        const ever = q(`SELECT 1 FROM linkups WHERE a = ? AND b = ? AND counted = 1`).get(a, b);
        q("UPDATE linkups SET done_at = ?, counted = ?, reconnect = ? WHERE pullup_id = ?")
          .run(t, today ? 0 : 1, !today && !ever ? 1 : 0, p.id);
        return today ? "linked (already counted today)" : (!ever ? "linked: reconnected bonus" : "linked");
      }
      return l.done_at ? "already linked" : "waiting for them to confirm";
    },
    score(me) {
      const rows = q(`SELECT a, b, done_at, reconnect FROM linkups WHERE counted = 1 AND (a = ? OR b = ?)`).all(me, me);
      const points = rows.length * POINTS.linkup + rows.filter(r => r.reconnect).length * POINTS.reconnect;
      const people = new Set(rows.map(r => (r.a === me ? r.b : r.a)));
      const weeks = new Set(rows.map(r => Math.floor(r.done_at / WEEK)));
      let streak = 0, w = Math.floor(now() / WEEK);
      if (!weeks.has(w)) w--;                      // this week has no link-up yet: the streak can still be alive
      while (weeks.has(w)) { streak++; w--; }
      const has = {
        "first-route": !!q("SELECT 1 FROM routes WHERE user_id = ?").get(me) || !!q("SELECT 1 FROM linkups WHERE a = ? OR b = ?").get(me, me),
        "pulled-up": !!q("SELECT 1 FROM pullups WHERE from_id = ?").get(me),
        linked: rows.length > 0, butterfly: people.size >= 5, regular: streak >= 4,
      };
      return { points, linkups: rows.length, friendsLinked: people.size, streakWeeks: streak,
               badges: BADGES.map(([id, name, why]) => ({ id, name, why, earned: !!has[id] })) };
    },
    leaderboard(me) {
      const ids = [me, ...api.friendIds(me)];
      return ids.map(id => {
        const u = q("SELECT id, username, display FROM users WHERE id = ?").get(id);
        const s = api.score(id);
        return { ...pub(u), points: s.points, linkups: s.linkups, streakWeeks: s.streakWeeks, me: id === me };
      }).sort((x, y) => y.points - x.points || y.linkups - x.linkups);
    },

    // the feed: what this person may see right now
    feed(me) {
      const t = now();
      q("DELETE FROM routes WHERE expires < ?").run(t - 36e5);
      q("DELETE FROM here WHERE expires < ?").run(t);
      const ids = api.friendIds(me);
      const mine = q("SELECT id, label, lat, lon, leave_at, expires FROM routes WHERE user_id = ? AND expires > ? ORDER BY leave_at")
        .all(me, t);
      const myHere = q("SELECT lat, lon, expires FROM here WHERE user_id = ? AND expires > ?").get(me, t) || null;
      const list = ids.length ? ids.map(() => "?").join(",") : "NULL";
      // ghosted friends show nothing; a friend's shares only while not expired
      const theirRoutes = ids.length ? q(`SELECT r.id, r.user_id, r.label, r.lat, r.lon, r.leave_at, r.expires, u.display, u.username
          FROM routes r JOIN users u ON u.id = r.user_id
          WHERE r.user_id IN (${list}) AND u.ghost = 0 AND r.expires > ? ORDER BY r.leave_at`).all(...ids, t) : [];
      const theirHere = ids.length ? q(`SELECT h.user_id, h.lat, h.lon, h.updated, h.expires, u.display, u.username
          FROM here h JOIN users u ON u.id = h.user_id WHERE h.user_id IN (${list}) AND u.ghost = 0 AND h.expires > ?`)
        .all(...ids, t) : [];
      const anchors = [...mine.map(r => ({ lat: r.lat, lon: r.lon, from: r.leave_at, to: r.expires, what: r.label })),
                       ...(myHere ? [{ lat: myHere.lat, lon: myHere.lon, from: t, to: myHere.expires, what: "where you are" }] : [])];
      const crossing = (p, from, to) => {
        for (const a of anchors) {
          if (km(a, p) <= CROSS_KM && from <= a.to && to >= a.from) return a.what;
        }
        return null;
      };
      const where = myHere || mine[0] || null;
      const dist = p => (where ? Math.round(km(where, p) * 10) / 10 : null);
      const routes = theirRoutes.map(r => ({ ...r, km: dist(r), crossing: crossing(r, r.leave_at, r.expires) }));
      const here = theirHere.map(h => ({ ...h, km: dist(h), crossing: crossing(h, t, h.expires) }));
      const pullIn = q(`SELECT p.id, p.from_id, p.message, p.status, p.created, u.display, u.username FROM pullups p
                        JOIN users u ON u.id = p.from_id WHERE p.to_id = ? AND p.expires > ? ORDER BY p.created DESC`).all(me, t);
      const pullOut = q(`SELECT p.id, p.to_id, p.message, p.status, p.created, u.display, u.username FROM pullups p
                         JOIN users u ON u.id = p.to_id WHERE p.from_id = ? AND p.expires > ? ORDER BY p.created DESC`).all(me, t);
      const me_ = q("SELECT ghost FROM users WHERE id = ?").get(me);
      return { now: t, ghost: !!me_.ghost, mine, here: myHere, friendsRoutes: routes, friendsHere: here,
               pullups: { incoming: pullIn, outgoing: pullOut }, nearKm: NEAR_KM };
    },
  };
  return api;
}

const pub = r => ({ id: r.id, username: r.username, display: r.display });
function checkLatLon(lat, lon) {
  if (!(Number.isFinite(Number(lat)) && Math.abs(lat) <= 90 && Number.isFinite(Number(lon)) && Math.abs(lon) <= 180)) {
    throw err(400, "That place has no valid map position.");
  }
}
export function err(status, message) { return Object.assign(new Error(message), { status }); }
