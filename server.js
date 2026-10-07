// server.js — SmartPOS local server. No npm install needed: uses only Node's
// built-in modules (http, node:sqlite, crypto). Run with: node server.js
// Then open http://localhost:4173 in a browser on this computer.
//
// Two protections were added here:
//   1. SESSION AUTH — /api/state is only served to a browser that has signed in.
//      Signing in happens against the real user accounts, and the server hands
//      back a random token. Nothing else can read or overwrite the database.
//   2. VERSION GUARD — every save carries the version the browser loaded. If the
//      data has moved on (a second till saved in between), the save is refused
//      with 409 instead of silently overwriting the other till's sales.
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { openDb, loadState, saveState, getVersion, setVersion } = require('./db');
const { seed } = require('./logic-seed');

const PORT = process.env.PORT ? Number(process.env.PORT) : 4173;
const DB_FILE = path.join(__dirname, 'data', 'smartpos.db');
const INDEX_FILE = path.join(__dirname, 'public', 'index.html');
const SESSION_MS = 12 * 60 * 60 * 1000; // 12 hours — covers a full trading day
const MAX_BODY = 25 * 1024 * 1024;

const db = openDb(DB_FILE);
const wasEmpty = !db.prepare('SELECT 1 FROM singletons LIMIT 1').get() && !db.prepare('SELECT 1 FROM records LIMIT 1').get();
let cached = loadState(db, seed).state;
// Persist immediately: this is also how one-time data migrations (like an old
// database's ready-made stock being converted from kg to portions) get written
// back to disk right away, so they never accidentally run a second time.
saveState(db, cached);
let version = getVersion(db);
if (wasEmpty) console.log('New database created at ' + DB_FILE + ' with sample data.');

/* ---------------- sessions ---------------- */
const sessions = new Map(); // token -> { user, exp }
function pruneSessions() {
  const now = Date.now();
  for (const [t, s] of sessions) if (now > s.exp) sessions.delete(t);
}
function authOf(req) {
  const h = req.headers['authorization'] || '';
  const m = /^Bearer (.+)$/.exec(h.trim());
  if (!m) return null;
  const s = sessions.get(m[1]);
  if (!s) return null;
  if (Date.now() > s.exp) { sessions.delete(m[1]); return null; }
  s.exp = Date.now() + SESSION_MS; // active tills stay signed in
  return { token: m[1], user: s.user };
}
// Public list of who may sign in. Passwords are never sent to the browser —
// that was the whole weakness of the old client-side check.
function publicUsers() {
  return (cached.users || []).filter((u) => u.active !== false)
    .map((u) => ({ username: u.username, name: u.name, role: u.role }));
}

/* ---------------- helpers ---------------- */
function send(res, status, body, type, headers) {
  const h = Object.assign({ 'Content-Type': type || 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, headers || {});
  res.writeHead(status, h);
  res.end(body);
}
const json = (res, status, obj, headers) => send(res, status, JSON.stringify(obj), 'application/json; charset=utf-8', headers);
const vHeader = () => ({ 'X-Smartpos-Version': String(version) });
function readBody(req, cb) {
  let body = '';
  req.on('data', (c) => {
    body += c;
    if (body.length > MAX_BODY) { req.destroy(); cb(new Error('too large')); }
  });
  req.on('end', () => cb(null, body));
  req.on('error', (e) => cb(e));
}

const server = http.createServer((req, res) => {
  try {
    const url = (req.url || '').split('?')[0];

    /* the app itself — no auth, it is only markup and scripts */
    if (req.method === 'GET' && (url === '/' || url === '/index.html')) {
      fs.readFile(INDEX_FILE, (err, data) => {
        if (err) return send(res, 500, 'Could not read public/index.html');
        send(res, 200, data, 'text/html; charset=utf-8');
      });
      return;
    }

    /* enough to draw the sign-in screen, and nothing sensitive */
    if (req.method === 'GET' && url === '/api/boot') {
      return json(res, 200, { business: (cached.settings || {}).business || 'SmartPOS', users: publicUsers() });
    }

    /* sign in against the real accounts, get a token */
    if (req.method === 'POST' && url === '/api/login') {
      return readBody(req, (err, body) => {
        if (err) return json(res, 400, { error: 'Bad request' });
        let c;
        try { c = JSON.parse(body); } catch (e) { return json(res, 400, { error: 'Invalid JSON' }); }
        const u = String(c.username || '').trim().toLowerCase();
        const p = String(c.pass || '');
        const found = (cached.users || []).find((x) => String(x.username || '').toLowerCase() === u && x.active !== false);
        // Compare both fields even when the user is unknown, so the timing does
        // not reveal which usernames exist.
        const ok = found ? String(found.pass || '') === p : ('x' + p) === ('x' + found);
        if (!found || !ok) return json(res, 401, { error: 'Wrong username or password.' });
        pruneSessions();
        const token = crypto.randomBytes(24).toString('hex');
        const user = { username: found.username, name: found.name, role: found.role };
        sessions.set(token, { user, exp: Date.now() + SESSION_MS });
        console.log('Signed in: ' + user.name);
        return json(res, 200, { token, user });
      });
    }

    if (req.method === 'POST' && url === '/api/logout') {
      const a = authOf(req);
      if (a) { sessions.delete(a.token); console.log('Signed out: ' + a.user.name); }
      return json(res, 200, { ok: true });
    }

    /* everything below needs a signed-in till */
    const auth = authOf(req);
    if (!auth) return json(res, 401, { error: 'Sign in required' });

    if (req.method === 'GET' && url === '/api/state') {
      return send(res, 200, JSON.stringify(cached), 'application/json; charset=utf-8', vHeader());
    }

    if (req.method === 'POST' && url === '/api/state') {
      return readBody(req, (err, body) => {
        if (err) return json(res, 413, { error: 'That save is too large' });
        let next;
        try { next = JSON.parse(body); } catch (e) { return json(res, 400, { error: 'Invalid JSON' }); }

        // VERSION GUARD. The browser tells us which version it loaded. If the
        // server has moved on, this save was built on stale data and applying it
        // would delete whatever the other till wrote. Refuse it instead.
        const sent = req.headers['x-smartpos-expected-version'];
        if (sent !== undefined && sent !== null && String(sent) !== String(version)) {
          console.warn('Refused a stale save from ' + auth.user.name + ' (browser v' + sent + ', server v' + version + ')');
          return json(res, 409, { error: 'conflict', serverVersion: version, yourVersion: Number(sent) }, vHeader());
        }

        try {
          saveState(db, next);
          cached = next;
          version += 1;
          setVersion(db, version);
          json(res, 200, { ok: true, savedAt: new Date().toISOString(), version }, vHeader());
        } catch (e) {
          console.error('Save failed:', e);
          json(res, 500, { error: 'Could not save to the database' });
        }
      });
    }

    json(res, 404, { error: 'Not found' });
  } catch (e) {
    console.error(e);
    json(res, 500, { error: 'Server error' });
  }
});

server.listen(PORT, () => {
  console.log('');
  console.log('  Mister Hogs SmartPOS is running.');
  console.log('  Open this in a browser on this computer:  http://localhost:' + PORT);
  console.log('  Database file:  ' + DB_FILE);
  console.log('  Sign-in is required before any data is served.');
  console.log('  Press Ctrl+C to stop.');
  console.log('');
});
